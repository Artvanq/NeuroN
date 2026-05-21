import { useEffect, useState } from 'react';
import Link from 'next/link';

const KEY = 'neuron_cookie_consent_v1';

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const accepted = localStorage.getItem(KEY);
      if (!accepted) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  return (
    <div className="cookie-consent" role="dialog" aria-live="polite">
      <p>
        We use essential cookies for auth and session security. By continuing, you accept our{' '}
        <Link href="/privacy">Privacy Policy</Link> and <Link href="/terms">Terms of Service</Link>.
      </p>
      <button
        type="button"
        className="btn btn-primary btn-sm"
        onClick={() => {
          try {
            localStorage.setItem(KEY, 'accepted');
          } catch {
            /* ignore */
          }
          setVisible(false);
        }}
      >
        Accept
      </button>
    </div>
  );
}
