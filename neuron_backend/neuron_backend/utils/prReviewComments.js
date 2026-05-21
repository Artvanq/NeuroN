const { pickAuthor } = require('./serialize');
const { normalizeRepoPath } = require('./repoPath');

const MAX_BODY = 8000;

function normalizeReviewSide(side) {
  const s = String(side || 'new').toLowerCase();
  return s === 'old' ? 'old' : 'new';
}

function normalizeReviewCommentBody(body) {
  return String(body || '').trim().slice(0, MAX_BODY);
}

function formatPullRequestReviewComment(row, extras = {}) {
  if (!row) return null;
  return {
    _id: row.id,
    path: row.path,
    side: row.side,
    line: row.line,
    body: row.body,
    author: pickAuthor(row.author),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    canEdit: extras.canEdit === true,
    canDelete: extras.canDelete === true,
  };
}

function validateInlineComment({ path, line, body }) {
  const normalizedPath = normalizeRepoPath(path);
  if (!normalizedPath) {
    throw Object.assign(new Error('Invalid file path'), { status: 400 });
  }
  const lineNum = parseInt(line, 10);
  if (!lineNum || lineNum < 1) {
    throw Object.assign(new Error('Line number is required'), { status: 400 });
  }
  const text = normalizeReviewCommentBody(body);
  if (!text) {
    throw Object.assign(new Error('Comment body is required'), { status: 400 });
  }
  return { path: normalizedPath, line: lineNum, body: text };
}

module.exports = {
  normalizeReviewSide,
  normalizeReviewCommentBody,
  formatPullRequestReviewComment,
  validateInlineComment,
};
