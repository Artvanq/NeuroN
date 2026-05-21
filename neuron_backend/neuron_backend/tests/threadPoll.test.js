const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizePollOptions,
  parsePollEndsAt,
  isPollClosed,
  formatPoll,
} = require('../utils/threadPoll');

test('normalizePollOptions requires 2–6 unique labels', () => {
  assert.equal(normalizePollOptions(['a']).ok, false);
  assert.equal(normalizePollOptions(['a', 'b', 'c', 'd', 'e', 'f', 'g']).ok, false);
  assert.equal(normalizePollOptions(['yes', 'yes']).ok, false);
  const ok = normalizePollOptions(['  Alpha  ', 'Beta']);
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.labels, ['Alpha', 'Beta']);
});

test('parsePollEndsAt rejects past dates', () => {
  const past = new Date(Date.now() - 60000).toISOString();
  const r = parsePollEndsAt(past);
  assert.ok(r.error);
  assert.equal(parsePollEndsAt(''), null);
});

test('formatPoll computes percentages and viewer vote', () => {
  const poll = formatPoll(
    {
      id: 'p1',
      endsAt: null,
      options: [
        { id: 'o1', label: 'A', position: 0, _count: { votes: 2 } },
        { id: 'o2', label: 'B', position: 1, _count: { votes: 1 } },
      ],
      votes: [{ userId: 'u1', optionId: 'o2' }],
    },
    { viewerUserId: 'u1' }
  );
  assert.equal(poll.totalVotes, 3);
  assert.equal(poll.myOptionId, 'o2');
  assert.equal(poll.options[0].voteCount, 2);
});

test('isPollClosed respects endsAt', () => {
  assert.equal(isPollClosed({ endsAt: null }), false);
  assert.equal(
    isPollClosed({ endsAt: new Date(Date.now() + 3600000) }),
    false
  );
  assert.equal(
    isPollClosed({ endsAt: new Date(Date.now() - 1000) }),
    true
  );
});
