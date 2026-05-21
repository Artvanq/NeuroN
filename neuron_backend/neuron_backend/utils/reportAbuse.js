function clampNonNegative(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

function decayReportAbuseScore({
  score,
  updatedAt,
  now = new Date(),
  decayHours = Number(process.env.REPORT_ABUSE_DECAY_HOURS || 24),
}) {
  const current = clampNonNegative(score);
  const ts = updatedAt ? new Date(updatedAt) : null;
  if (!ts || Number.isNaN(ts.getTime()) || current === 0) {
    return {
      score: current,
      updatedAt: ts || now,
      changed: false,
    };
  }

  const intervalMs = Math.max(1, Number(decayHours)) * 60 * 60 * 1000;
  const elapsedMs = now.getTime() - ts.getTime();
  if (elapsedMs < intervalMs) {
    return { score: current, updatedAt: ts, changed: false };
  }

  const steps = Math.floor(elapsedMs / intervalMs);
  const nextScore = Math.max(0, current - steps);
  return {
    score: nextScore,
    updatedAt: now,
    changed: nextScore !== current,
  };
}

module.exports = {
  clampNonNegative,
  decayReportAbuseScore,
};
