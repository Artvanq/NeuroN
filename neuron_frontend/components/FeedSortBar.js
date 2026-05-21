import { useI18n } from '../lib/I18nContext';
import { isLoggedIn } from '../lib/auth';

const CORE_LENSES = ['seeking', 'collision', 'hot', 'new', 'top'];

export default function FeedSortBar({ sort, onSortChange, myFieldsOnly, onMyFieldsChange, showMyFields }) {
  const { t } = useI18n();
  const sorts = isLoggedIn() ? ['for-you', ...CORE_LENSES] : CORE_LENSES;

  return (
    <div className="feed-sort-bar">
      <div className="feed-lenses" role="tablist" aria-label={t('sort_label')}>
        {sorts.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={sort === id}
            className={`lens-tab${sort === id ? ' active' : ''}`}
            onClick={() => onSortChange(id)}
          >
            {t(`sort_${id}`)}
          </button>
        ))}
      </div>
      {showMyFields && onMyFieldsChange && (
        <button
          type="button"
          className={`lens-tab lens-tab-secondary${myFieldsOnly ? ' active' : ''}`}
          onClick={() => onMyFieldsChange(!myFieldsOnly)}
        >
          {t('filter_my_fields')}
        </button>
      )}
      <p className="feed-lens-hint">{t(`sort_hint_${sort}`)}</p>
    </div>
  );
}
