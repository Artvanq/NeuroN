export default function BlameView({ lines }) {
  if (!lines?.length) return <p className="muted">Empty file</p>;

  return (
    <pre className="blame-view">
      {lines.map((row) => (
        <div key={row.line} className="blame-line">
          <span className="blame-meta" title={row.committedAt ? new Date(row.committedAt).toLocaleString() : ''}>
            {row.author?.username ? `@${row.author.username}` : '—'}
          </span>
          <span className="blame-lineno">{row.line}</span>
          <span className="blame-text">{row.text}</span>
        </div>
      ))}
    </pre>
  );
}
