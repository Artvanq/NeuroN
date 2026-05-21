import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function ProjectRoot() {
  const router = useRouter();
  const { owner, slug } = router.query;

  useEffect(() => {
    if (owner && slug) {
      router.replace(`/p/${owner}/${slug}/code`);
    }
  }, [owner, slug, router]);

  return null;
}
