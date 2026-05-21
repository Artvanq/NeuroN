function parseFlags(raw) {
  return new Set(
    String(raw || '')
      .split(',')
      .map((x) => x.trim().toLowerCase())
      .filter(Boolean)
  );
}

const envFlags = parseFlags(process.env.FEATURE_FLAGS);

function isFeatureEnabled(flagName) {
  if (!flagName) return false;
  return envFlags.has(String(flagName).trim().toLowerCase());
}

function listFeatureFlags() {
  return [...envFlags].sort();
}

module.exports = {
  isFeatureEnabled,
  listFeatureFlags,
};
