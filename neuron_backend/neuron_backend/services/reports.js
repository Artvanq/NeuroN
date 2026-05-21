const prisma = require('../utils/prisma');
const { formatReport } = require('../utils/serialize');

async function createReport({ reporterId, targetType, targetId, reason }) {
  const row = await prisma.report.create({
    data: {
      reporterId: String(reporterId),
      targetType,
      targetId: String(targetId),
      reason,
    },
  });
  return formatReport(row);
}

async function updateReportStatus(reportId, status) {
  const row = await prisma.report.update({
    where: { id: String(reportId) },
    data: { status },
  });
  return formatReport(row);
}

module.exports = {
  createReport,
  updateReportStatus,
};
