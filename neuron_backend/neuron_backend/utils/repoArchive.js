const archiver = require('archiver');
const { getBranchFiles } = require('./repoFiles');

function streamProjectZip(res, project, branch, files) {
  const filename = `${project.slug}-${branch}.zip`;
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.on('error', (err) => {
    if (!res.headersSent) res.status(500);
    res.end();
    throw err;
  });
  archive.pipe(res);

  for (const file of files) {
    archive.append(file.content || '', { name: file.path });
  }

  archive.finalize();
}

async function sendProjectArchive(res, project, branch) {
  const files = await getBranchFiles(project.id, branch);
  streamProjectZip(res, project, branch, files);
}

module.exports = { sendProjectArchive };
