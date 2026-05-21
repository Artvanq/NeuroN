const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const express = require('express');
const { spawn } = require('child_process');
const path = require('path');

test('load-smoke script meets p95 budget against local health server', async () => {
  const app = express();
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const { port } = server.address();
  const script = path.join(__dirname, '../scripts/load-smoke.js');

  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, '--url', `http://127.0.0.1:${port}`, '--requests', '40', '--max-p95-ms', '200'], {
      stdio: 'inherit',
    });
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`exit ${code}`))));
  });

  server.close();
  assert.ok(true);
});
