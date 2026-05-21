import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getUserProjects } from '../lib/api';

export default function UserProjectsSection({ username }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!username) return;
    getUserProjects(username)
      .then((rows) => setProjects(Array.isArray(rows) ? rows : []))
      .catch(() => setProjects([]))
      .finally(() => setLoading(false));
  }, [username]);

  if (loading) return <p className="muted">Loading projects…</p>;
  if (projects.length === 0) return null;

  return (
    <section className="panel">
      <h2>Projects</h2>
      <ul className="invite-list">
        {projects.map((p) => (
          <li key={`${p.owner}/${p.slug}`}>
            <Link href={`/p/${p.owner}/${p.slug}`}>
              {p.name}
            </Link>
            <span className="muted">
              {' '}
              · {p.openIssueCount} issues · updated {new Date(p.updatedAt).toLocaleDateString()}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
