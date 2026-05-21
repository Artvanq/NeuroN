const prisma = require('./prisma');

const connectDB = async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL is required. Start Postgres: docker compose up -d postgres'
    );
  }

  try {
    await prisma.$connect();
    console.log('PostgreSQL connected');
  } catch (err) {
    throw new Error(`PostgreSQL connection failed: ${err.message}`);
  }
};

const isDbReady = async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
};

module.exports = connectDB;
module.exports.isDbReady = isDbReady;
module.exports.prisma = prisma;
