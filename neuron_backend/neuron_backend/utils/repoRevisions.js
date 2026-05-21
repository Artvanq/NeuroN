const prisma = require('./prisma');
const { pickAuthor } = require('./serialize');

const MAX_REVISIONS_PER_FILE = 200;

async function trimOldRevisions(projectId, branch, path) {
  const rows = await prisma.repoFileRevision.findMany({
    where: { projectId, branch, path },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
    skip: MAX_REVISIONS_PER_FILE,
  });
  if (rows.length === 0) return;
  await prisma.repoFileRevision.deleteMany({
    where: { id: { in: rows.map((r) => r.id) } },
  });
}

async function recordRepoFileRevision({ projectId, branch, path, content, authorId }) {
  if (!projectId || !branch || !path) return null;

  const row = await prisma.repoFileRevision.create({
    data: {
      projectId,
      branch,
      path,
      content: String(content ?? ''),
      authorId: authorId || null,
    },
    include: { author: true },
  });

  await trimOldRevisions(projectId, branch, path);
  return row;
}

function formatRepoFileRevision(row, extras = {}) {
  if (!row) return null;
  const content = String(row.content || '');
  const preview = content.length > 240 ? `${content.slice(0, 240)}…` : content;
  return {
    _id: row.id,
    branch: row.branch,
    path: row.path,
    content: extras.includeContent ? content : undefined,
    preview,
    lineCount: content ? content.split('\n').length : 0,
    byteSize: Buffer.byteLength(content, 'utf8'),
    author: row.author ? pickAuthor(row.author) : null,
    createdAt: row.createdAt,
  };
}

function computeBlameLines(revisionsAsc, currentContent, fallbackFile) {
  const lines = String(currentContent || '').split('\n');

  if (!revisionsAsc.length) {
    const fallback = fallbackFile?.updatedBy
      ? {
          author: pickAuthor(fallbackFile.updatedBy),
          committedAt: fallbackFile.updatedAt || null,
          revisionId: null,
        }
      : null;
    return lines.map((text, idx) => ({
      line: idx + 1,
      text,
      ...fallback,
    }));
  }

  let blamed = [];

  for (const rev of revisionsAsc) {
    const revLines = String(rev.content || '').split('\n');
    const max = Math.max(blamed.length, revLines.length, lines.length);
    const next = [];

    for (let i = 0; i < max; i += 1) {
      const prev = blamed[i];
      const text = revLines[i];
      if (text === undefined) continue;

      if (!prev || prev.text !== text) {
        next[i] = {
          line: i + 1,
          text,
          author: rev.author ? pickAuthor(rev.author) : null,
          committedAt: rev.createdAt,
          revisionId: rev.id,
        };
      } else {
        next[i] = { ...prev, line: i + 1, text };
      }
    }

    blamed = next;
  }

  return lines.map((text, idx) => {
    const row = blamed[idx];
    if (row && row.text === text) {
      return { ...row, line: idx + 1, text };
    }
    if (fallbackFile?.updatedBy) {
      return {
        line: idx + 1,
        text,
        author: pickAuthor(fallbackFile.updatedBy),
        committedAt: fallbackFile.updatedAt || null,
        revisionId: null,
      };
    }
    return { line: idx + 1, text, author: null, committedAt: null, revisionId: null };
  });
}

module.exports = {
  MAX_REVISIONS_PER_FILE,
  recordRepoFileRevision,
  formatRepoFileRevision,
  computeBlameLines,
};
