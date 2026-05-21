const test = require('node:test');
const assert = require('node:assert/strict');

const { scrubSentryEvent, isSentryEnabled } = require('../utils/sentry');

test('isSentryEnabled is false without SENTRY_DSN', () => {
  const prev = process.env.SENTRY_DSN;
  delete process.env.SENTRY_DSN;
  assert.equal(isSentryEnabled(), false);
  if (prev !== undefined) process.env.SENTRY_DSN = prev;
});

test('scrubSentryEvent redacts sensitive request fields', () => {
  const event = {
    request: {
      headers: { authorization: 'Bearer secret', 'content-type': 'application/json' },
      data: { password: 'hunter2', username: 'alice' },
    },
    breadcrumbs: [{ data: { token: 'abc', note: 'ok' } }],
  };
  const scrubbed = scrubSentryEvent(event);
  assert.equal(scrubbed.request.headers.authorization, '[Filtered]');
  assert.equal(scrubbed.request.headers['content-type'], 'application/json');
  assert.equal(scrubbed.request.data.password, '[Filtered]');
  assert.equal(scrubbed.request.data.username, 'alice');
  assert.equal(scrubbed.breadcrumbs[0].data.token, '[Filtered]');
  assert.equal(scrubbed.breadcrumbs[0].data.note, 'ok');
});
