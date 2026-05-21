import Link from 'next/link';

export default function PageHeader({ eyebrow, title, description, action, variant }) {
  if (variant === 'manifesto') {
    return (
      <header className="manifesto-page-header">
        {eyebrow && <p className="manifesto-eyebrow">{eyebrow}</p>}
        <div className="manifesto-page-header-row">
          <div>
            <h1 className="manifesto-page-title">{title}</h1>
            {description && <p className="manifesto-page-desc">{description}</p>}
          </div>
          {action}
        </div>
      </header>
    );
  }

  return (
    <header className="page-header">
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <div className="page-header-row">
        <div>
          <h1 className="page-title">{title}</h1>
          {description && <div className="page-desc">{description}</div>}
        </div>
        {action}
      </div>
    </header>
  );
}

export function PageHeaderAction({ href, children, primary }) {
  if (!href) return null;
  return (
    <Link href={href} className={primary ? 'btn btn-primary' : 'btn btn-secondary'}>
      {children}
    </Link>
  );
}
