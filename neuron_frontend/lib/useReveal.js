import { useEffect } from 'react';

/**
 * useReveal — observes elements matching `selector` and adds
 * the `is-visible` class when they enter the viewport.
 *
 * Pairs with the `.reveal` class in globals.css.
 */
export default function useReveal(selector = '.reveal', options = {}) {
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    if (typeof IntersectionObserver === 'undefined') {
      document.querySelectorAll(selector).forEach((el) => {
        el.classList.add('is-visible');
      });
      return undefined;
    }

    const reduce =
      window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const els = Array.from(document.querySelectorAll(selector));
    if (reduce) {
      els.forEach((el) => el.classList.add('is-visible'));
      return undefined;
    }

    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            obs.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.12,
        rootMargin: '0px 0px -10% 0px',
        ...options,
      }
    );

    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [selector]);
}
