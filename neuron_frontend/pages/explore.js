import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import PageHeader from '../components/PageHeader';
import ThreadFeedSection from '../components/ThreadFeedSection';
import CompatibleMinds from '../components/CompatibleMinds';
import GuestJoinBanner from '../components/GuestJoinBanner';
import FieldsStrip from '../components/FieldsStrip';
import InquiryStrip from '../components/InquiryStrip';
import FeedSortBar from '../components/FeedSortBar';
import Loading from '../components/Loading';
import { getCategories, getInquiries, searchAll, getErrorMessage } from '../lib/api';
import { useI18n } from '../lib/I18nContext';
import { useInfiniteThreads } from '../lib/useInfiniteThreads';
import { createThreadFetchPage } from '../lib/createThreadFetchPage';
import { isLoggedIn } from '../lib/auth';

export default function Explore() {
  const router = useRouter();
  const { t } = useI18n();
  const [categories, setCategories] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [inquiries, setInquiries] = useState([]);
  const [inquiriesLoading, setInquiriesLoading] = useState(true);
  const [sort, setSort] = useState('seeking');
  const [myFieldsOnly, setMyFieldsOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchUsers, setSearchUsers] = useState([]);
  const [searchProjects, setSearchProjects] = useState([]);
  const [searchOrganizations, setSearchOrganizations] = useState([]);
  const [searchMessages, setSearchMessages] = useState([]);

  const handleSearchQueryChange = (q) => {
    setSearchQuery(q);
    router.replace(
      { pathname: '/explore', query: q ? { q } : {} },
      undefined,
      { shallow: true }
    );
  };

  const fetchPage = useMemo(
    () =>
      createThreadFetchPage({
        mode: 'explore',
        sort,
        searchQuery,
        myFieldsOnly,
      }),
    [sort, searchQuery, myFieldsOnly]
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
    resetKey: `${sort}:${myFieldsOnly}:${searchQuery}`,
  });

  useEffect(() => {
    const q = typeof router.query.q === 'string' ? router.query.q.trim() : '';
    if (q.length >= 2) setSearchQuery(q);
  }, [router.query.q]);

  useEffect(() => {
    setCategoriesLoading(true);
    getCategories()
      .then(setCategories)
      .catch(() => setCategories([]))
      .finally(() => setCategoriesLoading(false));
    setInquiriesLoading(true);
    getInquiries({ limit: 40 })
      .then((rows) => setInquiries(Array.isArray(rows) ? rows : []))
      .catch(() => setInquiries([]))
      .finally(() => setInquiriesLoading(false));
  }, []);

  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchUsers([]);
      setSearchProjects([]);
      setSearchOrganizations([]);
      setSearchMessages([]);
      return undefined;
    }
    let cancelled = false;
    searchAll(searchQuery, { limit: 20 })
      .then((data) => {
        if (!cancelled) {
          setSearchUsers(data.users || []);
          setSearchProjects(data.projects || []);
          setSearchOrganizations(data.organizations || []);
          setSearchMessages(data.messages || []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSearchUsers([]);
          setSearchProjects([]);
          setSearchOrganizations([]);
          setSearchMessages([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [searchQuery]);

  const feedTitle = t(`feed_title_${sort}`);

  return (
    <Layout title="Explore" wide manifesto>
      <PageHeader
        variant="manifesto"
        eyebrow={t('explore_eyebrow')}
        title={t('explore_title')}
        description={t('explore_desc')}
      />

      <GuestJoinBanner />

      <section className="panel genesis-panel">
        <div className="genesis-panel-copy">
          <p className="eyebrow">{t('genesis_eyebrow')}</p>
          <h2>{t('genesis_title')}</h2>
          <p className="muted">{t('genesis_desc')}</p>
          <ul>
            <li>{t('genesis_rule_1')}</li>
            <li>{t('genesis_rule_2')}</li>
            <li>{t('genesis_rule_3')}</li>
          </ul>
        </div>
        {!isLoggedIn() && (
          <Link href="/register" className="manifesto-cta genesis-cta">
            {t('genesis_cta')}
          </Link>
        )}
      </section>

      {error && (
        <p className="error" role="alert">
          {getErrorMessage(error, 'Failed to load')}
        </p>
      )}

      <InquiryStrip inquiries={inquiries} loading={inquiriesLoading} />
      <FieldsStrip categories={categories} loading={categoriesLoading} />

      <CompatibleMinds />

      <FeedSortBar
        sort={sort}
        onSortChange={setSort}
        myFieldsOnly={myFieldsOnly}
        onMyFieldsChange={setMyFieldsOnly}
        showMyFields
      />

      <ThreadFeedSection
        title={feedTitle}
        searchQuery={searchQuery}
        onSearchQueryChange={handleSearchQueryChange}
        searchUsers={searchQuery.length >= 2 ? searchUsers : []}
        searchProjects={searchQuery.length >= 2 ? searchProjects : []}
        searchOrganizations={searchQuery.length >= 2 ? searchOrganizations : []}
        searchMessages={searchQuery.length >= 2 ? searchMessages : []}
        threads={threads}
        hasMore={hasMore}
        loading={loading}
        loadingMore={loadingMore}
        onLoadMore={loadMore}
        empty={
          <p className="muted">
            {t('feed_empty')}{' '}
            {!isLoggedIn() && (
              <Link href="/register" className="inline-link">
                {t('manifest_join')}
              </Link>
            )}
          </p>
        }
      />

      <section id="fields-all" className="panel panel-glass fields-catalog">
        <div className="actions-row">
          <h2>{t('fields_catalog_title')}</h2>
          {isLoggedIn() && (
            <Link href="/c/new" className="btn btn-primary btn-sm">
              Create a field
            </Link>
          )}
        </div>
        {categoriesLoading && categories.length === 0 ? (
          <Loading label={t('loading')} />
        ) : (
          <ul className="category-grid">
            {categories.map((c) => (
              <li key={c._id}>
                <Link
                  href={`/c/${c.slug}`}
                  className="category-card"
                  style={{ borderLeftColor: c.color }}
                >
                  <span className="category-icon">{c.icon || '📚'}</span>
                  <span className="category-name">{c.name}</span>
                  <span className="category-desc">{c.description}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Layout>
  );
}
