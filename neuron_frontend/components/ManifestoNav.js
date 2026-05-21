import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { getStoredUser, clearAuth, isLoggedIn } from '../lib/auth';
import { disconnectSocket } from '../lib/socket';
import { useI18n } from '../lib/I18nContext';
import ContentLocaleSwitcher from './ContentLocaleSwitcher';
import NotificationBell from './NotificationBell';

export default function ManifestoNav({ variant = 'landing', sections = [] }) {
  const router = useRouter();
  const { t } = useI18n();
  const [user, setUser] = useState(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setUser(getStoredUser());
  }, [router.asPath]);

  const loggedIn = mounted && isLoggedIn();
  const logoHref = loggedIn ? '/explore' : '/';

  const handleLogout = () => {
    disconnectSocket();
    clearAuth();
    setUser(null);
    router.push('/');
  };

  return (
    <nav className="manifesto-nav">
      <Link href={logoHref} className="manifesto-logo">
        Neuron
      </Link>

      {variant === 'landing' && sections.length > 0 && (
        <div className="manifesto-nav-sections" role="navigation" aria-label="Manifesto sections">
          {sections.map((s) => (
            <a key={s.id} href={`#${s.id}`}>
              {t(s.labelKey)}
            </a>
          ))}
        </div>
      )}

      {variant === 'app' && (
        <div className="manifesto-nav-sections manifesto-nav-app" role="navigation" aria-label="App">
          <Link
            href="/explore"
            className={router.pathname === '/explore' ? 'active' : undefined}
            aria-current={router.pathname === '/explore' ? 'page' : undefined}
          >
            {t('dock_resonance')}
          </Link>
          <Link href="/" className={router.pathname === '/' ? 'active' : undefined}>
            {t('manifest_nav_manifesto')}
          </Link>
        </div>
      )}

      <div className="manifesto-nav-actions">
        <ContentLocaleSwitcher />
        {variant === 'landing' && (
          <>
            <Link href="/explore">{t('manifest_enter')}</Link>
            <Link href="/register" className="manifesto-cta">
              {t('manifest_join')}
            </Link>
          </>
        )}
        {variant === 'app' && mounted && (
          <>
            {loggedIn && <NotificationBell />}
            {user ? (
              <>
                <Link href="/settings" className="manifesto-nav-icon" title={t('nav_settings')} aria-label={t('nav_settings')}>
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <circle cx="8" cy="8" r="2" />
                    <path d="M8 1.5v1.6M8 12.9v1.6M14.5 8h-1.6M3.1 8H1.5M12.6 3.4l-1.13 1.13M4.53 11.47l-1.13 1.13M12.6 12.6l-1.13-1.13M4.53 4.53 3.4 3.4" />
                  </svg>
                </Link>
                <button type="button" className="manifesto-nav-ghost-btn" onClick={handleLogout}>
                  {t('nav_logout')}
                </button>
              </>
            ) : (
              <>
                <Link href="/login">{t('manifest_signin')}</Link>
                <Link href="/register" className="manifesto-cta">
                  {t('manifest_join')}
                </Link>
              </>
            )}
          </>
        )}
      </div>
    </nav>
  );
}
