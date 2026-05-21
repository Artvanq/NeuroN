import { useState } from 'react';
import { useI18n } from '../lib/I18nContext';
import { createRepoBranch, getErrorMessage } from '../lib/api';

export default function BranchSelector({
  branches = [],
  branch,
  defaultBranch = 'main',
  isOwner,
  owner,
  slug,
  onBranchChange,
  onBranchesUpdated,
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const names = branches.length
    ? branches.map((b) => (typeof b === 'string' ? b : b.name))
    : [defaultBranch];
  const current = branch || defaultBranch;

  const select = (name) => {
    setOpen(false);
    onBranchChange(name);
  };

  const handleCreate = async () => {
    const name = window.prompt(t('branch_new_prompt'), '');
    if (!name?.trim()) return;
    setCreating(true);
    try {
      await createRepoBranch(owner, slug, { name: name.trim(), from: current });
      await onBranchesUpdated?.();
      select(name.trim());
    } catch (err) {
      window.alert(getErrorMessage(err));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="branch-select-wrap">
      <button
        type="button"
        className="branch-select-btn"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="repo-branch">{current}</span>
        <span className="branch-caret" aria-hidden>
          ▾
        </span>
      </button>
      {open && (
        <div className="branch-dropdown panel" role="listbox">
          {names.map((name) => (
            <button
              key={name}
              type="button"
              role="option"
              aria-selected={name === current}
              className={`branch-option${name === current ? ' active' : ''}`}
              onClick={() => select(name)}
            >
              {name}
              {name === defaultBranch && (
                <span className="branch-default-tag">{t('branch_default')}</span>
              )}
            </button>
          ))}
          {isOwner && (
            <button
              type="button"
              className="branch-option branch-option-new"
              onClick={handleCreate}
              disabled={creating}
            >
              {creating ? t('loading') : t('branch_new')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
