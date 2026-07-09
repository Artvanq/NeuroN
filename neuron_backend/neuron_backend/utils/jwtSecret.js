const DEV_FALLBACK_SECRET = 'neuron-dev-secret-change-in-production';
const isExplicitlyNonProd = ['development', 'test'].includes(process.env.NODE_ENV);

let JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  if (isExplicitlyNonProd) {
    JWT_SECRET = DEV_FALLBACK_SECRET;
  } else {
    // Fail closed: unless NODE_ENV is explicitly "development" or "test",
    // never silently boot with a well-known hardcoded secret (that would let
    // anyone forge valid access/refresh tokens if NODE_ENV is unset/misconfigured).
    throw new Error(
      'JWT_SECRET is not set. Set JWT_SECRET (min 32 random characters), or explicitly set NODE_ENV=development for local dev.'
    );
  }
}

module.exports = { JWT_SECRET };
