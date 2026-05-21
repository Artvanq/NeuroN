import { useEffect, useMemo, useState } from 'react';
import { createReport, getAuthConfig, getErrorMessage } from '../lib/api';
import { isLoggedIn } from '../lib/auth';
import { useI18n } from '../lib/I18nContext';
import { useRouter } from 'next/router';

export default function ReportButton({ targetType, targetId }) {
  const router = useRouter();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);
  const [reportCaptchaEnabled, setReportCaptchaEnabled] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaReady, setCaptchaReady] = useState(false);
  const captchaId = useMemo(
    () => `report-captcha-${String(targetType)}-${String(targetId).replace(/[^a-zA-Z0-9_-]/g, '-')}`,
    [targetType, targetId]
  );

  useEffect(() => {
    getAuthConfig()
      .then((cfg) => setReportCaptchaEnabled(Boolean(cfg.reportCaptchaEnabled)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!reportCaptchaEnabled) return;
    let active = true;
    const tick = () => {
      if (!active) return;
      if (globalThis?.turnstile) {
        setCaptchaReady(true);
        return;
      }
      setTimeout(tick, 300);
    };
    tick();
    return () => {
      active = false;
    };
  }, [reportCaptchaEnabled]);

  useEffect(() => {
    if (!open || !reportCaptchaEnabled || !captchaReady) return;
    const siteKey = process.env.NEXT_PUBLIC_CAPTCHA_SITE_KEY;
    const turnstile = globalThis?.turnstile;
    if (!siteKey || !turnstile) return;

    const container = document.getElementById(captchaId);
    if (!container || container.dataset.rendered === '1') return;
    container.dataset.rendered = '1';
    turnstile.render(`#${captchaId}`, {
      sitekey: siteKey,
      callback: (token) => setCaptchaToken(token),
      'expired-callback': () => setCaptchaToken(''),
      'error-callback': () => setCaptchaToken(''),
      theme: 'dark',
    });
  }, [open, reportCaptchaEnabled, captchaReady, captchaId]);

  const submit = async (e) => {
    e.preventDefault();
    if (!isLoggedIn()) {
      router.push('/login');
      return;
    }
    setError(null);
    try {
      await createReport({ targetType, targetId, reason, captchaToken });
      setDone(true);
      setOpen(false);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  if (done) {
    return <span className="muted report-done">Reported</span>;
  }

  return (
    <div className="report-wrap">
      <button type="button" className="link-btn report-btn" onClick={() => setOpen(true)}>
        {t('report')}
      </button>
      {open && (
        <>
          <button
            type="button"
            className="notif-backdrop"
            aria-label="Close"
            onClick={() => setOpen(false)}
          />
          <form className="report-modal panel" onSubmit={submit}>
            <h3>{t('report')}</h3>
            {error && <p className="error">{error}</p>}
            <label>
              {t('report_reason')}
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                required
              />
            </label>
            {reportCaptchaEnabled && (
              <div>
                <div id={captchaId} />
                <span className="field-hint">Complete captcha before sending report.</span>
              </div>
            )}
            <div className="emergence-actions">
              <button
                type="submit"
                className="btn btn-primary btn-sm"
                disabled={reportCaptchaEnabled && !captchaToken}
              >
                {t('report_submit')}
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setOpen(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}
