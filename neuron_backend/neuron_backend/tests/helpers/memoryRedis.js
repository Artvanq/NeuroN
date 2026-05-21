function createMemoryRedis() {
  const store = new Map();
  return {
    async incr(key) {
      const next = (store.get(key) || 0) + 1;
      store.set(key, next);
      return next;
    },
    async expire() {
      return 1;
    },
    _reset() {
      store.clear();
    },
  };
}

module.exports = { createMemoryRedis };
