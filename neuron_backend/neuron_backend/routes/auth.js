const express = require('express');
const userService = require('../services/users');
const categoryService = require('../services/categories');
const { requireAuth } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { isAllowedContentLocale } = require('../utils/contentLocales');
const {
  normalizeUsername,
  USERNAME_RE,
  formatUserResponse,
  hashPassword,
  verifyPassword,
  prisma,
} = require('../utils/authHelpers');
const {
  validateInvite,
  redeemInvite,
  createUserInvite,
  inviteRequired,
} = require('../utils/invites');
const { authRateLimit } = require('../middleware/rateLimit');
const {
  issueTokenPair,
  validateRefreshToken,
  revokeRefreshSession,
  listUserSessions,
  revokeAllUserSessions,
  setRefreshCookie,
  clearRefreshCookie,
} = require('../utils/sessions');
const { ensureInterestProfile, updateInterestTags } = require('../utils/interestProfile');
const { enqueueAnalytics } = require('../utils/analyticsOutbox');
const { createRawToken, hashToken } = require('../utils/tokenSecurity');
const { sendEmail, makeUrl } = require('../utils/email');
const { verifyCaptchaToken } = require('../utils/captcha');
const { formatBanErrorBody } = require('../utils/banSanction');
const { normalizeNotificationPreferences } = require('../utils/notificationPreferences');

const router = express.Router();

const EMAIL_VERIFY_TTL_MIN = Number(process.env.EMAIL_VERIFY_TTL_MIN || 60 * 24);
const PASSWORD_RESET_TTL_MIN = Number(process.env.PASSWORD_RESET_TTL_MIN || 60);
const REQUIRE_EMAIL_VERIFICATION = String(process.env.REQUIRE_EMAIL_VERIFICATION || '').toLowerCase() === 'true';

function normalizeEmail(email) {
  const value = String(email || '').trim().toLowerCase();
  return value || null;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ''));
}

async function issueEmailVerificationForUser(userId, email) {
  const rawToken = createRawToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + EMAIL_VERIFY_TTL_MIN * 60 * 1000);

  await prisma.emailVerificationToken.create({
    data: { userId, email, tokenHash, expiresAt },
  });

  const verifyUrl = makeUrl('/verify-email', { token: rawToken });
  await sendEmail({
    to: email,
    subject: 'Verify your email on Neuron',
    text: `Verify your email by opening this link:\n${verifyUrl}`,
    html: `<p>Verify your email by opening this link:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p>`,
  });
}

function requestSessionMeta(req) {
  return {
    ip: req.ip || req.headers['x-forwarded-for'] || null,
    userAgent: req.headers['user-agent'] || null,
  };
}

async function sendAuthResponse(req, res, user, status = 200) {
  if (user.isBanned) {
    return res.status(403).json(formatBanErrorBody(user));
  }
  if (REQUIRE_EMAIL_VERIFICATION && user.email && !user.emailVerifiedAt) {
    return res.status(403).json({
      code: 'email_verification_required',
      message: 'Verify your email before signing in',
    });
  }
  const { accessToken, refreshToken } = await issueTokenPair(user.id, requestSessionMeta(req));
  setRefreshCookie(res, refreshToken);
  const body = { user: formatUserResponse(user), token: accessToken };
  if (status === 201) {
    return res.status(201).json(body);
  }
  return res.json(body);
}

const userInclude = {
  interestedCategories: true,
  oauthAccounts: true,
};

router.get(
  '/config',
  asyncHandler(async (_req, res) => {
    res.json({
      inviteRequired: inviteRequired(),
      oauth: ['github', 'reddit', 'linkedin'],
      captchaEnabled: Boolean(process.env.CAPTCHA_SECRET),
      reportCaptchaEnabled: Boolean(process.env.REPORT_CAPTCHA_SECRET || process.env.CAPTCHA_SECRET),
    });
  })
);

router.post(
  '/register',
  authRateLimit,
  asyncHandler(async (req, res) => {
    const { username, password, displayName, inviteCode, email, captchaToken } = req.body;
    if (!username?.trim() || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }
    const captcha = await verifyCaptchaToken({
      token: captchaToken,
      remoteIp: req.ip || req.headers['x-forwarded-for'],
    });
    if (!captcha.ok) {
      return res.status(400).json({ message: captcha.message });
    }

    const normalized = normalizeUsername(username);
    if (!USERNAME_RE.test(normalized)) {
      return res.status(400).json({
        message: 'Username: 3–32 chars, lowercase letters, numbers, underscore only',
      });
    }

    const inviteCheck = await validateInvite(inviteCode);
    if (!inviteCheck.ok) {
      return res.status(400).json({ message: inviteCheck.message });
    }

    const normalizedEmail = normalizeEmail(email);
    if (normalizedEmail && !isValidEmail(normalizedEmail)) {
      return res.status(400).json({ message: 'Invalid email' });
    }

    const existing = await userService.findUserByUsername(normalized);
    if (existing) {
      return res.status(409).json({ message: 'Username already taken' });
    }
    if (normalizedEmail) {
      const emailTaken = await prisma.user.findUnique({ where: { email: normalizedEmail } });
      if (emailTaken) {
        return res.status(409).json({ message: 'Email already used' });
      }
    }

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        username: normalized,
        displayName: displayName?.trim() || normalized,
        passwordHash,
        email: normalizedEmail,
      },
      include: userInclude,
    });

    await redeemInvite(inviteCode, user.id);
    await ensureInterestProfile(user.id);
    enqueueAnalytics('user_registered', { userId: user.id, username: user.username });
    if (normalizedEmail) {
      await issueEmailVerificationForUser(user.id, normalizedEmail);
    }

    await sendAuthResponse(req, res, user, 201);
  })
);

router.post(
  '/login',
  authRateLimit,
  asyncHandler(async (req, res) => {
    const { username, password } = req.body;
    if (!username?.trim() || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }

    const row = await prisma.user.findUnique({
      where: { username: username.trim().toLowerCase() },
      include: userInclude,
    });

    if (!row) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }
    if (row.isBanned) {
      return res.status(403).json(formatBanErrorBody(row));
    }

    if (!row.passwordHash) {
      const providers = (row.oauthAccounts || []).map((a) => a.provider.toLowerCase()).join(', ');
      return res.status(401).json({
        message: providers
          ? `This account uses ${providers} sign-in`
          : 'Password sign-in is not available for this account',
      });
    }

    const valid = await verifyPassword(password, row.passwordHash);
    if (!valid) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    if (row.totpEnabledAt && row.totpSecret) {
      const totpCode = String(req.body.totpCode || '').trim();
      if (!totpCode) {
        return res.status(401).json({
          code: 'totp_required',
          message: 'Two-factor authentication code required',
        });
      }
      const { verifyTotpCode } = require('../utils/totp');
      if (!verifyTotpCode(row.totpSecret, totpCode)) {
        return res.status(401).json({ message: 'Invalid two-factor code' });
      }
    }

    enqueueAnalytics('user_login', { userId: row.id });
    await sendAuthResponse(req, res, row);
  })
);

router.post(
  '/refresh',
  authRateLimit,
  asyncHandler(async (req, res) => {
    const raw = req.cookies?.refresh_token || req.body?.refreshToken;
    if (!raw) {
      return res.status(401).json({ message: 'Refresh token required' });
    }

    const session = await validateRefreshToken(raw);
    if (!session) {
      clearRefreshCookie(res);
      return res.status(401).json({ message: 'Invalid or expired session' });
    }

    await revokeRefreshSession(session.jti);
    const row = await prisma.user.findUnique({
      where: { id: session.userId },
      include: userInclude,
    });
    if (!row) {
      return res.status(401).json({ message: 'User not found' });
    }
    if (row.isBanned) {
      clearRefreshCookie(res);
      return res.status(403).json(formatBanErrorBody(row));
    }

    await sendAuthResponse(req, res, row);
  })
);

router.post(
  '/logout',
  requireAuth,
  asyncHandler(async (req, res) => {
    const raw = req.cookies?.refresh_token;
    if (raw) {
      const session = await validateRefreshToken(raw);
      if (session?.jti) {
        await revokeRefreshSession(session.jti);
      }
    }
    clearRefreshCookie(res);
    res.json({ message: 'Logged out' });
  })
);

router.get(
  '/sessions',
  requireAuth,
  asyncHandler(async (req, res) => {
    const sessions = await listUserSessions(req.user._id);
    const currentRaw = req.cookies?.refresh_token || null;
    const current = currentRaw ? await validateRefreshToken(currentRaw) : null;

    res.json({
      sessions: sessions.map((s) => ({
        ...s,
        current: Boolean(current?.jti && current.jti === s.jti),
      })),
    });
  })
);

router.delete(
  '/sessions/:jti',
  requireAuth,
  asyncHandler(async (req, res) => {
    await revokeRefreshSession(req.params.jti, req.user._id);
    const currentRaw = req.cookies?.refresh_token || null;
    const current = currentRaw ? await validateRefreshToken(currentRaw) : null;
    if (current?.jti === req.params.jti) {
      clearRefreshCookie(res);
    }
    res.json({ message: 'Session revoked' });
  })
);

router.post(
  '/sessions/revoke-all',
  requireAuth,
  asyncHandler(async (req, res) => {
    const keepCurrent = Boolean(req.body?.keepCurrent);
    const currentRaw = req.cookies?.refresh_token || null;
    const current = currentRaw ? await validateRefreshToken(currentRaw) : null;
    await revokeAllUserSessions(req.user._id, keepCurrent ? current?.jti : null);
    if (!keepCurrent) clearRefreshCookie(res);
    res.json({ message: keepCurrent ? 'All other sessions revoked' : 'All sessions revoked' });
  })
);

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const row = await prisma.user.findUnique({
      where: { id: req.user._id },
      include: userInclude,
    });
    if (!row) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(formatUserResponse(row));
  })
);

router.get(
  '/export',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const [
      user,
      threads,
      replies,
      messages,
      notifications,
      messageRequestsSent,
      messageRequestsRecv,
      votes,
      reports,
      blocksInitiated,
      blocksReceived,
      projects,
      issues,
      pullRequests,
    ] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        include: { interestedCategories: true, oauthAccounts: true },
      }),
      prisma.thread.findMany({ where: { authorId: userId }, orderBy: { createdAt: 'desc' } }),
      prisma.reply.findMany({ where: { authorId: userId }, orderBy: { createdAt: 'desc' } }),
      prisma.message.findMany({ where: { senderId: userId }, orderBy: { createdAt: 'desc' } }),
      prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
      prisma.messageRequest.findMany({ where: { fromUserId: userId }, orderBy: { createdAt: 'desc' } }),
      prisma.messageRequest.findMany({ where: { toUserId: userId }, orderBy: { createdAt: 'desc' } }),
      prisma.vote.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
      prisma.report.findMany({ where: { reporterId: userId }, orderBy: { createdAt: 'desc' } }),
      prisma.userBlock.findMany({ where: { blockerId: userId }, orderBy: { createdAt: 'desc' } }),
      prisma.userBlock.findMany({ where: { blockedId: userId }, orderBy: { createdAt: 'desc' } }),
      prisma.project.findMany({ where: { ownerId: userId }, orderBy: { createdAt: 'desc' } }),
      prisma.issue.findMany({ where: { authorId: userId }, orderBy: { createdAt: 'desc' } }),
      prisma.pullRequest.findMany({ where: { authorId: userId }, orderBy: { createdAt: 'desc' } }),
    ]);

    res.json({
      exportedAt: new Date().toISOString(),
      user,
      content: { threads, replies, messages },
      social: { notifications, messageRequestsSent, messageRequestsRecv, votes, reports },
      graph: { blocksInitiated, blocksReceived },
      projects: { projects, issues, pullRequests },
    });
  })
);

router.delete(
  '/account',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { password, confirm } = req.body || {};
    if (String(confirm || '') !== 'DELETE') {
      return res.status(400).json({ message: 'confirm must be DELETE' });
    }

    const row = await prisma.user.findUnique({ where: { id: req.user._id } });
    if (!row) return res.status(404).json({ message: 'User not found' });

    if (row.passwordHash) {
      if (!password) return res.status(400).json({ message: 'Password is required' });
      const ok = await verifyPassword(password, row.passwordHash);
      if (!ok) return res.status(401).json({ message: 'Password is incorrect' });
    }

    await revokeAllUserSessions(req.user._id);
    await prisma.user.delete({ where: { id: req.user._id } });
    clearRefreshCookie(res);
    res.json({ message: 'Account deleted' });
  })
);

router.post(
  '/password/forgot',
  authRateLimit,
  asyncHandler(async (req, res) => {
    const identity = String(req.body?.identity || '').trim().toLowerCase();
    if (!identity) return res.status(400).json({ message: 'identity is required' });

    const where = isValidEmail(identity)
      ? { email: identity }
      : { username: identity };
    const row = await prisma.user.findUnique({
      where,
      select: { id: true, email: true },
    });

    if (row?.email) {
      const rawToken = createRawToken();
      const tokenHash = hashToken(rawToken);
      const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MIN * 60 * 1000);

      await prisma.passwordResetToken.create({
        data: { userId: row.id, tokenHash, expiresAt },
      });
      const resetUrl = makeUrl('/reset-password', { token: rawToken });
      await sendEmail({
        to: row.email,
        subject: 'Reset your Neuron password',
        text: `Reset your password with this link:\n${resetUrl}`,
        html: `<p>Reset your password with this link:</p><p><a href="${resetUrl}">${resetUrl}</a></p>`,
      });
    }

    res.json({ message: 'If the account exists, reset instructions were sent' });
  })
);

router.post(
  '/password/reset',
  authRateLimit,
  asyncHandler(async (req, res) => {
    const token = String(req.body?.token || '');
    const newPassword = String(req.body?.newPassword || '');
    if (!token || newPassword.length < 8) {
      return res.status(400).json({ message: 'token and strong newPassword are required' });
    }

    const tokenHash = hashToken(token);
    const resetRow = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });
    if (!resetRow || resetRow.usedAt || resetRow.expiresAt < new Date()) {
      return res.status(400).json({ message: 'Reset token is invalid or expired' });
    }

    await prisma.user.update({
      where: { id: resetRow.userId },
      data: { passwordHash: await hashPassword(newPassword) },
    });
    await prisma.passwordResetToken.update({
      where: { id: resetRow.id },
      data: { usedAt: new Date() },
    });
    res.json({ message: 'Password has been reset' });
  })
);

router.patch(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const {
      displayName,
      mindStatement,
      interestedCategoryIds,
      onboardingCompleted,
      contentLocale,
      profileVisibility,
      email,
      notificationPreferences,
    } = req.body;

    const updates = {};

    if (displayName !== undefined) {
      updates.displayName = String(displayName).trim() || req.user.username;
    }
    if (mindStatement !== undefined) {
      updates.mindStatement = String(mindStatement).trim().slice(0, 600);
    }
    if (onboardingCompleted !== undefined) {
      updates.onboardingCompleted = Boolean(onboardingCompleted);
    }
    if (contentLocale !== undefined) {
      const loc = String(contentLocale).trim();
      if (!isAllowedContentLocale(loc)) {
        return res.status(400).json({ message: 'Invalid content locale' });
      }
      updates.contentLocale = loc === 'original' ? '' : loc;
    }
    if (profileVisibility !== undefined) {
      const allowed = ['OPEN', 'REQUEST', 'CLOSED'];
      const v = String(profileVisibility).toUpperCase();
      if (!allowed.includes(v)) {
        return res.status(400).json({ message: 'profileVisibility must be OPEN, REQUEST, or CLOSED' });
      }
      updates.profileVisibility = v;
    }
    if (notificationPreferences !== undefined) {
      if (
        notificationPreferences !== null &&
        typeof notificationPreferences !== 'object'
      ) {
        return res.status(400).json({ message: 'notificationPreferences must be an object' });
      }
      updates.notificationPreferences = normalizeNotificationPreferences(notificationPreferences);
    }
    if (email !== undefined) {
      const normalizedEmail = normalizeEmail(email);
      if (normalizedEmail && !isValidEmail(normalizedEmail)) {
        return res.status(400).json({ message: 'Invalid email format' });
      }
      if (normalizedEmail) {
        const existingEmail = await prisma.user.findUnique({ where: { email: normalizedEmail } });
        if (existingEmail && existingEmail.id !== req.user._id) {
          return res.status(409).json({ message: 'Email already used' });
        }
      }
      updates.email = normalizedEmail;
      updates.emailVerifiedAt = null;
    }

    if (interestedCategoryIds !== undefined) {
      if (!Array.isArray(interestedCategoryIds)) {
        return res.status(400).json({ message: 'interestedCategoryIds must be an array' });
      }
      const ids = interestedCategoryIds.slice(0, 12);
      const count = await categoryService.countCategoriesByIds(ids);
      if (count !== ids.length) {
        return res.status(400).json({ message: 'Invalid category ids' });
      }
      await prisma.user.update({
        where: { id: req.user._id },
        data: {
          interestedCategories: {
            set: ids.map((id) => ({ id: String(id) })),
          },
        },
      });
    }

    const row = await prisma.user.update({
      where: { id: req.user._id },
      data: updates,
      include: userInclude,
    });

    if (interestedCategoryIds !== undefined) {
      const slugs = (row.interestedCategories || []).map((c) => c.slug);
      await updateInterestTags(req.user._id, slugs);
    }

    res.json(formatUserResponse(row));
  })
);

router.post(
  '/email/verify/request-public',
  authRateLimit,
  asyncHandler(async (req, res) => {
    const identity = String(req.body?.identity || '').trim().toLowerCase();
    if (!identity) return res.status(400).json({ message: 'identity is required' });

    const where = isValidEmail(identity) ? { email: identity } : { username: identity };
    const row = await prisma.user.findUnique({
      where,
      select: { id: true, email: true, emailVerifiedAt: true },
    });

    if (row?.email && !row.emailVerifiedAt) {
      await issueEmailVerificationForUser(row.id, row.email);
    }

    res.json({
      message: 'If the account exists and needs verification, a verification email was sent',
    });
  })
);

router.post(
  '/email/verify/request',
  requireAuth,
  asyncHandler(async (req, res) => {
    const row = await prisma.user.findUnique({
      where: { id: req.user._id },
      select: { id: true, email: true },
    });
    if (!row?.email) return res.status(400).json({ message: 'Set email in profile first' });
    await issueEmailVerificationForUser(row.id, row.email);
    res.json({ message: 'Verification email sent' });
  })
);

router.post(
  '/email/verify/confirm',
  authRateLimit,
  asyncHandler(async (req, res) => {
    const token = String(req.body?.token || '');
    if (!token) return res.status(400).json({ message: 'token is required' });

    const tokenHash = hashToken(token);
    const verifyRow = await prisma.emailVerificationToken.findUnique({
      where: { tokenHash },
    });
    if (!verifyRow || verifyRow.usedAt || verifyRow.expiresAt < new Date()) {
      return res.status(400).json({ message: 'Verification token is invalid or expired' });
    }

    await prisma.user.update({
      where: { id: verifyRow.userId },
      data: {
        email: verifyRow.email,
        emailVerifiedAt: new Date(),
      },
    });
    await prisma.emailVerificationToken.update({
      where: { id: verifyRow.id },
      data: { usedAt: new Date() },
    });
    res.json({ message: 'Email verified' });
  })
);

router.get(
  '/invites',
  requireAuth,
  asyncHandler(async (req, res) => {
    const invites = await prisma.inviteCode.findMany({
      where: { createdById: req.user._id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json(
      invites.map((i) => ({
        _id: i.id,
        code: i.code,
        used: i.usesCount >= i.maxUses,
        usesCount: i.usesCount,
        maxUses: i.maxUses,
        createdAt: i.createdAt,
      }))
    );
  })
);

router.post(
  '/invites',
  requireAuth,
  asyncHandler(async (req, res) => {
    const invite = await createUserInvite(req.user._id);
    res.status(201).json({
      _id: invite.id,
      code: invite.code,
      maxUses: invite.maxUses,
    });
  })
);

router.post(
  '/password',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ message: 'New password must be at least 8 characters' });
    }

    const row = await prisma.user.findUnique({ where: { id: req.user._id } });
    if (row.passwordHash) {
      if (!currentPassword) {
        return res.status(400).json({ message: 'Current password is required' });
      }
      const ok = await verifyPassword(currentPassword, row.passwordHash);
      if (!ok) {
        return res.status(401).json({ message: 'Current password is incorrect' });
      }
    }

    await prisma.user.update({
      where: { id: req.user._id },
      data: { passwordHash: await hashPassword(newPassword) },
    });

    res.json({ message: 'Password updated' });
  })
);

router.get(
  '/2fa/status',
  requireAuth,
  asyncHandler(async (req, res) => {
    const row = await prisma.user.findUnique({
      where: { id: req.user._id },
      select: { totpSecret: true, totpEnabledAt: true },
    });
    res.json({
      enabled: Boolean(row?.totpEnabledAt),
      pending: Boolean(row?.totpSecret && !row?.totpEnabledAt),
    });
  })
);

router.post(
  '/2fa/setup',
  requireAuth,
  asyncHandler(async (req, res) => {
    const row = await prisma.user.findUnique({ where: { id: req.user._id } });
    if (row?.totpEnabledAt) {
      return res.status(400).json({ message: 'Two-factor authentication is already enabled' });
    }
    const { generateTotpSecret, buildOtpAuthUrl } = require('../utils/totp');
    const secret = generateTotpSecret();
    await prisma.user.update({
      where: { id: req.user._id },
      data: { totpSecret: secret, totpEnabledAt: null },
    });
    res.json({
      secret,
      otpauthUrl: buildOtpAuthUrl({ secret, username: row.username }),
    });
  })
);

router.post(
  '/2fa/enable',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { code } = req.body;
    if (!code) return res.status(400).json({ message: 'Verification code is required' });
    const row = await prisma.user.findUnique({ where: { id: req.user._id } });
    if (!row?.totpSecret) {
      return res.status(400).json({ message: 'Run 2FA setup first' });
    }
    if (row.totpEnabledAt) {
      return res.status(400).json({ message: 'Two-factor authentication is already enabled' });
    }
    const { verifyTotpCode } = require('../utils/totp');
    if (!verifyTotpCode(row.totpSecret, code)) {
      return res.status(400).json({ message: 'Invalid verification code' });
    }
    await prisma.user.update({
      where: { id: req.user._id },
      data: { totpEnabledAt: new Date() },
    });
    res.json({ message: 'Two-factor authentication enabled' });
  })
);

router.post(
  '/2fa/disable',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { code, password } = req.body;
    const row = await prisma.user.findUnique({
      where: { id: req.user._id },
      include: { oauthAccounts: true },
    });
    if (!row?.totpEnabledAt) {
      return res.status(400).json({ message: 'Two-factor authentication is not enabled' });
    }
    if (row.passwordHash) {
      if (!password) return res.status(400).json({ message: 'Password is required' });
      const valid = await verifyPassword(password, row.passwordHash);
      if (!valid) return res.status(401).json({ message: 'Invalid password' });
    }
    const { verifyTotpCode } = require('../utils/totp');
    if (!verifyTotpCode(row.totpSecret, code)) {
      return res.status(400).json({ message: 'Invalid verification code' });
    }
    await prisma.user.update({
      where: { id: req.user._id },
      data: { totpSecret: null, totpEnabledAt: null },
    });
    res.json({ message: 'Two-factor authentication disabled' });
  })
);

router.get(
  '/tokens',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { listPersonalAccessTokens } = require('../utils/pat');
    const tokens = await listPersonalAccessTokens(req.user._id);
    res.json({ tokens });
  })
);

router.post(
  '/tokens',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { createPersonalAccessToken, ALL_SCOPES } = require('../utils/pat');
    const { label, scopes, expiresInDays } = req.body || {};
    const created = await createPersonalAccessToken(req.user._id, { label, scopes, expiresInDays });
    res.status(201).json({
      token: created.token,
      record: created.record,
      scopes: ALL_SCOPES,
      note: 'Copy this token now. It will not be shown again.',
    });
  })
);

router.delete(
  '/tokens/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { revokePersonalAccessToken } = require('../utils/pat');
    const result = await revokePersonalAccessToken(req.user._id, req.params.id);
    res.json(result);
  })
);

router.get(
  '/ssh-keys',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { listSshPublicKeys } = require('../utils/sshKeys');
    const keys = await listSshPublicKeys(req.user._id);
    res.json({ keys });
  })
);

router.post(
  '/ssh-keys',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { addSshPublicKey } = require('../utils/sshKeys');
    const key = await addSshPublicKey(req.user._id, req.body || {});
    res.status(201).json({ key });
  })
);

router.delete(
  '/ssh-keys/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { deleteSshPublicKey } = require('../utils/sshKeys');
    const result = await deleteSshPublicKey(req.user._id, req.params.id);
    res.json(result);
  })
);

module.exports = router;
