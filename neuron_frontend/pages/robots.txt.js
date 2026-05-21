export async function getServerSideProps({ res }) {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const body = `User-agent: *
Allow: /
Disallow: /settings
Disallow: /messages/
Disallow: /moderation
Disallow: /owner/

Sitemap: ${base}/sitemap.xml
`;
  res.setHeader('Content-Type', 'text/plain');
  res.write(body);
  res.end();
  return { props: {} };
}

export default function RobotsTxt() {
  return null;
}
