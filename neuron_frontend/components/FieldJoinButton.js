import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useI18n } from '../lib/I18nContext';
import { getMe, updateMe, getErrorMessage } from '../lib/api';
import { getStoredUser, isLoggedIn, updateStoredUser } from '../lib/auth';

function isMember(user, category) {
  if (!user || !category) return false;
  return (user.interestedCategories || []).some(
    (c) => c._id === category._id || c.slug === category.slug
  );
}

export default function FieldJoinButton({ category }) {
  const router = useRouter();
  const { t } = useI18n();
  const [joined, setJoined] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!category) return;
    const stored = getStoredUser();
    setJoined(isMember(stored, category));
    if (isLoggedIn()) {
      getMe()
        .then((user) => {
          updateStoredUser(user);
          setJoined(isMember(user, category));
        })
        .catch(() => {});
    }
  }, [category]);

  const toggle = async () => {
    if (!category) return;
    if (!isLoggedIn()) {
      router.push(`/login?next=${encodeURIComponent(router.asPath)}`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const user = getStoredUser() || (await getMe());
      const current = (user.interestedCategories || []).map((c) => c._id);
      const next = joined
        ? current.filter((id) => id !== category._id)
        : [...current.filter((id) => id !== category._id), category._id].slice(0, 12);
      const updated = await updateMe({ interestedCategoryIds: next });
      updateStoredUser(updated);
      setJoined(isMember(updated, category));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (!category) return null;

  return (
    <div className="field-join-wrap">
      <button
        type="button"
        className={`btn btn-sm${joined ? ' btn-ghost' : ' btn-primary'}`}
        onClick={toggle}
        disabled={busy}
      >
        {busy ? t('loading') : joined ? t('field_leave') : t('field_join')}
      </button>
      {error && <p className="error field-join-error">{error}</p>}
    </div>
  );
}
