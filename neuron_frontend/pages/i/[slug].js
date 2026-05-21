import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import PageHeader from '../../components/PageHeader';
import ThreadFeedSection from '../../components/ThreadFeedSection';
import FieldsStrip from '../../components/FieldsStrip';
import InquiryStrip from '../../components/InquiryStrip';
import FeedSortBar from '../../components/FeedSortBar';
import { getCategories, getInquiry, getInquiries } from '../../lib/api';
import { useI18n } from '../../lib/I18nContext';
import { useInfiniteThreads } from '../../lib/useInfiniteThreads';
import { createThreadFetchPage } from '../../lib/createThreadFetchPage';
import { useEffect, useMemo, useState } from 'react';

export default function InquiryPage() {
  const router = useRouter();
  const { slug } = router.query;
  const { t } = useI18n();
  const [inquiry, setInquiry] = useState(null);
  const [inquiries, setInquiries] = useState([]);
  const [categories, setCategories] = useState([]);
  const [sort, setSort] = useState('hot');
  const [error, setError] = useState(null);

  const inquirySlug = typeof slug === 'string' ? slug : '';

  useEffect(() => {
    if (!inquirySlug) return;
    getInquiry(inquirySlug)
      .then(setInquiry)
      .catch((err) => setError(err.response?.status === 404 ? 'not_found' : 'error'));
    getInquiries({ limit: 40 })
      .then((rows) => setInquiries(Array.isArray(rows) ? rows : []))
      .catch(() => setInquiries([]));
    getCategories().then(setCategories).catch(() => setCategories([]));
  }, [inquirySlug]);

  const fetchPage = useMemo(
    () =>
      createThreadFetchPage({
        mode: 'inquiry',
        inquirySlug,
        sort,
      }),
    [inquirySlug, sort]
  );

  const {
    threads,
    loading,
    loadingMore,
    error: feedError,
    loadMore,
    hasMore,
  } = useInfiniteThreads({
    fetchPage,
    resetKey: `${inquirySlug}:${sort}`,
    enabled: Boolean(inquirySlug),
  });

  if (error === 'not_found') {
    return (
      <Layout title={t('inquiries_title')}>
        <p className="error">{t('inquiry_not_found')}</p>
      </Layout>
    );
  }

  return (
    <Layout title={inquiry?.name || t('inquiries_title')} wide>
      <PageHeader
        eyebrow={t('inquiries_eyebrow')}
        title={inquiry?.name || inquirySlug}
        description={inquiry?.description || t('inquiries_page_desc')}
      />

      <InquiryStrip inquiries={inquiries} activeSlug={inquirySlug} />
      <FieldsStrip categories={categories} activeSlug={null} />

      <FeedSortBar sort={sort} onSortChange={setSort} />

      <ThreadFeedSection
        title={t('inquiry_feed_title')}
        threads={threads}
        loading={loading}
        loadingMore={loadingMore}
        error={feedError}
        hasMore={hasMore}
        onLoadMore={loadMore}
        empty={<p className="muted">{t('inquiry_feed_empty')}</p>}
      />
    </Layout>
  );
}
