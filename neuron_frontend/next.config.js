const path = require('path');
const { loadEnvConfig } = require('@next/env');

// Single repo-root .env for API + Next (see /.env.example)
loadEnvConfig(path.join(__dirname, '..'));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    const csp = [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "img-src 'self' data: https:",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "connect-src 'self' https: http: ws: wss: https://*.ingest.sentry.io",
      "font-src 'self' data:",
    ].join('; ');

    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
  webpack(config, { webpack }) {
    // Translation source files (lib/locales/translate/*.json and README.md) are
    // build-time inputs for scripts/compile-locales.mjs — never import them into
    // the app bundle. This guards against any accidental dynamic require/import
    // context globbing that folder and choking on the .md file.
    config.plugins.push(
      new webpack.IgnorePlugin({
        resourceRegExp: /[\\/]lib[\\/]locales[\\/]translate[\\/]/,
      })
    );
    return config;
  },
};

module.exports = nextConfig;
