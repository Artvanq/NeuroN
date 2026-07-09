const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('./jwtSecret');

const PROVIDERS = {
  github: {
    key: 'GITHUB',
    name: 'GitHub',
    scopes: 'read:user user:email',
    authorizeUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    profileUrl: 'https://api.github.com/user',
  },
  linkedin: {
    key: 'LINKEDIN',
    name: 'LinkedIn',
    scopes: 'openid profile email',
    authorizeUrl: 'https://www.linkedin.com/oauth/v2/authorization',
    tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
    profileUrl: 'https://api.linkedin.com/v2/userinfo',
  },
  google: {
    key: 'GOOGLE',
    name: 'Google',
    scopes: 'openid email profile',
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    profileUrl: 'https://openidconnect.googleapis.com/v1/userinfo',
  },
};

function getProvider(slug) {
  const p = PROVIDERS[String(slug || '').toLowerCase()];
  if (!p) return null;
  return p;
}

function getCallbackUrl(providerSlug) {
  const base = process.env.API_PUBLIC_URL || `http://localhost:${process.env.PORT || 4000}`;
  return `${base.replace(/\/$/, '')}/api/auth/oauth/${providerSlug}/callback`;
}

function getClientConfig(providerSlug) {
  const upper = providerSlug.toUpperCase();
  return {
    clientId: process.env[`${upper}_CLIENT_ID`],
    clientSecret: process.env[`${upper}_CLIENT_SECRET`],
  };
}

function isProviderConfigured(providerSlug) {
  const { clientId, clientSecret } = getClientConfig(providerSlug);
  return Boolean(clientId && clientSecret);
}

function signOAuthState(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });
}

function verifyOAuthState(state) {
  return jwt.verify(state, JWT_SECRET);
}

function buildAuthorizeUrl(providerSlug, { linkUserId } = {}) {
  const provider = getProvider(providerSlug);
  if (!provider) throw new Error('Unknown provider');

  const { clientId } = getClientConfig(providerSlug);
  if (!clientId) throw new Error(`${provider.name} OAuth is not configured`);

  const redirectUri = getCallbackUrl(providerSlug);
  const state = signOAuthState({
    provider: providerSlug,
    nonce: crypto.randomBytes(16).toString('hex'),
    linkUserId: linkUserId || null,
  });

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    response_type: 'code',
  });

  if (provider.scopes) params.set('scope', provider.scopes);
  if (provider.duration) params.set('duration', provider.duration);

  return `${provider.authorizeUrl}?${params.toString()}`;
}

async function exchangeCode(providerSlug, code) {
  const provider = getProvider(providerSlug);
  const { clientId, clientSecret } = getClientConfig(providerSlug);
  const redirectUri = getCallbackUrl(providerSlug);

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });

  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/x-www-form-urlencoded',
  };

  const res = await fetch(provider.tokenUrl, {
    method: 'POST',
    headers,
    body,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error_description || data.error || 'Token exchange failed');
  }
  return data;
}

async function fetchGitHubProfile(accessToken) {
  const res = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'Neuron',
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'GitHub profile failed');
  let email = data.email || null;
  if (!email) {
    const emailsRes = await fetch('https://api.github.com/user/emails', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'Neuron',
      },
    });
    if (emailsRes.ok) {
      const emails = await emailsRes.json();
      const primary = Array.isArray(emails) ? emails.find((e) => e.primary) || emails[0] : null;
      email = primary?.email || null;
    }
  }
  return {
    providerUserId: String(data.id),
    usernameHint: (data.login || '').toLowerCase().replace(/[^a-z0-9_]/g, ''),
    displayName: data.name || data.login,
    avatarUrl: data.avatar_url,
    profileUrl: data.html_url,
    email,
  };
}

async function fetchLinkedInProfile(accessToken) {
  const res = await fetch('https://api.linkedin.com/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'LinkedIn profile failed');
  const sub = (data.preferred_username || data.email || 'linkedin')
    .split('@')[0]
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '');
  return {
    providerUserId: String(data.sub),
    usernameHint: sub.slice(0, 24),
    displayName: data.name || sub,
    avatarUrl: data.picture || null,
    profileUrl: data.profile || null,
    email: data.email || null,
  };
}

async function fetchGoogleProfile(accessToken) {
  const res = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.error || 'Google profile failed');
  const usernameHint = (data.email || data.name || 'google')
    .split('@')[0]
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 24);
  return {
    providerUserId: String(data.sub),
    usernameHint,
    displayName: data.name || usernameHint,
    avatarUrl: data.picture || null,
    profileUrl: null,
    email: data.email_verified ? data.email : null,
  };
}

async function fetchProviderProfile(providerSlug, accessToken) {
  if (providerSlug === 'github') return fetchGitHubProfile(accessToken);
  if (providerSlug === 'linkedin') return fetchLinkedInProfile(accessToken);
  if (providerSlug === 'google') return fetchGoogleProfile(accessToken);
  throw new Error('Unknown provider');
}

module.exports = {
  PROVIDERS,
  getProvider,
  getCallbackUrl,
  isProviderConfigured,
  buildAuthorizeUrl,
  verifyOAuthState,
  exchangeCode,
  fetchProviderProfile,
};
