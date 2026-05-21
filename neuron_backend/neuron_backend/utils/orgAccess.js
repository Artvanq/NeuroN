const prisma = require('./prisma');

const ORG_ROLE_RANK = {
  MEMBER: 1,
  ADMIN: 2,
  OWNER: 3,
};

async function getOrganizationMembership(organizationId, userId) {
  if (!organizationId || !userId) return null;
  return prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId: String(organizationId),
        userId: String(userId),
      },
    },
  });
}

async function requireOrgRole(organizationId, userId, minRole) {
  const member = await getOrganizationMembership(organizationId, userId);
  if (!member || ORG_ROLE_RANK[member.role] < ORG_ROLE_RANK[minRole]) {
    const err = new Error('Organization access required');
    err.status = 403;
    throw err;
  }
  return member;
}

function formatOrganization(org, extras = {}) {
  if (!org) return null;
  return {
    _id: org.id,
    slug: org.slug,
    name: org.name,
    description: org.description || '',
    avatarUrl: org.avatarUrl || null,
    memberCount: extras.memberCount,
    projectCount: extras.projectCount,
    viewerRole: extras.viewerRole || null,
    createdAt: org.createdAt,
  };
}

function formatOrgMember(row) {
  if (!row) return null;
  return {
    _id: row.id,
    role: row.role,
    user: row.user
      ? {
          _id: row.user.id,
          username: row.user.username,
          displayName: row.user.displayName,
          avatarUrl: row.user.avatarUrl || null,
        }
      : null,
    createdAt: row.createdAt,
  };
}

module.exports = {
  ORG_ROLE_RANK,
  getOrganizationMembership,
  requireOrgRole,
  formatOrganization,
  formatOrgMember,
};
