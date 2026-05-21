const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const clientDir = path.join(root, 'node_modules', '.prisma', 'client');
const enginePath = path.join(clientDir, 'query_engine-windows.dll.node');
const indexPath = path.join(clientDir, 'index.js');

function engineReady() {
  try {
    return (
      fs.existsSync(enginePath) &&
      fs.statSync(enginePath).size > 1_000_000 &&
      fs.existsSync(indexPath)
    );
  } catch {
    return false;
  }
}

function cleanupTemps() {
  try {
    if (!fs.existsSync(clientDir)) return;
    for (const name of fs.readdirSync(clientDir)) {
      if (name.includes('query_engine') && name.includes('.tmp')) {
        fs.unlinkSync(path.join(clientDir, name));
      }
    }
  } catch {
    /* ignore */
  }
}

if (engineReady()) {
  console.log('Prisma: query engine already present — skip generate');
  cleanupTemps();
  process.exit(0);
}

try {
  execSync('npx prisma generate', { stdio: 'inherit', cwd: root, env: process.env });
  cleanupTemps();
} catch {
  cleanupTemps();
  if (engineReady()) {
    console.warn('Prisma generate reported an error, but the query engine file exists — continuing.');
    process.exit(0);
  }
  console.error(`
Prisma could not write query_engine-windows.dll.node (file locked).

On Windows this usually means the API is still running.

  1. Stop "npm start" / "npm run dev" for neuron-backend (Ctrl+C)
  2. Run: npm run prisma:generate
  3. Then: npm install  (or npm run db:push)

Optional: add a Windows Security exclusion for:
  ${clientDir}
`);
  process.exit(1);
}
