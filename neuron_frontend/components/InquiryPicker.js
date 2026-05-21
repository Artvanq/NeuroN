import { useEffect, useState } from 'react';
import { getInquiries } from '../lib/api';
import { useI18n } from '../lib/I18nContext';

const MAX = 5;

export default function InquiryPicker({ value = [], onChange, disabled }) {
  const { t } = useI18n();
  const [catalog, setCatalog] = useState([]);
  const [custom, setCustom] = useState('');

  useEffect(() => {
    getInquiries({ limit: 60 })
      .then((rows) => setCatalog(Array.isArray(rows) ? rows : []))
      .catch(() => setCatalog([]));
  }, []);

  const toggle = (slug) => {
    if (disabled) return;
    if (value.includes(slug)) {
      onChange(value.filter((s) => s !== slug));
      return;
    }
    if (value.length >= MAX) return;
    onChange([...value, slug]);
  };

  const addCustom = () => {
    const slug = custom
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    if (!slug || value.includes(slug) || value.length >= MAX) return;
    onChange([...value, slug]);
    setCustom('');
  };

  return (
    <div className="inquiry-picker panel-inset">
      <p className="muted inquiry-picker-label">{t('inquiries_picker_label')}</p>
      <div className="inquiry-picker-chips">
        {catalog.map((inq) => (
          <button
            key={inq.slug}
            type="button"
            className={`field-chip inquiry-chip${value.includes(inq.slug) ? ' active' : ''}`}
            onClick={() => toggle(inq.slug)}
            disabled={disabled || (!value.includes(inq.slug) && value.length >= MAX)}
          >
            {inq.name}
          </button>
        ))}
      </div>
      <div className="inquiry-picker-custom">
        <input
          type="text"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder={t('inquiries_custom_placeholder')}
          disabled={disabled || value.length >= MAX}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addCustom();
            }
          }}
        />
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={addCustom}
          disabled={disabled || value.length >= MAX || !custom.trim()}
        >
          {t('inquiries_add')}
        </button>
      </div>
      {value.length > 0 && (
        <p className="muted inquiry-picker-selected">
          {t('inquiries_selected')}: {value.join(', ')}
        </p>
      )}
    </div>
  );
}
