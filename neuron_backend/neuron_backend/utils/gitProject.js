const { findProjectByPath: lookupProject } = require('./projectLookup');

async function findProjectByPath(ownerUsername, projectSlug) {
  const found = await lookupProject(ownerUsername, projectSlug);
  if (!found) return null;
  return { project: found.project, owner: found.owner, pathOwner: found.pathOwner };
}

function gitHttpBaseUrl(req) {
  return process.env.API_PUBLIC_URL || `${req.protocol}://${req.get('host')}`;
}

function gitSshRemoteUrl(owner, slug) {
  const host = process.env.SSH_GIT_HOST || 'localhost';
  const port = Number(process.env.SSH_GIT_PORT || 2222);
  const user = process.env.SSH_GIT_USER || 'git';
  if (port === 22) {
    return `${user}@${host}:${owner}/${slug}.git`;
  }
  return `ssh://${user}@${host}:${port}/${owner}/${slug}.git`;
}

module.exports = {
  findProjectByPath,
  gitHttpBaseUrl,
  gitSshRemoteUrl,
};
