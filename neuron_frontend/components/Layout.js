import Link from 'next/link';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { getStoredUser, clearAuth, isLoggedIn, userCanModerate } from '../lib/auth';
import { getSocket, disconnectSocket } from '../lib/socket';
import { useI18n } from '../lib/I18nContext';
import NotificationBell from './NotificationBell';
import ContentLocaleSwitcher from './ContentLocaleSwitcher';
import NeuronCanvas from './NeuronCanvas';
import ManifestoNav from './ManifestoNav';
import AppDock from './AppDock';
import AskFab from './AskFab';

const CHROMELESS_PATHS = ['/login', '/register', '/onboarding', '/new'];

export default function Layout({ children, title, wide, chromeless, manifesto }) {
  const router = useRouter();
  const { t } = useI18n();
  const [user, setUser] = useState(null);
  const [mounted, setMounted] = useState(false);

  const loggedIn = mounted && isLoggedIn();
  const hideChrome = chromeless || CHROMELESS_PATHS.includes(router.pathname);
  const showAppChrome = loggedIn && !hideChrome;
  const homeHref = loggedIn ? '/explore' : '/';
  const pageTitle = title ? `${title} · Neuron` : 'Neuron';

  useEffect(() => {
    setMounted(true);
    setUser(getStoredUser());
    if (isLoggedIn()) getSocket();
  }, [router.asPath]);

  useEffect(() => {
    if (!mounted || !isLoggedIn()) return;
    const u = getStoredUser();
    if (
      u &&
      !u.onboardingCompleted &&
      router.pathname !== '/onboarding' &&
      router.pathname !== '/register'
    ) {
      router.replace('/onboarding');
    }
  }, [mounted, router]);

  const handleLogout = () => {
    disconnectSocket();
    clearAuth();
    setUser(null);
    router.push('/');
  };

  if (manifesto) {
    return (
      <>
        <Head>
          <title>{pageTitle}</title>
          <meta name="theme-color" content="#050508" />
        </Head>
        <div
          className={`landing landing-app${showAppChrome ? ' landing-with-dock' : ''}`}
        >
          <div className="mesh-bg" aria-hidden />
          <NeuronCanvas density={0.12} intensity={0.9} />
          <div className="grain" aria-hidden />
          <div className={`manifesto manifesto-app${wide ? ' manifesto-wide' : ''}`}>
            <ManifestoNav variant="app" />
            <main className="manifesto-app-body">{children}</main>
          </div>
          {showAppChrome && (
            <>
              <AskFab />
              <AppDock />
            </>
          )}
        </div>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>{pageTitle}</title>
        <meta name="theme-color" content="#050508" />
      </Head>
      <div className={`app-shell${showAppChrome ? ' app-shell-with-dock' : ''}`}>
        <div className="mesh-bg mesh-bg-app" aria-hidden />
        <header className="app-header">
          <div className="app-header-inner">
            <Link href={homeHref} className="logo">
              <span className="logo-mark" aria-hidden />
              Neuron
            </Link>

            <div className="app-header-actions">
              <ContentLocaleSwitcher />
              {showAppChrome && <NotificationBell />}
              {mounted && user && userCanModerate(user) && (
                <Link
                  href="/moderation"
                  className="app-header-icon-btn"
                  title={t('nav_moderation')}
                  aria-label={t('nav_moderation')}
                >
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d="M8 1.5l1.4 2.8 3.1.5-2.25 2.2.53 3.1L8 8.9l-2.78 1.2.53-3.1L3.5 4.8l3.1-.5L8 1.5z" />
                    <path d="M3 13h10" opacity="0.7" />
                  </svg>
                </Link>
              )}
              {mounted && user ? (
                <>
                  <Link
                    href="/settings"
                    className="app-header-icon-btn"
                    title={t('nav_settings')}
                    aria-label={t('nav_settings')}
                  >
                    <svg
                      width="15"
                      height="15"
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      <circle cx="8" cy="8" r="2" />
                      <path d="M8 1.5v1.6M8 12.9v1.6M14.5 8h-1.6M3.1 8H1.5M12.6 3.4l-1.13 1.13M4.53 11.47l-1.13 1.13M12.6 12.6l-1.13-1.13M4.53 4.53 3.4 3.4" />
                    </svg>
                  </Link>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm app-header-logout"
                    onClick={handleLogout}
                  >
                    {t('nav_logout')}
                  </button>
                </>
              ) : (
                <>
                  <Link href="/login" className="nav-link">
                    {t('nav_signin')}
                  </Link>
                  <Link href="/register" className="btn btn-primary btn-sm">
                    {t('nav_join')}
                  </Link>
                </>
              )}
            </div>
          </div>
        </header>

        <main className={`page${wide ? ' page-wide' : ''}`}>{children}</main>
        <footer className="app-footer-links">
          <Link href="/privacy">Privacy</Link>
          <span aria-hidden>·</span>
          <Link href="/terms">Terms</Link>
        </footer>

        {showAppChrome && (
          <>
            <AskFab />
            <AppDock />
          </>
        )}
      </div>
    </>
  );
}
