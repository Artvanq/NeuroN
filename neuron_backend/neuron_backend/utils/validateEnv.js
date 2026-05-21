function validateEnv() {
  const isProd = process.env.NODE_ENV === 'production';

  if (isProd && !process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required in production');
  }

  if (isProd) {
    const secret = process.env.JWT_SECRET || '';
    if (!secret || secret.length < 32 || secret.includes('change-me')) {
      throw new Error(
        'JWT_SECRET must be set in production (min 32 random characters)'
      );
    }

    if (!process.env.REDIS_URL && !process.env.UPSTASH_REDIS_URL) {
      throw new Error('REDIS_URL is required in production (sessions, rate limit, Socket.io)');
    }

    const { mediaStorageMode } = require('./mediaStorage');
    const mediaMode = mediaStorageMode();
    if (mediaMode === 'disabled') {
      console.warn('[env] Media storage disabled — set MEDIA_LOCAL_DIR or R2_*');
    } else if (mediaMode === 'local') {
      console.warn('[env] Media storage: local disk (budget mode)');
    }
    if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM) {
      console.warn('[env] Resend not set — email notifications and account recovery disabled');
    }
    const requireEmailVerification = String(process.env.REQUIRE_EMAIL_VERIFICATION || '').toLowerCase() === 'true';
    if (requireEmailVerification && (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM)) {
      throw new Error(
        'REQUIRE_EMAIL_VERIFICATION=true requires RESEND_API_KEY and RESEND_FROM in production'
      );
    }
    if (!process.env.SENTRY_DSN?.trim()) {
      console.warn('[env] SENTRY_DSN not set — error reporting disabled');
    }
    const rotationDays = Number(process.env.JWT_SECRET_ROTATION_DAYS || 0);
    if (rotationDays > 0) {
      console.warn(
        `[env] JWT key rotation policy: rotate JWT_SECRET every ${rotationDays} days and revoke sessions`
      );
    } else {
      console.warn('[env] Set JWT_SECRET_ROTATION_DAYS to document key rotation cadence (recommended: 90)');
    }
  }
}

module.exports = validateEnv;
