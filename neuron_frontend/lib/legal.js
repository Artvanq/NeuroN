/**
 * Legal page metadata — operator/contact from env (set in Coolify build + runtime).
 */
export function getLegalMeta() {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
  const operator =
    process.env.NEXT_PUBLIC_LEGAL_OPERATOR ||
    process.env.NEXT_PUBLIC_SITE_NAME ||
    'Neuron';
  const contact =
    process.env.NEXT_PUBLIC_LEGAL_CONTACT ||
    process.env.NEXT_PUBLIC_LEGAL_EMAIL ||
    `legal@${safeHost(siteUrl)}`;
  const lastUpdated = '2026-05-20';
  return { siteUrl, operator, contact, lastUpdated };
}

function safeHost(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '') || 'localhost';
  } catch {
    return 'localhost';
  }
}
