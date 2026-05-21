import { useEffect, useState } from 'react';
import {
  getPushConfig,
  isWebPushSupported,
  listPushSubscriptions,
  subscribeWebPush,
  unsubscribeWebPush,
} from '../lib/webPush';
import { getErrorMessage } from '../lib/api';

export default function WebPushSettings() {
  const [supported, setSupported] = useState(false);
  const [serverEnabled, setServerEnabled] = useState(false);
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const config = await getPushConfig();
      setServerEnabled(Boolean(config.enabled && config.publicKey));
      if (config.enabled) {
        const subs = await listPushSubscriptions().catch(() => []);
        setSubscriptions(subs);
      } else {
        setSubscriptions([]);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setSupported(isWebPushSupported());
    refresh();
  }, []);

  const subscribed = subscriptions.length > 0;

  if (!supported) {
    return <p className="muted">Your browser does not support web push notifications.</p>;
  }

  if (loading) {
    return <p className="muted">Checking push configuration…</p>;
  }

  if (!serverEnabled) {
    return (
      <p className="muted">
        Push is not configured on this server (VAPID keys). In-app and email notifications still
        work.
      </p>
    );
  }

  return (
    <div className="web-push-settings">
      {error && <p className="error">{error}</p>}
      {message && <p className="success-banner">{message}</p>}
      <p className="muted">
        {subscribed
          ? `This device is subscribed (${subscriptions.length} endpoint${subscriptions.length === 1 ? '' : 's'} on your account).`
          : 'Enable browser notifications for replies, messages, and project updates.'}
      </p>
      <div className="emergence-actions">
        {!subscribed ? (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              setMessage(null);
              try {
                await subscribeWebPush();
                setMessage('Browser notifications enabled for this device.');
                await refresh();
              } catch (err) {
                setError(getErrorMessage(err));
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? 'Enabling…' : 'Enable browser notifications'}
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              setMessage(null);
              try {
                await unsubscribeWebPush();
                setMessage('Browser notifications disabled on this device.');
                await refresh();
              } catch (err) {
                setError(getErrorMessage(err));
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? 'Disabling…' : 'Disable on this device'}
          </button>
        )}
      </div>
    </div>
  );
}
