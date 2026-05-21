import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Layout from '../../components/Layout';
import ThreadFeedSection from '../../components/ThreadFeedSection';
import FieldsStrip from '../../components/FieldsStrip';
import FeedSortBar from '../../components/FeedSortBar';
import FieldJoinButton from '../../components/FieldJoinButton';
import FieldProjects from '../../components/FieldProjects';
import Loading from '../../components/Loading';
import {
  getCategories,
  getCategory,
  getErrorMessage,
  updateCategoryRules,
  updateCommunity,
  getCategoryModerators,
  addCategoryModerator,
  removeCategoryModerator,
} from '../../lib/api';
import TranslatableMarkdown from '../../components/TranslatableMarkdown';
import { useI18n } from '../../lib/I18nContext';
import { useInfiniteThreads } from '../../lib/useInfiniteThreads';
import { createThreadFetchPage } from '../../lib/createThreadFetchPage';

export default function CategoryPage() {
  const router = useRouter();
  const { slug } = router.query;
  const { t } = useI18n();
  const [category, setCategory] = useState(null);
  const [categories, setCategories] = useState([]);
  const [categoryError, setCategoryError] = useState(null);
  const [categoryLoading, setCategoryLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sort, setSort] = useState('hot');
  const [rulesDraft, setRulesDraft] = useState('');
  const [moderators, setModerators] = useState([]);
  const [modUsername, setModUsername] = useState('');

  useEffect(() => {
    getCategories().then(setCategories).catch(() => setCategories([]));
  }, []);

  const fetchPage = useMemo(
    () =>
      createThreadFetchPage({
        mode: 'category',
        sort,
        categorySlug: slug,
        searchQuery,
      }),
    [slug, searchQuery, sort]
  );

  const {
    threads,
    loading,
    loadingMore,
    error,
    loadMore,
    hasMore,
  } = useInfiniteThreads({
    fetchPage,
    resetKey: `${slug}:${sort}:${searchQuery}`,
    enabled: Boolean(slug),
  });

  useEffect(() => {
    if (!slug) return;
    setCategoryLoading(true);
    setCategoryError(null);
    getCategory(slug)
      .then((cat) => {
        setCategory(cat);
        setRulesDraft(cat.rules || '');
        if (cat.canManageCategory) {
          getCategoryModerators(slug)
            .then((data) => setModerators(data.moderators || []))
            .catch(() => setModerators([]));
        }
      })
      .catch((err) => setCategoryError(getErrorMessage(err)))
      .finally(() => setCategoryLoading(false));
  }, [slug]);

  const displayError = categoryError || (error ? getErrorMessage(error) : null);
  const slugStr = typeof slug === 'string' ? slug : '';

  return (
    <Layout title={category?.name || t('fields_title')} wide>
      {categoryLoading && !category ? (
        <Loading label={t('loading')} />
      ) : category ? (
        <>
          <header className="category-header" style={{ borderColor: category.color }}>
            <span className="category-icon large">{category.icon || '📚'}</span>
            <div>
              <h1>
                {category.name}
                {category.isUserCommunity && (
                  <span className="issue-status-badge open" style={{ marginLeft: '0.5rem' }}>
                    community
                  </span>
                )}
              </h1>
              <p className="tagline">{category.description}</p>
              {category.createdBy?.username && (
                <p className="meta">
                  Created by{' '}
                  <Link href={`/u/${category.createdBy.username}`}>
                    {category.createdBy.displayName || category.createdBy.username}
                  </Link>
                </p>
              )}
            </div>
          </header>
          <div className="actions-row category-actions">
            <FieldJoinButton category={category} />
            <Link href={`/new?category=${category.slug}`} className="btn btn-primary btn-sm">
              {t('open_question')}
            </Link>
          </div>
          <FieldProjects categorySlug={slugStr} />
          {(category.rules || category.canManageCategory) && (
            <section className="panel category-rules-panel">
              <h2>{t('category_rules_title')}</h2>
              {category.rules && !category.canManageCategory && (
                <TranslatableMarkdown text={category.rules} />
              )}
              {category.canManageCategory && (
                <>
                  <label className="muted">
                    Description
                    <textarea
                      value={category.description || ''}
                      rows={2}
                      onChange={(e) =>
                        setCategory((c) => (c ? { ...c, description: e.target.value } : c))
                      }
                    />
                  </label>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={async () => {
                      try {
                        const updated = await updateCommunity(slugStr, {
                          description: category.description,
                        });
                        setCategory(updated);
                      } catch (err) {
                        setCategoryError(getErrorMessage(err));
                      }
                    }}
                  >
                    Save description
                  </button>
                  <textarea
                    value={rulesDraft}
                    onChange={(e) => setRulesDraft(e.target.value)}
                    rows={6}
                    className="category-rules-editor"
                  />
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={async () => {
                      try {
                        const updated = await updateCategoryRules(slugStr, rulesDraft);
                        setCategory(updated);
                      } catch (err) {
                        setCategoryError(getErrorMessage(err));
                      }
                    }}
                  >
                    {t('category_rules_save')}
                  </button>
                  <div className="category-mods">
                    <h3>{t('category_mods_title')}</h3>
                    <form
                      className="emergence-actions"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (!modUsername.trim()) return;
                        await addCategoryModerator(slugStr, modUsername.trim());
                        setModUsername('');
                        const data = await getCategoryModerators(slugStr);
                        setModerators(data.moderators || []);
                      }}
                    >
                      <input
                        value={modUsername}
                        onChange={(e) => setModUsername(e.target.value)}
                        placeholder={t('project_collaborator_username')}
                      />
                      <button type="submit" className="btn btn-ghost btn-sm">
                        {t('category_mod_add')}
                      </button>
                    </form>
                    <ul className="invite-list">
                      {moderators.map((m) => (
                        <li key={m._id}>
                          @{m.user?.username}
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={async () => {
                              await removeCategoryModerator(slugStr, m.user._id);
                              setModerators((prev) => prev.filter((x) => x._id !== m._id));
                            }}
                          >
                            ×
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              )}
            </section>
          )}
        </>
      ) : null}

      {displayError && <p className="error">{displayError}</p>}

      <FieldsStrip
        categories={categories}
        loading={!categories.length && categoryLoading}
        activeSlug={slugStr || undefined}
      />

      <FeedSortBar sort={sort} onSortChange={setSort} />

      <ThreadFeedSection
        title={t('feed_title_posts')}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        searchScopeHint={
          category ? `${t('feed_search_scope_category')} · ${category.name}` : null
        }
        threads={threads}
        hasMore={hasMore}
        loading={loading}
        loadingMore={loadingMore}
        onLoadMore={loadMore}
        empty={<p className="muted">{t('field_feed_empty')}</p>}
      />
    </Layout>
  );
}
