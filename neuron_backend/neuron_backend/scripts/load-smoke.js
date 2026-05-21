#!/usr/bin/env node
/**
 * Lightweight load smoke — concurrent GET /api/health latency check.
 * Usage: node scripts/load-smoke.js [--url http://127.0.0.1:4000] [--requests 80]
 */
const http = require('http');
const https = require('https');

const args = process.argv.slice(2);
function arg(name, fallback) {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
}

const baseUrl = arg('--url', process.env.LOAD_SMOKE_URL || 'http://127.0.0.1:4000');
const total = Math.min(Number(arg('--requests', '80')) || 80, 500);
const maxP95Ms = Number(arg('--max-p95-ms', process.env.LOAD_SMOKE_MAX_P95_MS || '800'));

const target = new URL('/api/health', baseUrl);
const client = target.protocol === 'https:' ? https : http;

function oneRequest() {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const req = client.request(
      {
        hostname: target.hostname,
        port: target.port || (target.protocol === 'https:' ? 443 : 80),
        path: target.pathname + target.search,
        method: 'GET',
        timeout: 10_000,
      },
      (res) => {
        res.resume();
        res.on('end', () => resolve({ ms: Date.now() - started, status: res.statusCode }));
      }
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('timeout'));
    });
    req.end();
  });
}

function percentile(sorted, p) {
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))];
}

async function main() {
  const results = await Promise.all(
    Array.from({ length: total }, () => oneRequest().catch((err) => ({ ms: 10_000, error: err.message })))
  );
  const times = results.map((r) => r.ms).sort((a, b) => a - b);
  const errors = results.filter((r) => r.error || r.status !== 200).length;
  const p50 = percentile(times, 50);
  const p95 = percentile(times, 95);

  console.log(
    JSON.stringify({
      url: target.href,
      requests: total,
      errors,
      p50ms: p50,
      p95ms: p95,
      maxMs: times[times.length - 1],
    })
  );

  if (errors > total * 0.05) {
    console.error(`Too many errors: ${errors}/${total}`);
    process.exit(1);
  }
  if (p95 > maxP95Ms) {
    console.error(`p95 ${p95}ms exceeds budget ${maxP95Ms}ms`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
