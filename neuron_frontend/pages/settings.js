import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import PageHeader from '../components/PageHeader';
import Loading from '../components/Loading';
import ContentLocaleSwitcher from '../components/ContentLocaleSwitcher';
import OAuthButtons from '../components/OAuthButtons';
import AvatarUpload from '../components/AvatarUpload';
import WebPushSettings from '../components/WebPushSettings';
import {
  getCategories,
  getMe,
  updateMe,
  getErrorMessage,
  getMyInvites,
  createInvite,
  getBlockedUsers,
  unblockUser,
  getIncomingMessageRequests,
  respondMessageRequest,
  requestEmailVerification,
  unlinkOAuthProvider,
  getAuthSessions,
  revokeAuthSession,
  revokeAllAuthSessions,
  exportAccountData,
  deleteAccount,
  getTwoFactorStatus,
  setupTwoFactor,
  enableTwoFactor,
  disableTwoFactor,
  getAccessTokens,
  createAccessToken,
  revokeAccessToken,
  getSshKeys,
  addSshKey,
  deleteSshKey,
  getMediaConfig,
  getHealth,
} from '../lib/api';
import { isLoggedIn, updateStoredUser, userCanModerate } from '../lib/auth';
import { useI18n } from '../lib/I18nContext';

const NOTIFICATION_OPTIONS = [
  { key: 'reply', label: 'Responses to your questions' },
  { key: 'vote', label: 'Upvotes on your threads and replies' },
  { key: 'message', label: 'Dialogue messages' },
  { key: 'message_request', label: 'Message requests' },
  { key: 'message_request_accepted', label: 'Accepted dialogue requests' },
  { key: 'message_request_declined', label: 'Declined dialogue requests' },
  { key: 'project_pr_opened', label: 'Pull requests on your projects' },
  { key: 'project_pr_review', label: 'Reviews on your pull requests' },
  { key: 'project_issue_opened', label: 'Issues on your projects' },
  { key: 'project_issue_comment', label: 'Comments on your project issues' },
  { key: 'project_ci_success', label: 'CI passed on your projects' },
  { key: 'project_ci_failure', label: 'CI failed on your projects' },
  { key: 'synthesis_update', label: 'Synthesis updates on threads you contribute to' },
  { key: 'moderation_warning', label: 'Moderation warnings' },
];

const DEFAULT_NOTIFICATION_PREFERENCES = {
  inApp: {
    reply: true,
    message: true,
    message_request: true,
    message_request_accepted: true,
    project_pr_opened: true,
    project_pr_review: true,
    project_issue_opened: true,
    project_issue_comment: true,
    moderation_warning: true,
    digest: true,
  },
  email: {
    reply: true,
    message: true,
    message_request: true,
    message_request_accepted: true,
    project_pr_opened: true,
    project_pr_review: true,
    project_issue_opened: true,
    project_issue_comment: true,
    moderation_warning: true,
    digest: true,
  },
  push: {
    reply: true,
    message: true,
    message_request: true,
    message_request_accepted: true,
    project_pr_opened: true,
    project_pr_review: true,
    project_issue_opened: true,
    project_issue_comment: true,
    moderation_warning: true,
    digest: false,
  },
};

export default function SettingsPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [categories, setCategories] = useState([]);
  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [email, setEmail] = useState('');
  const [emailVerified, setEmailVerified] = useState(false);
  const [mindStatement, setMindStatement] = useState('');
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);
  const [invites, setInvites] = useState([]);
  const [invitesLeft, setInvitesLeft] = useState(0);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [linkedProviders, setLinkedProviders] = useState([]);
  const [profileVisibility, setProfileVisibility] = useState('OPEN');
  const [blocked, setBlocked] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [twoFactor, setTwoFactor] = useState({ enabled: false, pending: false });
  const [totpSetup, setTotpSetup] = useState(null);
  const [totpCode, setTotpCode] = useState('');
  const [totpDisablePassword, setTotpDisablePassword] = useState('');
  const [accessTokens, setAccessTokens] = useState([]);
  const [tokenLabel, setTokenLabel] = useState('');
  const [createdToken, setCreatedToken] = useState('');
  const [sshKeys, setSshKeys] = useState([]);
  const [sshKeyLabel, setSshKeyLabel] = useState('');
  const [sshPublicKey, setSshPublicKey] = useState('');
  const [banInfo, setBanInfo] = useState({ isBanned: false, bannedReason: '', bannedAt: null });
  const [canModerate, setCanModerate] = useState(false);
  const [mediaEnabled, setMediaEnabled] = useState(false);
  const [notificationPreferences, setNotificationPreferences] = useState(
    DEFAULT_NOTIFICATION_PREFERENCES
  );
  const [featureFlags, setFeatureFlags] = useState([]);

  useEffect(() => {
    getHealth()
      .then((h) => setFeatureFlags(Array.isArray(h.featureFlags) ? h.featureFlags : []))
      .catch(() => setFeatureFlags([]));
  }, []);

  useEffect(() => {
    getMediaConfig()
      .then((cfg) => setMediaEnabled(Boolean(cfg.enabled)))
      .catch(() => setMediaEnabled(false));
  }, []);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace('/login?next=/settings');
      return;
    }
    Promise.all([
      getMe(),
      getCategories(),
      getMyInvites().catch(() => []),
      getBlockedUsers().catch(() => []),
      getIncomingMessageRequests().catch(() => []),
      getAuthSessions().catch(() => ({ sessions: [] })),
      getTwoFactorStatus().catch(() => ({ enabled: false, pending: false })),
      getAccessTokens().catch(() => ({ tokens: [] })),
      getSshKeys().catch(() => ({ keys: [] })),
    ])
      .then(([user, cats, inv, blockedList, requests, sessionData, tfaStatus, tokenData, sshData]) => {
        setDisplayName(user.displayName || '');
        setAvatarUrl(user.avatarUrl || null);
        setEmail(user.email || '');
        setEmailVerified(Boolean(user.emailVerified));
        setMindStatement(user.mindStatement || '');
        setSelected((user.interestedCategories || []).map((c) => c._id));
        setCategories(cats);
        setInvites(inv);
        setInvitesLeft(user.invitesRemaining ?? 0);
        setLinkedProviders(user.linkedProviders || []);
        setProfileVisibility(user.profileVisibility || 'OPEN');
        setBlocked(blockedList);
        setIncomingRequests(requests);
        setSessions(sessionData.sessions || []);
        setTwoFactor(tfaStatus);
        setAccessTokens(tokenData.tokens || []);
        setSshKeys(sshData.keys || []);
        setCanModerate(userCanModerate(user));
        setNotificationPreferences({
          inApp: {
            ...DEFAULT_NOTIFICATION_PREFERENCES.inApp,
            ...(user.notificationPreferences?.inApp || {}),
          },
          email: {
            ...DEFAULT_NOTIFICATION_PREFERENCES.email,
            ...(user.notificationPreferences?.email || {}),
          },
          push: {
            ...DEFAULT_NOTIFICATION_PREFERENCES.push,
            ...(user.notificationPreferences?.push || {}),
          },
        });
        setBanInfo({
          isBanned: Boolean(user.isBanned),
          bannedReason: user.bannedReason || '',
          bannedAt: user.bannedAt || null,
        });
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [router]);

  const toggleCategory = (id) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id].slice(0, 12)
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSaved(false);
    try {
      const user = await updateMe({
        displayName: displayName.trim(),
        email: email.trim(),
        mindStatement: mindStatement.trim(),
        interestedCategoryIds: selected,
        profileVisibility,
        notificationPreferences,
      });
      updateStoredUser(user);
      setEmailVerified(Boolean(user.emailVerified));
      setBanInfo({
        isBanned: Boolean(user.isBanned),
        bannedReason: user.bannedReason || '',
        bannedAt: user.bannedAt || null,
      });
      setSaved(true);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Layout title={t('nav_settings')}>
        <Loading label={t('loading')} />
      </Layout>
    );
  }

  return (
    <Layout title={t('nav_settings')}>
      <PageHeader
        eyebrow={t('settings_eyebrow')}
        title={t('settings_title')}
        description={t('settings_desc')}
      />

      {error && <p className="error">{error}</p>}
      {saved && <p className="success-banner">{t('settings_saved')}</p>}
      {banInfo.isBanned && (
        <section className="panel sanction-panel">
          <h2>Account sanction</h2>
          <p className="error">
            Your account is banned.
            {banInfo.bannedReason ? ` Reason: ${banInfo.bannedReason}` : ''}
            {banInfo.bannedAt ? ` (since ${new Date(banInfo.bannedAt).toLocaleString()})` : ''}
          </p>
          <Link href="/sanctions/appeal" className="btn btn-ghost btn-sm">
            View sanction details and appeal
          </Link>
        </section>
      )}

      <form onSubmit={handleSubmit}>
        {mediaEnabled && (
          <section className="panel">
            <h2>Profile photo</h2>
            <AvatarUpload
              avatarUrl={avatarUrl}
              onUpdated={(user) => {
                setAvatarUrl(user.avatarUrl || null);
                updateStoredUser(user);
                setSaved(true);
              }}
            />
          </section>
        )}
        <section className="panel">
          <label className="form">
            {t('settings_display_name')}
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </label>
          <label className="form">
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </label>
          <p className="muted">
            {email
              ? emailVerified
                ? 'Email verified'
                : 'Email is not verified yet'
              : 'Add email to enable password recovery and notifications'}
          </p>
          {email && !emailVerified && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={async () => {
                try {
                  await requestEmailVerification();
                  setSaved(true);
                } catch (err) {
                  setError(getErrorMessage(err));
                }
              }}
            >
              Send verification email
            </button>
          )}
          <label className="form">
            {t('settings_mind')}
            <textarea
              value={mindStatement}
              onChange={(e) => setMindStatement(e.target.value)}
              rows={4}
              maxLength={600}
            />
          </label>
        </section>

        <section className="panel" id="requests">
          <h2>Privacy &amp; messages</h2>
          <p className="muted">
            Three profile modes: open (anyone can write), by request (introduction first), closed (no messages).
          </p>
          <fieldset className="visibility-options">
            <label className="visibility-option">
              <input
                type="radio"
                name="visibility"
                value="OPEN"
                checked={profileVisibility === 'OPEN'}
                onChange={() => setProfileVisibility('OPEN')}
              />
              <span>
                <strong>Open</strong> — profile and direct messages
              </span>
            </label>
            <label className="visibility-option">
              <input
                type="radio"
                name="visibility"
                value="REQUEST"
                checked={profileVisibility === 'REQUEST'}
                onChange={() => setProfileVisibility('REQUEST')}
              />
              <span>
                <strong>By request</strong> — profile visible, dialogue after approval
              </span>
            </label>
            <label className="visibility-option">
              <input
                type="radio"
                name="visibility"
                value="CLOSED"
                checked={profileVisibility === 'CLOSED'}
                onChange={() => setProfileVisibility('CLOSED')}
              />
              <span>
                <strong>Closed</strong> — hidden questions, no incoming messages
              </span>
            </label>
          </fieldset>

          {incomingRequests.length > 0 && (
            <div className="incoming-requests">
              <h3>Pending dialogue requests</h3>
              <ul>
                {incomingRequests.map((r) => (
                  <li key={r._id} className="request-item panel-inset">
                    <p>
                      <strong>@{r.fromUser?.username}</strong>
                    </p>
                    <p className="muted">{r.body}</p>
                    <div className="emergence-actions">
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={async () => {
                          try {
                            const res = await respondMessageRequest(r._id, 'ACCEPTED');
                            setIncomingRequests((prev) => prev.filter((x) => x._id !== r._id));
                            if (res.conversation?._id) {
                              router.push(`/messages/${res.conversation._id}`);
                            }
                          } catch (err) {
                            setError(getErrorMessage(err));
                          }
                        }}
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={async () => {
                          try {
                            await respondMessageRequest(r._id, 'DECLINED');
                            setIncomingRequests((prev) => prev.filter((x) => x._id !== r._id));
                          } catch (err) {
                            setError(getErrorMessage(err));
                          }
                        }}
                      >
                        Decline
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section className="panel">
          <h2>Browser push</h2>
          <WebPushSettings />
        </section>

        <section className="panel">
          <h2>Notification preferences</h2>
          <p className="muted">
            Choose what you receive in the app, by email (verified email), and via browser push.
          </p>
          <div className="notification-prefs-grid">
            <div>
              <h3 className="notification-prefs-heading">In-app</h3>
              <ul className="notification-prefs-list">
                {NOTIFICATION_OPTIONS.map((opt) => (
                  <li key={`in-${opt.key}`}>
                    <label className="notification-pref-row">
                      <input
                        type="checkbox"
                        checked={notificationPreferences.inApp?.[opt.key] !== false}
                        onChange={(e) =>
                          setNotificationPreferences((prev) => ({
                            ...prev,
                            inApp: { ...prev.inApp, [opt.key]: e.target.checked },
                          }))
                        }
                      />
                      <span>{opt.label}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="notification-prefs-heading">Email</h3>
              <ul className="notification-prefs-list">
                {NOTIFICATION_OPTIONS.map((opt) => (
                  <li key={`em-${opt.key}`}>
                    <label className="notification-pref-row">
                      <input
                        type="checkbox"
                        checked={notificationPreferences.email?.[opt.key] !== false}
                        onChange={(e) =>
                          setNotificationPreferences((prev) => ({
                            ...prev,
                            email: { ...prev.email, [opt.key]: e.target.checked },
                          }))
                        }
                      />
                      <span>{opt.label}</span>
                    </label>
                  </li>
                ))}
                <li>
                  <label className="notification-pref-row">
                    <input
                      type="checkbox"
                      checked={notificationPreferences.email?.digest !== false}
                      onChange={(e) =>
                        setNotificationPreferences((prev) => ({
                          ...prev,
                          email: { ...prev.email, digest: e.target.checked },
                        }))
                      }
                    />
                    <span>Daily digest summary</span>
                  </label>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="notification-prefs-heading">Browser push</h3>
              <ul className="notification-prefs-list">
                {NOTIFICATION_OPTIONS.map((opt) => (
                  <li key={`push-${opt.key}`}>
                    <label className="notification-pref-row">
                      <input
                        type="checkbox"
                        checked={notificationPreferences.push?.[opt.key] !== false}
                        onChange={(e) =>
                          setNotificationPreferences((prev) => ({
                            ...prev,
                            push: { ...prev.push, [opt.key]: e.target.checked },
                          }))
                        }
                      />
                      <span>{opt.label}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="panel">
          <h2>Blocked people</h2>
          <p className="muted">Blocked users cannot message you or see your content.</p>
          {blocked.length === 0 ? (
            <p className="muted">No blocks yet.</p>
          ) : (
            <ul className="blocked-list">
              {blocked.map((u) => (
                <li key={u._id}>
                  @{u.username}
                  <button
                    type="button"
                    className="link-btn"
                    onClick={async () => {
                      await unblockUser(u._id);
                      setBlocked((prev) => prev.filter((x) => x._id !== u._id));
                    }}
                  >
                    Unblock
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {canModerate && (
          <section className="panel">
            <h2>Moderation</h2>
            <p className="muted">Review reports and moderation audit log.</p>
            <a className="btn btn-ghost btn-sm" href="/moderation">
              Open moderation inbox
            </a>
          </section>
        )}

        <section className="panel">
          <h2>Connected accounts</h2>
          <p className="muted">
            Link GitHub, Reddit, LinkedIn, or Google — like signing in on those platforms, but your Neuron identity stays one username.
          </p>
          {linkedProviders.length > 0 && (
            <p className="linked-providers">
              Linked: {linkedProviders.join(', ')}
            </p>
          )}
          {linkedProviders.length > 0 && (
            <div className="emergence-actions">
              {linkedProviders.map((provider) => (
                <button
                  key={provider}
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={async () => {
                    try {
                      const result = await unlinkOAuthProvider(provider);
                      updateStoredUser(result.user);
                      setLinkedProviders(result.user.linkedProviders || []);
                    } catch (err) {
                      setError(getErrorMessage(err));
                    }
                  }}
                >
                  Unlink {provider}
                </button>
              ))}
            </div>
          )}
          <OAuthButtons link />
        </section>

        <section className="panel">
          <h2>Two-factor authentication</h2>
          <p className="muted">
            Protect your account with a TOTP authenticator app (Google Authenticator, 1Password, etc.).
          </p>
          {twoFactor.enabled ? (
            <div className="form">
              <p>Two-factor authentication is enabled.</p>
              <label>
                Authenticator code
                <input
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value)}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                />
              </label>
              <label>
                Password (if you sign in with password)
                <input
                  type="password"
                  value={totpDisablePassword}
                  onChange={(e) => setTotpDisablePassword(e.target.value)}
                  autoComplete="current-password"
                />
              </label>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={async () => {
                  try {
                    await disableTwoFactor({
                      code: totpCode,
                      password: totpDisablePassword || undefined,
                    });
                    setTotpCode('');
                    setTotpDisablePassword('');
                    setTotpSetup(null);
                    setTwoFactor({ enabled: false, pending: false });
                  } catch (err) {
                    setError(getErrorMessage(err));
                  }
                }}
              >
                Disable 2FA
              </button>
            </div>
          ) : totpSetup ? (
            <div className="form">
              <p className="muted">Scan this secret in your authenticator app, then enter a code to confirm.</p>
              <code>{totpSetup.secret}</code>
              {totpSetup.otpauthUrl && (
                <p className="muted">
                  <a href={totpSetup.otpauthUrl}>Open in authenticator</a>
                </p>
              )}
              <label>
                Verification code
                <input
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value)}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                />
              </label>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={async () => {
                  try {
                    await enableTwoFactor(totpCode);
                    setTotpCode('');
                    setTotpSetup(null);
                    setTwoFactor({ enabled: true, pending: false });
                  } catch (err) {
                    setError(getErrorMessage(err));
                  }
                }}
              >
                Enable 2FA
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={async () => {
                try {
                  const setup = await setupTwoFactor();
                  setTotpSetup(setup);
                  setTwoFactor({ enabled: false, pending: true });
                } catch (err) {
                  setError(getErrorMessage(err));
                }
              }}
            >
              Set up authenticator
            </button>
          )}
        </section>

        <section className="panel">
          <h2>Personal access tokens</h2>
          <p className="muted">
            Tokens for git push and API access. Use as HTTP Basic password or Bearer header. Prefix:{' '}
            <code>nrn_</code>
          </p>
          {createdToken && (
            <div className="form">
              <p className="muted">Copy this token now — it will not be shown again.</p>
              <code>{createdToken}</code>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCreatedToken('')}>
                Dismiss
              </button>
            </div>
          )}
          <div className="form">
            <label>
              Label
              <input value={tokenLabel} onChange={(e) => setTokenLabel(e.target.value)} placeholder="CI / laptop" />
            </label>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={async () => {
                try {
                  const result = await createAccessToken({
                    label: tokenLabel,
                    scopes: ['git:read', 'git:write'],
                  });
                  setCreatedToken(result.token);
                  setTokenLabel('');
                  const refreshed = await getAccessTokens();
                  setAccessTokens(refreshed.tokens || []);
                } catch (err) {
                  setError(getErrorMessage(err));
                }
              }}
            >
              Generate token
            </button>
          </div>
          {accessTokens.length === 0 ? (
            <p className="muted">No tokens yet.</p>
          ) : (
            <ul className="invite-list">
              {accessTokens.map((t) => (
                <li key={t.id}>
                  {t.label} · {t.tokenPrefix}… · {t.scopes?.join(', ')}
                  <button
                    type="button"
                    className="link-btn"
                    onClick={async () => {
                      try {
                        await revokeAccessToken(t.id);
                        const refreshed = await getAccessTokens();
                        setAccessTokens(refreshed.tokens || []);
                      } catch (err) {
                        setError(getErrorMessage(err));
                      }
                    }}
                  >
                    Revoke
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel">
          <h2>SSH keys</h2>
          <p className="muted">Used for git clone/push over SSH. Paste your public key (ssh-ed25519 or ssh-rsa).</p>
          <div className="form">
            <label>
              Label
              <input
                value={sshKeyLabel}
                onChange={(e) => setSshKeyLabel(e.target.value)}
                placeholder="Work laptop"
              />
            </label>
            <label>
              Public key
              <textarea
                value={sshPublicKey}
                onChange={(e) => setSshPublicKey(e.target.value)}
                rows={3}
                placeholder="ssh-ed25519 AAAA… comment"
              />
            </label>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={async () => {
                try {
                  await addSshKey({ label: sshKeyLabel, publicKey: sshPublicKey });
                  setSshKeyLabel('');
                  setSshPublicKey('');
                  const refreshed = await getSshKeys();
                  setSshKeys(refreshed.keys || []);
                } catch (err) {
                  setError(getErrorMessage(err));
                }
              }}
            >
              Add SSH key
            </button>
          </div>
          {sshKeys.length === 0 ? (
            <p className="muted">No SSH keys yet.</p>
          ) : (
            <ul className="invite-list">
              {sshKeys.map((k) => (
                <li key={k.id}>
                  {k.label} · {k.fingerprint}
                  <button
                    type="button"
                    className="link-btn"
                    onClick={async () => {
                      try {
                        await deleteSshKey(k.id);
                        const refreshed = await getSshKeys();
                        setSshKeys(refreshed.keys || []);
                      } catch (err) {
                        setError(getErrorMessage(err));
                      }
                    }}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel">
          <h2>Security sessions</h2>
          <p className="muted">Manage active refresh sessions across your devices.</p>
          {sessions.length === 0 ? (
            <p className="muted">No active sessions.</p>
          ) : (
            <ul className="invite-list">
              {sessions.map((s) => (
                <li key={s.jti}>
                  {s.current ? 'Current' : 'Session'} · {s.createdAt || 'unknown'} · {s.ip || 'ip n/a'}
                  {!s.current && (
                    <button
                      type="button"
                      className="link-btn"
                      onClick={async () => {
                        try {
                          await revokeAuthSession(s.jti);
                          const refreshed = await getAuthSessions();
                          setSessions(refreshed.sessions || []);
                        } catch (err) {
                          setError(getErrorMessage(err));
                        }
                      }}
                    >
                      Revoke
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={async () => {
              try {
                await revokeAllAuthSessions({ keepCurrent: true });
                const refreshed = await getAuthSessions();
                setSessions(refreshed.sessions || []);
              } catch (err) {
                setError(getErrorMessage(err));
              }
            }}
          >
            Revoke all other sessions
          </button>
        </section>

        <section className="panel">
          <h2>Account data</h2>
          <p className="muted">Export your data or permanently delete your account.</p>
          <div className="emergence-actions">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={async () => {
                try {
                  const payload = await exportAccountData();
                  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `neuron-export-${Date.now()}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                } catch (err) {
                  setError(getErrorMessage(err));
                }
              }}
            >
              Export data (JSON)
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={async () => {
                const confirmation = window.prompt('Type DELETE to confirm account deletion');
                if (confirmation !== 'DELETE') return;
                const password = window.prompt('Enter your password (leave empty for OAuth-only accounts)') || '';
                try {
                  await deleteAccount({ confirm: 'DELETE', password });
                  router.push('/register');
                } catch (err) {
                  setError(getErrorMessage(err));
                }
              }}
            >
              Delete account
            </button>
          </div>
        </section>

        <section className="panel">
          <h2>Server feature flags</h2>
          <p className="muted">
            Enabled via <code>FEATURE_FLAGS</code> on the API host (read-only). Use for staged rollouts.
          </p>
          {featureFlags.length === 0 ? (
            <p className="muted">No flags enabled on this server.</p>
          ) : (
            <ul className="invite-list">
              {featureFlags.map((flag) => (
                <li key={flag}>
                  <code>{flag}</code>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel">
          <h2>Invite minds</h2>
          <p className="muted">
            You have {invitesLeft} invite{invitesLeft === 1 ? '' : 's'} left. Share a code — no email spam.
          </p>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={inviteLoading || invitesLeft <= 0}
            onClick={async () => {
              setInviteLoading(true);
              try {
                const inv = await createInvite();
                setInvites((prev) => [inv, ...prev]);
                setInvitesLeft((n) => Math.max(0, n - 1));
              } catch (err) {
                setError(getErrorMessage(err));
              } finally {
                setInviteLoading(false);
              }
            }}
          >
            {inviteLoading ? 'Generating…' : 'Generate invite code'}
          </button>
          {invites.length > 0 && (
            <ul className="invite-list">
              {invites.map((i) => (
                <li key={i._id}>
                  <code>{i.code}</code>
                  {i.used ? ' · used' : ' · available'}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel settings-content-locale">
          <h2>{t('settings_content_locale')}</h2>
          <p className="muted">{t('settings_content_locale_desc')}</p>
          <ContentLocaleSwitcher showLabel />
        </section>

        <section className="panel">
          <h2>{t('settings_fields')}</h2>
          <ul className="onboarding-fields">
            {categories.map((c) => {
              const active = selected.includes(c._id);
              return (
                <li key={c._id}>
                  <button
                    type="button"
                    className={`field-chip${active ? ' active' : ''}`}
                    style={active ? { borderColor: c.color, color: c.color } : {}}
                    onClick={() => toggleCategory(c._id)}
                  >
                    {c.icon} {c.name}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? t('loading') : t('settings_save')}
        </button>
      </form>
    </Layout>
  );
}
