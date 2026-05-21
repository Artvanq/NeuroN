import Link from 'next/link';

function fileHref(base, path, branch) {
  const q = new URLSearchParams();
  if (branch) q.set('branch', branch);
  q.set('path', path);
  return `${base}/code?${q.toString()}`;
}

function TreeDir({ node, base, currentPath, branch }) {
  return (
    <li className="file-tree-dir">
      <span className="file-tree-folder">{node.name}/</span>
      <FileTreeNodes tree={node} base={base} currentPath={currentPath} branch={branch} />
    </li>
  );
}

function FileTreeNodes({ tree, base, currentPath, branch }) {
  return (
    <ul className="file-tree-list">
      {tree.children?.map((dir) => (
        <TreeDir key={dir.path} node={dir} base={base} currentPath={currentPath} branch={branch} />
      ))}
      {tree.files?.map((file) => (
        <li key={file.path}>
          <Link
            href={fileHref(base, file.path, branch)}
            className={`file-tree-file${currentPath === file.path ? ' active' : ''}`}
          >
            {file.name}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function FileTree({ tree, base, currentPath, branch }) {
  if (!tree) return null;
  return (
    <nav className="file-tree panel" aria-label="Files">
      <FileTreeNodes tree={tree} base={base} currentPath={currentPath} branch={branch} />
    </nav>
  );
}
