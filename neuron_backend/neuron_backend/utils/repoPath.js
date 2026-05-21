function normalizeRepoPath(input) {
  const raw = String(input || '').trim().replace(/\\/g, '/');
  if (!raw || raw === '/') return null;
  const parts = raw.split('/').filter((p) => p && p !== '.' && p !== '..');
  if (parts.length === 0) return null;
  const path = parts.join('/');
  if (path.length > 512) return null;
  return path;
}

function buildFileTree(files) {
  const root = { name: '', path: '', children: {}, files: [] };

  for (const file of files) {
    const segments = file.path.split('/');
    let node = root;
    for (let i = 0; i < segments.length; i += 1) {
      const seg = segments[i];
      const isFile = i === segments.length - 1;
      if (isFile) {
        node.files.push({
          name: seg,
          path: file.path,
          updatedAt: file.updatedAt,
        });
      } else {
        if (!node.children[seg]) {
          node.children[seg] = {
            name: seg,
            path: segments.slice(0, i + 1).join('/'),
            children: {},
            files: [],
          };
        }
        node = node.children[seg];
      }
    }
  }

  function toArray(node) {
    const dirs = Object.values(node.children)
      .map(toArray)
      .sort((a, b) => a.name.localeCompare(b.name));
    const files = [...node.files].sort((a, b) => a.name.localeCompare(b.name));
    return { ...node, children: dirs, files };
  }

  return toArray(root);
}

module.exports = { normalizeRepoPath, buildFileTree };
