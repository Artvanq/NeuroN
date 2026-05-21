import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function MarkdownBody({ children, className = '' }) {
  const text = children || '';

  return (
    <div className={`markdown-body${className ? ` ${className}` : ''}`}>
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        a({ href, children: linkChildren }) {
          if (href?.startsWith('/')) {
            return <Link href={href}>{linkChildren}</Link>;
          }
          return (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {linkChildren}
            </a>
          );
        },
        pre({ children: preChildren }) {
          return <pre className="md-pre">{preChildren}</pre>;
        },
        code({ inline, className: codeClass, children: codeChildren }) {
          if (inline) {
            return <code className="md-inline-code">{codeChildren}</code>;
          }
          return <code className={codeClass}>{codeChildren}</code>;
        },
      }}
    >
      {text}
    </ReactMarkdown>
    </div>
  );
}
