const LABEL_COLORS = ['#64748b', '#2563eb', '#16a34a', '#ca8a04', '#dc2626', '#9333ea'];

function normalizeLabelName(name) {
  return String(name || '')
    .trim()
    .slice(0, 48);
}

function normalizeLabelColor(color) {
  const value = String(color || '').trim();
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : LABEL_COLORS[0];
}

function formatProjectLabel(row) {
  if (!row) return null;
  return {
    _id: row.id,
    name: row.name,
    color: row.color,
    createdAt: row.createdAt,
  };
}

function formatIssueLabels(issueLabelRows) {
  return (issueLabelRows || [])
    .map((row) => formatProjectLabel(row.label))
    .filter(Boolean);
}

async function syncIssueLabels(prisma, { issueId, projectId, labelIds }) {
  const ids = [...new Set((labelIds || []).map(String).filter(Boolean))];
  if (ids.length) {
    const valid = await prisma.projectLabel.findMany({
      where: { projectId: String(projectId), id: { in: ids } },
      select: { id: true },
    });
    if (valid.length !== ids.length) {
      const err = new Error('One or more labels are invalid for this project');
      err.status = 400;
      throw err;
    }
  }
  await prisma.issueLabel.deleteMany({ where: { issueId: String(issueId) } });
  if (ids.length) {
    await prisma.issueLabel.createMany({
      data: ids.map((labelId) => ({ issueId: String(issueId), labelId })),
      skipDuplicates: true,
    });
  }
}

module.exports = {
  LABEL_COLORS,
  normalizeLabelName,
  normalizeLabelColor,
  formatProjectLabel,
  formatIssueLabels,
  syncIssueLabels,
};
