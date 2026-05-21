-- Neuron analytics_events (default CLICKHOUSE_TABLE)
-- Run once if CLICKHOUSE_ENSURE_TABLE is not used.

CREATE TABLE IF NOT EXISTS analytics_events (
  id String,
  event_name String,
  payload String,
  created_at DateTime64(3, 'UTC')
)
ENGINE = MergeTree()
ORDER BY (created_at, event_name)
TTL created_at + INTERVAL 365 DAY;
