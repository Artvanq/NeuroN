const prisma = require('./prisma');
const { formatThread } = require('./serialize');

const CROSSPOST_INCLUDE = {
  author: true,
  category: true,
  crosspostOf: {
    include: {
      author: true,
      category: true,
    },
  },
};

async function createCrosspost({
  sourceThreadId,
  authorId,
  categoryId,
  title,
  body,
}) {
  const source = await prisma.thread.findUnique({
    where: { id: String(sourceThreadId) },
    include: { category: true, poll: { select: { id: true } } },
  });
  if (!source) {
    const err = new Error('Source thread not found');
    err.status = 404;
    throw err;
  }
  if (String(source.categoryId) === String(categoryId)) {
    const err = new Error('Crosspost must target a different field');
    err.status = 400;
    throw err;
  }

  const rootId = source.crosspostOfThreadId || source.id;
  const nextTitle = String(title || source.title).trim().slice(0, 300);
  if (!nextTitle) {
    const err = new Error('Title is required');
    err.status = 400;
    throw err;
  }
  const nextBody = body !== undefined ? String(body).trim().slice(0, 32000) : '';

  const row = await prisma.thread.create({
    data: {
      title: nextTitle,
      body: nextBody,
      authorId: String(authorId),
      categoryId: String(categoryId),
      crosspostOfThreadId: String(rootId),
      attachments: [],
    },
    include: CROSSPOST_INCLUDE,
  });
  return formatThread(row);
}

module.exports = {
  createCrosspost,
  CROSSPOST_INCLUDE,
};
