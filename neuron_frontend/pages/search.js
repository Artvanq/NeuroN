import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function SearchRedirect() {
  const router = useRouter();

  useEffect(() => {
    const q = typeof router.query.q === 'string' ? router.query.q : '';
    router.replace(q ? { pathname: '/explore', query: { q } } : '/explore');
  }, [router]);

  return null;
}
