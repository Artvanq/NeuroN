const prisma = require('./prisma');
const { pickAuthor } = require('./serialize');

const VALID_ROLES = new Set(['READ', 'WRITE', 'MAINTAINER']);

function formatCollaborator(row) {
  if (!row) return null;
  return {
    _id: row.id,
    role: row.role,
    createdAt: row.createdAt,
    user: row.user ? pickAuthor(row.user) : null,
  };
}

async function listCollaborators(projectId) {
  const rows = await prisma.projectCollaborator.findMany({
    where: { projectId },
    include: { user: true },
    orderBy: { createdAt: 'asc' },
  });
  return rows.map(formatCollaborator);
}

async function addCollaborator(projectId, username, role) {
  const normalizedRole = String(role || 'READ').toUpperCase();
  if (!VALID_ROLES.has(normalizedRole)) {
    throw Object.assign(new Error('Invalid collaborator role'), { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { username: String(username).trim().toLowerCase() },
  });
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (project?.ownerId === user.id) {
    throw Object.assign(new Error('Project owner is already full access'), { status: 400 });
  }

  const row = await prisma.projectCollaborator.upsert({
    where: { projectId_userId: { projectId, userId: user.id } },
    create: { projectId, userId: user.id, role: normalizedRole },
    update: { role: normalizedRole },
    include: { user: true },
  });
  return formatCollaborator(row);
}

async function updateCollaboratorRole(projectId, userId, role) {
  const normalizedRole = String(role || '').toUpperCase();
  if (!VALID_ROLES.has(normalizedRole)) {
    throw Object.assign(new Error('Invalid collaborator role'), { status: 400 });
  }

  const row = await prisma.projectCollaborator.update({
    where: { projectId_userId: { projectId, userId } },
    data: { role: normalizedRole },
    include: { user: true },
  });
  return formatCollaborator(row);
}

async function removeCollaborator(projectId, userId) {
  await prisma.projectCollaborator.delete({
    where: { projectId_userId: { projectId, userId } },
  });
}

module.exports = {
  VALID_ROLES,
  formatCollaborator,
  listCollaborators,
  addCollaborator,
  updateCollaboratorRole,
  removeCollaborator,
};
