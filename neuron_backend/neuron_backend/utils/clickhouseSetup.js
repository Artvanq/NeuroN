/**
 * Optional ClickHouse table bootstrap for analytics worker.
 * Set CLICKHOUSE_ENSURE_TABLE=true on first deploy.
 */
const { createClient } = require('@clickhouse/client');

const DEFAULT_DDL = `
CREATE TABLE IF NOT EXISTS analytics_events (
  id String,
  event_name String,
  payload String,
  created_at DateTime64(3, 'UTC')
)
ENGINE = MergeTree()
ORDER BY (created_at, event_name)
TTL created_at + INTERVAL 365 DAY
`;

async function ensureClickhouseTable() {
  const url = process.env.CLICKHOUSE_URL;
  if (!url) return { skipped: true, reason: 'no CLICKHOUSE_URL' };
  if (process.env.CLICKHOUSE_ENSURE_TABLE !== 'true') {
    return { skipped: true, reason: 'CLICKHOUSE_ENSURE_TABLE not true' };
  }

  const table = process.env.CLICKHOUSE_TABLE || 'analytics_events';
  const ddl = (process.env.CLICKHOUSE_DDL || DEFAULT_DDL).replace(
    /analytics_events/g,
    table
  );

  const client = createClient({ url });
  await client.command({ query: ddl });
  return { ok: true, table };
}

module.exports = { ensureClickhouseTable, DEFAULT_DDL };
