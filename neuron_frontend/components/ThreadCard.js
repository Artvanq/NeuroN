import Link from 'next/link';
import TranslatableText from './TranslatableText';
import VoteControl from './VoteControl';
import { stripMarkdown } from '../lib/stripMarkdown';

function timeAgo(date) {
  if (!date) return '';
  const sec = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (sec < 60) return 'just now';
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h`;
  if (sec < 604800) return `${Math.floor(sec / 86400)}d`;
  return new Date(date).toLocaleDateString();
}

export default function ThreadCard({ thread, compact }) {
  const author = thread.author?.displayName || thread.author?.username || 'unknown';
  const category = thread.category;

  return (
    <li className={`thread-card${compact ? ' compact' : ''}`}>
      <VoteControl
        targetType="thread"
        targetId={thread._id}
        score={thread.score}
        myVote={thread.myVote}
        layout="column"
      />
      <div className="thread-card-body">
        <div className="thread-card-meta">
          {category && (
            <Link
              href={`/c/${category.slug}`}
              className="category-pill"
              style={{ borderColor: category.color, color: category.color }}
            >
              {category.icon ? `${category.icon} ` : ''}
              {category.name}
            </Link>
          )}
          {(thread.inquiries || []).map((inq) => (
            <Link
              key={inq.slug}
              href={`/i/${inq.slug}`}
              className="inquiry-pill"
            >
              {inq.name}
            </Link>
          ))}
          <span className="thread-card-by">
            <Link href={`/u/${thread.author?.username || 'unknown'}`}>{author}</Link>
          </span>
          <span className="thread-card-dot">·</span>
          <span className="thread-card-time">{timeAgo(thread.createdAt)}</span>
          {thread.isPinned && (
            <>
              <span className="thread-card-dot">·</span>
              <span className="issue-status-badge open">Pinned</span>
            </>
          )}
          {thread.crosspostOf && (
            <>
              <span className="thread-card-dot">·</span>
              <span className="issue-status-badge open">Crosspost</span>
            </>
          )}
          {(thread.hasPoll || thread.poll) && (
            <>
              <span className="thread-card-dot">·</span>
              <span className="issue-status-badge open">Poll</span>
            </>
          )}
        </div>
        <Link href={`/t/${thread._id}`} className="thread-title">
          <TranslatableText text={thread.title} as="span" inlineToggle={false} />
        </Link>
        {!compact && thread.body && (
          <p className="thread-preview">
            <TranslatableText
              text={stripMarkdown(thread.body)}
              as="span"
              inlineToggle={false}
              truncate={200}
            />
          </p>
        )}
        <p className="thread-card-foot">
          <Link href={`/t/${thread._id}`} className="thread-card-comments">
            {thread.replyCount || 0} comments
          </Link>
        </p>
      </div>
    </li>
  );
}
