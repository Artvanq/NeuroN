/**
 * Poll analytics_outbox and ship events (ClickHouse when configured, else log).
 * Run: node workers/analyticsWorker.js
 */
const { loadEnv } = require('../utils/loadEnv');
loadEnv(__dirname);
const { initSentry, captureException } = require('../utils/sentry');
initSentry({ serverName: 'neuron-analytics-worker' });
const { createClient } = require('@clickhouse/client');
const prisma = require('../utils/prisma');
const { ensureClickhouseTable } = require('../utils/clickhouseSetup');

const BATCH = Number(process.env.ANALYTICS_BATCH_SIZE || 50);
const INTERVAL_MS = Number(process.env.ANALYTICS_POLL_MS || 5000);
const CLICKHOUSE_TABLE = process.env.CLICKHOUSE_TABLE || 'analytics_events';

let clickhouseClient = null;

function getClickhouseClient() {
  if (!process.env.CLICKHOUSE_URL) return null;
  if (!clickhouseClient) {
    clickhouseClient = createClient({ url: process.env.CLICKHOUSE_URL });
  }
  return clickhouseClient;
}

async function shipEvent(row) {
  const ch = getClickhouseClient();
  if (ch) {
    await ch.insert({
      table: CLICKHOUSE_TABLE,
      format: 'JSONEachRow',
      values: [
        {
          id: row.id,
          event_name: row.eventName,
          payload: JSON.stringify(row.payload || {}),
          created_at: row.createdAt.toISOString(),
        },
      ],
    });
    return;
  }
  console.log('[analytics]', row.eventName, JSON.stringify(row.payload).slice(0, 200));
}

async function processBatch() {
  const rows = await prisma.analyticsOutbox.findMany({
    where: { processedAt: null },
    orderBy: { createdAt: 'asc' },
    take: BATCH,
  });

  for (const row of rows) {
    try {
      await shipEvent(row);
      await prisma.analyticsOutbox.update({
        where: { id: row.id },
        data: { processedAt: new Date(), attempts: { increment: 1 } },
      });
    } catch (err) {
      await prisma.analyticsOutbox.update({
        where: { id: row.id },
        data: { attempts: { increment: 1 } },
      });
      console.warn('analytics ship failed', row.id, err.message);
      captureException(err, { worker: 'analytics', outboxId: row.id });
    }
  }
}

function analyticsMode() {
  return process.env.CLICKHOUSE_URL ? 'clickhouse' : 'log_only';
}

async function loop() {
  await prisma.$connect();
  const mode = analyticsMode();
  if (mode === 'clickhouse') {
    try {
      const ensured = await ensureClickhouseTable();
      if (ensured.ok) console.log('[analytics] ClickHouse table ready:', ensured.table);
    } catch (err) {
      console.warn('[analytics] ClickHouse table ensure failed:', err.message);
    }
  }
  console.log(
    `[analytics] worker started mode=${mode} table=${CLICKHOUSE_TABLE} batch=${BATCH}`
  );
  // eslint-disable-next-line no-constant-condition
  while (true) {
    // eslint-disable-next-line no-await-in-loop
    await processBatch();
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, INTERVAL_MS));
  }
}

loop().catch((err) => {
  console.error(err);
  captureException(err, { worker: 'analytics' });
  process.exit(1);
});
