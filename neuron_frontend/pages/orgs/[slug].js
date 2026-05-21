import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Layout from '../../components/Layout';
import PageHeader from '../../components/PageHeader';
import Loading from '../../components/Loading';
import {
  getOrganization,
  getOrganizationProjects,
  getOrganizationMembers,
  addOrganizationMember,
  removeOrganizationMember,
  getErrorMessage,
} from '../../lib/api';
import { isLoggedIn, getStoredUser } from '../../lib/auth';

function projectHref(p) {
  const owner = p.ownerUsername || p.organization?.slug;
  return `/p/${owner}/${p.slug}`;
}

export default function OrganizationPage() {
  const router = useRouter();
  const { slug } = router.query;
  const [org, setOrg] = useState(null);
  const [projects, setProjects] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [memberUsername, setMemberUsername] = useState('');
  const [memberRole, setMemberRole] = useState('MEMBER');
  const [memberBusy, setMemberBusy] = useState(false);
  const [memberError, setMemberError] = useState(null);
  const [removeBusy, setRemoveBusy] = useState(null);
  const currentUser = getStoredUser();

  const canManageMembers =
    org?.viewerRole === 'OWNER' || org?.viewerRole === 'ADMIN';

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    Promise.all([
      getOrganization(slug),
      getOrganizationProjects(slug).catch(() => []),
      isLoggedIn()
        ? getOrganizationMembers(slug).catch(() => [])
        : Promise.resolve([]),
    ])
      .then(([orgData, projectRows, memberRows]) => {
        setOrg(orgData);
        setProjects(Array.isArray(projectRows) ? projectRows : []);
        setMembers(Array.isArray(memberRows) ? memberRows : []);
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [slug]);

  const handleRemoveMember = async (member) => {
    const userId = member.user?._id;
    if (!userId) return;
    if (!window.confirm(`Remove ${member.user?.username} from ${org.slug}?`)) return;
    setRemoveBusy(userId);
    setMemberError(null);
    try {
      await removeOrganizationMember(slug, userId);
      setMembers((prev) => prev.filter((m) => m.user?._id !== userId));
      if (userId === currentUser?._id) {
        router.push('/orgs');
      }
    } catch (err) {
      setMemberError(getErrorMessage(err));
    } finally {
      setRemoveBusy(null);
    }
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!memberUsername.trim()) return;
    setMemberBusy(true);
    setMemberError(null);
    try {
      const row = await addOrganizationMember(slug, {
        username: memberUsername.trim(),
        role: memberRole,
      });
      setMembers((prev) => {
        const without = prev.filter((m) => m.user?._id !== row.user?._id);
        return [...without, row];
      });
      setMemberUsername('');
    } catch (err) {
      setMemberError(getErrorMessage(err));
    } finally {
      setMemberBusy(false);
    }
  };

  if (loading) {
    return (
      <Layout title={String(slug)}>
        <Loading label="Loading organization…" />
      </Layout>
    );
  }

  if (!org) {
    return (
      <Layout title="Not found">
        <p className="error">{error || 'Organization not found'}</p>
      </Layout>
    );
  }

  return (
    <Layout title={org.name} wide>
      <PageHeader
        eyebrow="Organization"
        title={org.name}
        description={
          <>
            @{org.slug}
            {org.memberCount != null && <> · {org.memberCount} members</>}
            {org.projectCount != null && <> · {org.projectCount} projects</>}
            {org.viewerRole && <> · your role: {org.viewerRole}</>}
          </>
        }
        action={
          isLoggedIn() && org.viewerRole ? (
            <Link href={`/projects/new?org=${org.slug}`} className="btn btn-secondary btn-sm">
              New project
            </Link>
          ) : null
        }
      />

      {error && <p className="error">{error}</p>}
      {org.description && <p className="panel">{org.description}</p>}

      <section className="panel">
        <h2 className="panel-section-title">Projects</h2>
        {projects.length === 0 ? (
          <p className="muted">No projects yet.</p>
        ) : (
          <ul className="project-list">
            {projects.map((p) => (
              <li key={p._id} className="project-list-item panel-inset">
                <Link href={projectHref(p)} className="project-list-link">
                  <span className="project-list-name">
                    <span className="project-owner">{org.slug}/</span>
                    {p.slug}
                  </span>
                  <span className="project-list-title">{p.name}</span>
                  {p.description && <span className="project-list-desc muted">{p.description}</span>}
                </Link>
                <span className="project-list-meta muted">
                  {p.openIssueCount ?? 0} open issues
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {org.viewerRole && (
        <section className="panel">
          <h2 className="panel-section-title">Members</h2>
          {members.length === 0 ? (
            <p className="muted">No members listed.</p>
          ) : (
            <ul className="user-search-list org-member-list">
              {members.map((m) => {
                const isOwner = m.role === 'OWNER';
                const isSelf = m.user?._id === currentUser?._id;
                const canRemove =
                  !isOwner &&
                  (isSelf || canManageMembers);
                return (
                  <li key={m._id} className="org-member-row">
                    <Link href={`/u/${m.user?.username}`}>
                      <strong>{m.user?.displayName || m.user?.username}</strong>
                    </Link>
                    <span className="muted"> · {m.role}</span>
                    {canRemove && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        disabled={removeBusy === m.user?._id}
                        onClick={() => handleRemoveMember(m)}
                      >
                        {removeBusy === m.user?._id ? '…' : isSelf ? 'Leave' : 'Remove'}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {canManageMembers && (
            <form className="form form-inline org-member-form" onSubmit={handleAddMember}>
              <label>
                Username
                <input
                  value={memberUsername}
                  onChange={(e) => setMemberUsername(e.target.value)}
                  placeholder="username"
                  autoComplete="off"
                />
              </label>
              <label>
                Role
                <select value={memberRole} onChange={(e) => setMemberRole(e.target.value)}>
                  <option value="MEMBER">Member</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </label>
              <button type="submit" className="btn btn-secondary btn-sm" disabled={memberBusy}>
                {memberBusy ? 'Adding…' : 'Add member'}
              </button>
              {memberError && <p className="error">{memberError}</p>}
            </form>
          )}
        </section>
      )}

      <p className="muted">
        <Link href="/orgs">All organizations</Link>
        {' · '}
        <Link href="/orgs/new">Create another</Link>
      </p>
    </Layout>
  );
}
