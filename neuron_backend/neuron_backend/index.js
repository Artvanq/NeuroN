const { loadEnv } = require('./utils/loadEnv');
loadEnv(__dirname);
const { initSentry, captureException } = require('./utils/sentry');
initSentry({ serverName: 'neuron-api' });

const http = require('http');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const { isDbReady } = require('./utils/db');
const validateEnv = require('./utils/validateEnv');
const connectDB = require('./utils/db');
const seedCategories = require('./utils/seedCategories');
const seedInquiries = require('./utils/seedInquiries');
const seedDev = require('./utils/seedDev');
const { seedFounderInvites } = require('./utils/invites');
const { syncPlatformRolesFromEnv } = require('./utils/syncPlatformRoles');
const errorHandler = require('./middleware/errorHandler');
const notFoundHandler = require('./middleware/notFound');
const { initSocket } = require('./socket');
const { setSocketIO } = require('./utils/notify');
const { connectRedis, pingRedis, isRedisConfigured, isRedisAvailable } = require('./utils/redis');
const { isR2Configured } = require('./utils/r2');
const { mediaStorageMode } = require('./utils/mediaStorage');
const { listFeatureFlags } = require('./utils/featureFlags');
const { isWebPushConfigured } = require('./utils/webPush');
const { apiRateLimit } = require('./middleware/rateLimit');
const { startGitSshServer } = require('./utils/gitSshServer');

const app = express();

const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      if (process.env.NODE_ENV !== 'production') {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

app.get('/', (_req, res) => {
  res.json({
    name: 'Neuron API',
    status: 'ok',
    docs: '/api/health',
    websocket: true,
  });
});

app.get('/api/health', async (_req, res) => {
  const [dbReady, redisOk] = await Promise.all([
    isDbReady(),
    isRedisConfigured() ? pingRedis() : Promise.resolve(false),
  ]);

  const emailVerificationRequired = process.env.REQUIRE_EMAIL_VERIFICATION === 'true';
  const resendConfigured = Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM);

  const services = {
    postgres: dbReady ? 'connected' : 'disconnected',
    redis: isRedisConfigured() ? (redisOk ? 'connected' : 'error') : 'not_configured',
    r2: isR2Configured() ? 'configured' : 'not_configured',
    media: mediaStorageMode(),
    email: emailVerificationRequired
      ? resendConfigured
        ? 'verification_required'
        : 'verification_required_missing_resend'
      : resendConfigured
        ? 'optional'
        : 'not_configured',
    auth: isRedisAvailable() ? 'refresh_cookies' : 'redis_unavailable',
    gitSsh: process.env.SSH_GIT_PORT ? `port_${process.env.SSH_GIT_PORT}` : 'disabled',
    webPush: isWebPushConfigured() ? 'configured' : 'not_configured',
    analytics: process.env.CLICKHOUSE_URL ? 'clickhouse' : 'log_only',
  };

  const ok = dbReady && (!isRedisConfigured() || redisOk);

  res.json({
    status: ok ? 'ok' : 'degraded',
    services,
    featureFlags: listFeatureFlags(),
    timestamp: new Date().toISOString(),
  });
});

app.use('/api', apiRateLimit);

app.use('/api/auth', require('./routes/auth'));
app.use('/api/auth/oauth', require('./routes/authOAuth'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/inquiries', require('./routes/inquiries'));
app.use('/api/threads', require('./routes/threads'));
app.use('/api/votes', require('./routes/votes'));
app.use('/api/orgs', require('./routes/orgs'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/users', require('./routes/users'));
app.use('/api/conversations', require('./routes/conversations'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/push', require('./routes/push'));
app.use('/api/search', require('./routes/search'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/appeals', require('./routes/appeals'));
app.use('/api/blocks', require('./routes/blocks'));
app.use('/api/message-requests', require('./routes/messageRequests'));
app.use('/api/translate', require('./routes/translate'));
app.use('/api/media', require('./routes/media'));
app.use('/api/stats', require('./routes/stats'));
app.use('/api/git/:owner/:slug', require('./routes/git'));

app.use(notFoundHandler);
app.use(errorHandler);

const PORT = process.env.PORT || 4000;

const start = async () => {
  validateEnv();
  await connectDB();
  const redisOk = await connectRedis();
  if (!redisOk && process.env.NODE_ENV === 'production') {
    throw new Error('Redis connection failed — required for auth');
  }
  if (!redisOk) {
    if (!isRedisConfigured()) {
      console.warn('[startup] REDIS_URL missing — login/register will return 503 until Redis is configured');
    } else {
      console.warn('[startup] Redis unreachable — start it: docker compose up -d redis');
    }
  }
  await seedCategories();
  await seedInquiries();
  await seedFounderInvites();
  await seedDev();
  await syncPlatformRolesFromEnv();

  const httpServer = http.createServer(app);
  const io = await initSocket(httpServer, allowedOrigins);
  setSocketIO(io);
  app.set('io', io);

  httpServer.listen(PORT, () => {
    console.log(`Neuron API running on http://localhost:${PORT}`);
    console.log(`Database: ${process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':***@') || 'not set'}`);
    startGitSshServer();
  });
};

start().catch((err) => {
  console.error('Failed to start server:', err.message);
  captureException(err, { phase: 'startup' });
  process.exit(1);
});
