const path = require('path');
const dotenv = require('dotenv');

/**
 * Load env from repo root `.env` (single source of truth).
 * Optional override: neuron_backend/neuron_backend/.env (legacy).
 */
function loadEnv(callerDir) {
  const backendPkg =
    path.basename(callerDir) === 'workers' ? path.join(callerDir, '..') : callerDir;
  const repoRoot = path.join(backendPkg, '..', '..');

  dotenv.config({ path: path.join(repoRoot, '.env') });
  dotenv.config({ path: path.join(backendPkg, '.env') });
}

module.exports = { loadEnv };
