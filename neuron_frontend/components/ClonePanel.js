import { useEffect, useState } from 'react';
import { useI18n } from '../lib/I18nContext';
import { getCloneInfo } from '../lib/api';

export default function ClonePanel({ owner, slug, branch }) {
  const { t } = useI18n();
  const [info, setInfo] = useState(null);

  useEffect(() => {
    if (!owner || !slug) return;
    getCloneInfo(owner, slug, branch).then(setInfo).catch(() => setInfo(null));
  }, [owner, slug, branch]);

  if (!info) return null;

  const copy = (text) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
    }
  };

  return (
    <section className="panel clone-panel">
      <h2 className="clone-panel-title">{t('clone_title')}</h2>
      <p className="muted clone-panel-desc">{info.note || t('clone_desc')}</p>
      <div className="clone-row">
        <code className="clone-url">{info.neuronRemote}</code>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => copy(info.neuronRemote)}>
          {t('clone_copy')}
        </button>
      </div>
      {info.sshRemoteUrl && (
        <div className="clone-row">
          <code className="clone-url">{info.sshRemoteUrl}</code>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => copy(info.sshRemoteUrl)}>
            {t('clone_copy')}
          </button>
        </div>
      )}
      <div className="clone-actions">
        <a href={info.zipUrl} className="btn btn-primary btn-sm" download>
          {t('clone_download_zip')}
        </a>
        {info.bundleUrl && (
          <a href={info.bundleUrl} className="btn btn-secondary btn-sm" download>
            Download git bundle
          </a>
        )}
      </div>
      {info.cloneFromHttp && (
        <div className="clone-row">
          <code className="clone-url">{info.cloneFromHttp}</code>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => copy(info.cloneFromHttp)}>
            {t('clone_copy')}
          </button>
        </div>
      )}
      {info.cloneFromBundle && (
        <div className="clone-row">
          <code className="clone-url">{info.cloneFromBundle}</code>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => copy(info.cloneFromBundle)}>
            {t('clone_copy')}
          </button>
        </div>
      )}
      {info.sshPushCommand && (
        <p className="muted clone-panel-desc">
          SSH push: <code>{info.sshPushCommand}</code> — add your SSH key in Settings
        </p>
      )}
      {info.pushCommand && (
        <p className="muted clone-panel-desc">
          Push: <code>{info.pushCommand}</code> — auth: username + PAT (<code>nrn_…</code>) or password
        </p>
      )}
    </section>
  );
}
