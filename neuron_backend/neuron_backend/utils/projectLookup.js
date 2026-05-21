const prisma = require('./prisma');

const projectInclude = {
  owner: true,
  organization: true,
  category: true,
  _count: { select: { issues: true } },
};

async function resolveOwnerNamespace(ownerSlug) {
  const slug = String(ownerSlug || '').trim().toLowerCase();
  if (!slug) return null;

  const user = await prisma.user.findUnique({ where: { username: slug } });
  if (user) {
    return { type: 'user', id: user.id, slug: user.username, user, organization: null };
  }

  const organization = await prisma.organization.findUnique({ where: { slug } });
  if (organization) {
    return { type: 'organization', id: organization.id, slug: organization.slug, user: null, organization };
  }

  return null;
}

function namespaceSlug(ns) {
  return ns?.slug || null;
}

async function findProjectByPath(ownerSlug, projectSlug) {
  const ns = await resolveOwnerNamespace(ownerSlug);
  if (!ns) return null;

  const slug = String(projectSlug).trim().toLowerCase();
  let project = null;

  if (ns.type === 'user') {
    project = await prisma.project.findUnique({
      where: { ownerId_slug: { ownerId: ns.id, slug } },
      include: projectInclude,
    });
  } else {
    project = await prisma.project.findUnique({
      where: { organizationId_slug: { organizationId: ns.id, slug } },
      include: projectInclude,
    });
  }

  if (!project) return null;

  const openIssueCount = await prisma.issue.count({
    where: { projectId: project.id, status: 'open' },
  });
  const openPullCount = await prisma.pullRequest.count({
    where: { projectId: project.id, status: 'open' },
  });

  const pathOwner = namespaceSlug(ns);
  const owner = ns.type === 'user' ? ns.user : project.owner;

  return { project, owner, pathOwner, namespace: ns, openIssueCount, openPullCount };
}

function projectPathOwner(project) {
  if (project.organization?.slug) return project.organization.slug;
  return project.owner?.username || null;
}

module.exports = {
  projectInclude,
  resolveOwnerNamespace,
  findProjectByPath,
  projectPathOwner,
  namespaceSlug,
};
