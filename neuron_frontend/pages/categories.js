import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function CategoriesRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/explore#fields-all');
  }, [router]);

  return null;
}
