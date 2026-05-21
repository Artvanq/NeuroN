const { test } = require('node:test');
const assert = require('node:assert/strict');

test('validateEnv requires JWT_SECRET in production', () => {
  const env = {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    REDIS_URL: 'redis://127.0.0.1:6379',
    JWT_SECRET: '',
  };
  const original = { ...process.env };
  Object.assign(process.env, env);
  try {
    delete require.cache[require.resolve('../utils/validateEnv')];
    const validateEnv = require('../utils/validateEnv');
    assert.throws(() => validateEnv(), /JWT_SECRET/);
  } finally {
    Object.keys(env).forEach((k) => {
      if (original[k] === undefined) delete process.env[k];
      else process.env[k] = original[k];
    });
    delete require.cache[require.resolve('../utils/validateEnv')];
  }
});

test('validateEnv requires Resend when email verification is enforced', () => {
  const env = {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    REDIS_URL: 'redis://127.0.0.1:6379',
    JWT_SECRET: 'x'.repeat(40),
    REQUIRE_EMAIL_VERIFICATION: 'true',
    RESEND_API_KEY: '',
    RESEND_FROM: '',
  };
  const original = { ...process.env };
  Object.assign(process.env, env);
  try {
    delete require.cache[require.resolve('../utils/validateEnv')];
    const validateEnv = require('../utils/validateEnv');
    assert.throws(() => validateEnv(), /REQUIRE_EMAIL_VERIFICATION=true/);
  } finally {
    Object.keys(env).forEach((k) => {
      if (original[k] === undefined) delete process.env[k];
      else process.env[k] = original[k];
    });
    delete require.cache[require.resolve('../utils/validateEnv')];
  }
});
