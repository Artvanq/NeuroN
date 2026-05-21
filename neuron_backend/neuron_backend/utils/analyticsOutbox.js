const prisma = require('./prisma');

/**
 * Append-only analytics queue — never blocks HTTP. Worker ships to ClickHouse.
 */
async function enqueueAnalytics(eventName, payload = {}) {
  try {
    await prisma.analyticsOutbox.create({
      data: {
        eventName: String(eventName).slice(0, 120),
        payload,
      },
    });
  } catch (err) {
    console.warn('analytics outbox enqueue failed:', err.message);
  }
}

module.exports = { enqueueAnalytics };
