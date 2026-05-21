const prisma = require('./prisma');
const { getOrganizationMembership } = require('./orgAccess');

const ROLE_RANK = {
  READ: 1,
  WRITE: 2,
  MAINTAINER: 3,
  OWNER: 4,
};

const NO_ACCESS = {
  role: 'NONE',
  read: false,
  write: false,
  merge: false,
  admin: false,
  owner: false,
};

function permissionsForRole(role) {
  const rank = ROLE_RANK[role] || 0;
  return {
    role,
    read: rank >= ROLE_RANK.READ,
    write: rank >= ROLE_RANK.WRITE,
    merge: rank >= ROLE_RANK.MAINTAINER,
    admin: rank >= ROLE_RANK.MAINTAINER,
    owner: role === 'OWNER',
  };
}

async function resolveProjectAccess(userId, project) {
  if (!project) {
    return permissionsForRole('READ');
  }

  const visibility = project.visibility || 'PUBLIC';

  if (userId && project.ownerId === userId) {
    return permissionsForRole('OWNER');
  }

  if (userId && project.organizationId) {
    const membership = await getOrganizationMembership(project.organizationId, userId);
    if (membership) {
      if (membership.role === 'OWNER') return permissionsForRole('OWNER');
      if (membership.role === 'ADMIN') return permissionsForRole('MAINTAINER');
      if (membership.role === 'MEMBER') return permissionsForRole('WRITE');
    }
  }

  if (userId) {
    const collab = await prisma.projectCollaborator.findUnique({
      where: {
        projectId_userId: { projectId: project.id, userId: String(userId) },
      },
    });
    if (collab) {
      return permissionsForRole(collab.role);
    }
  }

  if (visibility === 'PRIVATE') {
    return NO_ACCESS;
  }

  return permissionsForRole('READ');
}

function requireProjectPermission(access, permission) {
  if (!access?.[permission]) {
    const err = new Error('Not allowed for this project');
    err.status = 403;
    throw err;
  }
}

function requireProjectRead(access) {
  if (!access?.read) {
    const err = new Error('Project not found');
    err.status = 404;
    throw err;
  }
}

module.exports = {
  ROLE_RANK,
  NO_ACCESS,
  permissionsForRole,
  resolveProjectAccess,
  requireProjectPermission,
  requireProjectRead,
};
