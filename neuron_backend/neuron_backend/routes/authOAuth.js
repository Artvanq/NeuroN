const express = require('express');
const prisma = require('../utils/prisma');
const asyncHandler = require('../middleware/asyncHandler');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../utils/jwtSecret');
const { issueTokenPair, setRefreshCookie } = require('../utils/sessions');
const { ensureInterestProfile } = require('../utils/interestProfile');
const { formatUserResponse } = require('../utils/authHelpers');
const { requireAuth } = require('../middleware/auth');
const {
  getProvider,
  buildAuthorizeUrl,
  verifyOAuthState,
  exchangeCode,
  fetchProviderProfile,
  isProviderConfigured,
  PROVIDERS,
} = require('../utils/oauthProviders');
const { redeemInvite, validateInvite } = require('../utils/invites');

const router = express.Router();

function normalizeEmail(email) {
  const value = String(email || '').trim().toLowerCase();
  return value || null;
}

function requestSessionMeta(req) {
  return {
    ip: req.ip || req.headers['x-forwarded-for'] || null,
    userAgent: req.headers['user-agent'] || null,
  };
}

function frontendUrl(path, query = {}) {
  const base = (process.env.FRONTEND_URL || 'http://localhost:3000').split(',')[0].trim();
  const url = new URL(path, base);
  Object.entries(query).forEach(([k, v]) => {
    if (v != null) url.searchParams.set(k, String(v));
  });
  return url.toString();
}

router.get(
  '/providers',
  asyncHandler(async (_req, res) => {
    const providers = Object.keys(PROVIDERS).map((slug) => ({
      slug,
      name: PROVIDERS[slug].name,
      configured: isProviderConfigured(slug),
    }));
    res.json({ providers });
  })
);

router.get(
  '/:provider',
  asyncHandler(async (req, res) => {
    const { provider } = req.params;
    if (!getProvider(provider)) {
      return res.status(404).json({ message: 'Unknown provider' });
    }
    if (!isProviderConfigured(provider)) {
      return res.status(503).json({ message: `${provider} sign-in is not configured` });
    }

    let linkUserId = null;
    if (req.query.link === '1') {
      const raw =
        req.query.token ||
        (req.headers.authorization?.startsWith('Bearer ')
          ? req.headers.authorization.slice(7)
          : null) ||
        req.cookies?.token;
      if (raw) {
        try {
          const payload = jwt.verify(raw, JWT_SECRET);
          linkUserId = payload.userId;
        } catch {
          /* ignore */
        }
      }
      if (!linkUserId && req.user?._id) {
        linkUserId = req.user._id;
      }
    }

    const url = buildAuthorizeUrl(provider, { linkUserId });
    res.redirect(url);
  })
);

router.get(
  '/:provider/callback',
  asyncHandler(async (req, res) => {
    const { provider } = req.params;
    const { code, state, error } = req.query;

    if (error) {
      return res.redirect(frontendUrl('/login', { error: String(error) }));
    }
    if (!code || !state) {
      return res.redirect(frontendUrl('/login', { error: 'oauth_missing_code' }));
    }

    let statePayload;
    try {
      statePayload = verifyOAuthState(state);
    } catch {
      return res.redirect(frontendUrl('/login', { error: 'oauth_invalid_state' }));
    }

    if (statePayload.provider !== provider) {
      return res.redirect(frontendUrl('/login', { error: 'oauth_provider_mismatch' }));
    }

    const providerEnum = provider.toUpperCase();
    const tokens = await exchangeCode(provider, code);
    const accessToken = tokens.access_token;
    const profile = await fetchProviderProfile(provider, accessToken);

    const existingOAuth = await prisma.oAuthAccount.findUnique({
      where: {
        provider_providerUserId: {
          provider: providerEnum,
          providerUserId: profile.providerUserId,
        },
      },
      include: { user: { include: { interestedCategories: true, oauthAccounts: true } } },
    });

    if (statePayload.linkUserId) {
      if (existingOAuth && existingOAuth.userId !== statePayload.linkUserId) {
        return res.redirect(frontendUrl('/settings', { error: 'oauth_already_linked' }));
      }
      await prisma.oAuthAccount.upsert({
        where: {
          userId_provider: {
            userId: statePayload.linkUserId,
            provider: providerEnum,
          },
        },
        create: {
          provider: providerEnum,
          providerUserId: profile.providerUserId,
          accessToken,
          refreshToken: tokens.refresh_token || null,
          profileUrl: profile.profileUrl,
          userId: statePayload.linkUserId,
        },
        update: {
          providerUserId: profile.providerUserId,
          accessToken,
          refreshToken: tokens.refresh_token || null,
          profileUrl: profile.profileUrl,
        },
      });
      let verifiedEmailData = {};
      const normalizedEmail = normalizeEmail(profile.email);
      if (normalizedEmail) {
        const emailTaken = await prisma.user.findUnique({ where: { email: normalizedEmail } });
        if (!emailTaken || emailTaken.id === statePayload.linkUserId) {
          verifiedEmailData = { email: normalizedEmail, emailVerifiedAt: new Date() };
        }
      }

      await prisma.user.update({
        where: { id: statePayload.linkUserId },
        data: {
          avatarUrl: profile.avatarUrl || undefined,
          profileUrl: profile.profileUrl || undefined,
          ...verifiedEmailData,
        },
      });
      return res.redirect(frontendUrl('/settings', { linked: provider }));
    }

    if (existingOAuth) {
      const user = existingOAuth.user;
      if (user.isBanned) {
        return res.redirect(frontendUrl('/login', { error: 'account_banned' }));
      }
      const { accessToken, refreshToken } = await issueTokenPair(user.id, requestSessionMeta(req));
      res.cookie('refresh_token', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60 * 1000,
        path: '/api/auth',
      });
      return res.redirect(frontendUrl('/auth/callback', { token: accessToken }));
    }

    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    const pending = await prisma.oAuthPendingSignup.upsert({
      where: {
        provider_providerUserId: {
          provider: providerEnum,
          providerUserId: profile.providerUserId,
        },
      },
      create: {
        provider: providerEnum,
        providerUserId: profile.providerUserId,
        email: normalizeEmail(profile.email),
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
        profileUrl: profile.profileUrl,
        accessToken,
        refreshToken: tokens.refresh_token || null,
        expiresAt,
      },
      update: {
        email: normalizeEmail(profile.email),
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
        profileUrl: profile.profileUrl,
        accessToken,
        refreshToken: tokens.refresh_token || null,
        expiresAt,
      },
    });

    return res.redirect(
      frontendUrl('/auth/complete', {
        pending: pending.id,
        provider,
        username: profile.usernameHint || '',
        name: profile.displayName || '',
      })
    );
  })
);

router.post(
  '/complete',
  asyncHandler(async (req, res) => {
    const { pendingId, username, displayName, inviteCode } = req.body;
    if (!pendingId || !username?.trim()) {
      return res.status(400).json({ message: 'pendingId and username are required' });
    }

    const pending = await prisma.oAuthPendingSignup.findUnique({
      where: { id: pendingId },
    });
    if (!pending || pending.expiresAt < new Date()) {
      return res.status(400).json({ message: 'OAuth session expired — try again' });
    }

    const check = await validateInvite(inviteCode);
    if (!check.ok) {
      return res.status(400).json({ message: check.message });
    }

    const normalized = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (normalized.length < 3) {
      return res.status(400).json({ message: 'Username must be at least 3 characters (a-z, 0-9, _)' });
    }

    const taken = await prisma.user.findUnique({ where: { username: normalized } });
    if (taken) {
      return res.status(409).json({ message: 'Username already taken' });
    }

    const existingOAuth = await prisma.oAuthAccount.findUnique({
      where: {
        provider_providerUserId: {
          provider: pending.provider,
          providerUserId: pending.providerUserId,
        },
      },
    });
    if (existingOAuth) {
      return res.status(409).json({ message: 'Account already registered — sign in instead' });
    }

    let verifiedEmail = pending.email ? normalizeEmail(pending.email) : null;
    if (verifiedEmail) {
      const takenEmail = await prisma.user.findUnique({ where: { email: verifiedEmail } });
      if (takenEmail) verifiedEmail = null;
    }

    const user = await prisma.user.create({
      data: {
        username: normalized,
        displayName: displayName?.trim() || pending.displayName || normalized,
        avatarUrl: pending.avatarUrl,
        profileUrl: pending.profileUrl,
        email: verifiedEmail,
        emailVerifiedAt: verifiedEmail ? new Date() : null,
        oauthAccounts: {
          create: {
            provider: pending.provider,
            providerUserId: pending.providerUserId,
            accessToken: pending.accessToken,
            refreshToken: pending.refreshToken,
            profileUrl: pending.profileUrl,
          },
        },
      },
      include: { interestedCategories: true, oauthAccounts: true },
    });

    await redeemInvite(inviteCode, user.id);
    await ensureInterestProfile(user.id);
    await prisma.oAuthPendingSignup.delete({ where: { id: pending.id } });

    const { accessToken, refreshToken } = await issueTokenPair(user.id, requestSessionMeta(req));
    setRefreshCookie(res, refreshToken);
    res.status(201).json({ user: formatUserResponse(user), token: accessToken });
  })
);

router.delete(
  '/unlink/:provider',
  requireAuth,
  asyncHandler(async (req, res) => {
    const provider = String(req.params.provider || '').toUpperCase();
    if (!['GITHUB', 'REDDIT', 'LINKEDIN', 'GOOGLE'].includes(provider)) {
      return res.status(400).json({ message: 'Unknown provider' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user._id },
      include: { interestedCategories: true, oauthAccounts: true },
    });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const linked = user.oauthAccounts || [];
    const target = linked.find((a) => a.provider === provider);
    if (!target) return res.status(404).json({ message: 'Provider is not linked' });

    const hasPassword = Boolean(user.passwordHash);
    if (!hasPassword && linked.length <= 1) {
      return res.status(400).json({
        message: 'Set a password or link another provider before unlinking your only sign-in method',
      });
    }

    await prisma.oAuthAccount.delete({ where: { id: target.id } });
    const refreshed = await prisma.user.findUnique({
      where: { id: req.user._id },
      include: { interestedCategories: true, oauthAccounts: true },
    });
    res.json({ user: formatUserResponse(refreshed) });
  })
);

module.exports = router;
