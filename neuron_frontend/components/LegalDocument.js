import Link from 'next/link';

/**
 * @param {{ title: string, description: string, lastUpdated: string, contact: string, operator: string, siteUrl: string, sections: { id: string, title: string, paragraphs: string[] }[] }} props
 */
export default function LegalDocument({
  title,
  description,
  lastUpdated,
  contact,
  operator,
  siteUrl,
  sections,
}) {
  return (
    <>
      <p className="text-muted legal-meta">
        Last updated: {lastUpdated} · Operator: {operator} ·{' '}
        <a href={`mailto:${contact}`}>{contact}</a>
      </p>
      <nav className="legal-toc" aria-label="Table of contents">
        <ol>
          {sections.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`}>{s.title}</a>
            </li>
          ))}
        </ol>
      </nav>
      {sections.map((section) => (
        <section key={section.id} id={section.id} className="legal-section">
          <h2>{section.title}</h2>
          {section.paragraphs.map((text, i) => (
            <p key={i}>{text}</p>
          ))}
        </section>
      ))}
      <p className="text-muted legal-footer">
        Questions: <a href={`mailto:${contact}`}>{contact}</a>. Service URL:{' '}
        <Link href="/">{siteUrl}</Link>.
      </p>
    </>
  );
}
