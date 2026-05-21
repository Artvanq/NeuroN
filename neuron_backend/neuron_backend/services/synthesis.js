const prisma = require('../utils/prisma');
const { formatSynthesis, sameId } = require('../utils/serialize');

const SYNTHESIS_INCLUDE = { contributors: true };

async function findSynthesisByThread(threadId) {
  const row = await prisma.synthesis.findFirst({
    where: { threadId: String(threadId) },
    include: SYNTHESIS_INCLUDE,
  });
  return row ? formatSynthesis(row) : null;
}

async function createSynthesis({ threadId, content, contributorIds }) {
  const row = await prisma.synthesis.create({
    data: {
      threadId: String(threadId),
      content: content || '',
      contributors: {
        connect: (contributorIds || []).map((id) => ({ id: String(id) })),
      },
    },
    include: SYNTHESIS_INCLUDE,
  });
  return formatSynthesis(row);
}

async function upsertSynthesisContent({ threadId, content, contributorId }) {
  const existing = await prisma.synthesis.findFirst({
    where: { threadId: String(threadId) },
    include: { contributors: true },
  });

  if (!existing) {
    return createSynthesis({
      threadId,
      content,
      contributorIds: [contributorId],
    });
  }

  const contributorIds = new Set(existing.contributors.map((c) => c.id));
  contributorIds.add(String(contributorId));

  const row = await prisma.synthesis.update({
    where: { id: existing.id },
    data: {
      content,
      contributors: {
        set: [...contributorIds].map((id) => ({ id })),
      },
    },
    include: SYNTHESIS_INCLUDE,
  });
  return formatSynthesis(row);
}

async function deleteSynthesisForThread(threadId) {
  await prisma.synthesis.deleteMany({ where: { threadId: String(threadId) } });
}

module.exports = {
  findSynthesisByThread,
  createSynthesis,
  upsertSynthesisContent,
  deleteSynthesisForThread,
  sameId,
};
