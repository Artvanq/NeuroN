import {
  getThreads,
  getCategoryThreads,
  getUserThreads,
  getRecommendedThreads,
  getInquiryThreads,
} from './api';
import { getStoredUser, isLoggedIn } from './auth';
import { THREAD_PAGE_SIZE } from './useInfiniteThreads';

export function createThreadFetchPage({
  mode,
  sort = 'hot',
  categorySlug,
  inquirySlug,
  username,
  searchQuery,
  myFieldsOnly = false,
}) {
  return async function fetchPage({ cursor }) {
    const params = { limit: THREAD_PAGE_SIZE, sort };
    if (cursor) params.cursor = cursor;

    const q = String(searchQuery || '').trim();
    if (q.length >= 2) params.q = q;

    if (mode === 'inquiry' && inquirySlug) {
      const data = await getInquiryThreads(inquirySlug, params);
      return { threads: data.threads, nextCursor: data.nextCursor };
    }

    if (mode === 'category') {
      const data = await getCategoryThreads(categorySlug, params);
      return { threads: data.threads, nextCursor: data.nextCursor };
    }

    if (mode === 'user') {
      return getUserThreads(username, { ...params, sort: 'new' });
    }

    if (sort === 'for-you') {
      return getRecommendedThreads(params);
    }

    if (sort === 'seeking' || sort === 'collision' || sort === 'recent') {
      params.lens = sort;
      delete params.sort;
    }

    const user = isLoggedIn() ? getStoredUser() : null;
    if (myFieldsOnly && user?.interestedCategories?.length) {
      const fieldSlugs = user.interestedCategories.map((c) => c.slug).filter(Boolean);
      if (fieldSlugs.length > 0) params.fields = fieldSlugs.join(',');
    }

    return getThreads(params);
  };
}
