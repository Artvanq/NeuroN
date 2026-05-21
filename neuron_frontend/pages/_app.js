import { useEffect, useState } from 'react';
import Script from 'next/script';
import { bootstrapSession } from '../lib/auth';
import { initSentryClient } from '../lib/sentry';
import { Onest } from 'next/font/google';
import { I18nProvider } from '../lib/I18nContext';
import { ContentLocaleProvider } from '../lib/ContentLocaleContext';
import SessionBoot from '../components/SessionBoot';
import ErrorBoundary from '../components/ErrorBoundary';
import CookieConsent from '../components/CookieConsent';
import '../styles/globals.css';

const sans = Onest({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
  adjustFontFallback: false,
});

export default function App({ Component, pageProps }) {
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    initSentryClient();
    bootstrapSession().finally(() => setSessionReady(true));
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  if (!sessionReady) {
    return (
      <div className={`${sans.variable} app-root`}>
        <SessionBoot />
      </div>
    );
  }

  return (
    <div className={`${sans.variable} app-root`}>
      <I18nProvider>
        <ContentLocaleProvider>
          <ErrorBoundary>
            {process.env.NEXT_PUBLIC_CAPTCHA_SITE_KEY && (
              <Script
                src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
                strategy="afterInteractive"
              />
            )}
            <Component {...pageProps} />
          </ErrorBoundary>
          <CookieConsent />
        </ContentLocaleProvider>
      </I18nProvider>
    </div>
  );
}
