import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import EmergenceBlock from '../../components/EmergenceBlock';
import ReportButton from '../../components/ReportButton';
import ThreadCard from '../../components/ThreadCard';
import VoteControl from '../../components/VoteControl';
import { useI18n } from '../../lib/I18nContext';
import Loading from '../../components/Loading';
import TranslatableText from '../../components/TranslatableText';
import TranslatableMarkdown from '../../components/TranslatableMarkdown';
import ThreadPoll from '../../components/ThreadPoll';
import {
  getThread,
  getReplies,
  createReply,
  createGroup,
  getRelatedThreads,
  getThreadResonanceCandidates,
  updateThread,
  getErrorMessage,
} from '../../lib/api';
import { getStoredUser, isLoggedIn } from '../../lib/auth';

function buildReplyTree(replies) {
  const roots = [];
  const byParent = {};

  for (const r of replies) {
    const parentId = r.parentReply?._id || r.parentReply;
    const pid = parentId ? String(parentId) : null;
    if (!pid) {
      roots.push({ ...r, children: [] });
    } else {
      if (!byParent[pid]) byParent[pid] = [];
      byParent[pid].push(r);
    }
  }

  function attachChildren(node) {
    const kids = byParent[String(node._id)] || [];
    node.children = kids.map((k) => {
      const child = { ...k, children: [] };
      attachChildren(child);
      return child;
    });
    return node;
  }

  return roots.map(attachChildren);
}

const MAX_REPLY_DEPTH = 7;

function renderThreadAttachment(attachment) {
  if (!attachment?.url) return null;
  const key = `${attachment.mediaId || attachment.url}`;
  const name = attachment.name || 'attachment';
  if (attachment.mimeType?.startsWith('image/')) {
    return <img key={key} src={attachment.url} alt={name} className="thread-attachment-img" />;
  }
  if (attachment.mimeType?.startsWith('video/')) {
    return (
      <video key={key} className="thread-attachment-video" controls preload="metadata">
        <source src={attachment.url} type={attachment.mimeType} />
        <a href={attachment.url} target="_blank" rel="noreferrer">
          {name}
        </a>
      </video>
    );
  }
  return (
    <a key={key} href={attachment.url} target="_blank" rel="noreferrer">
      {name}
    </a>
  );
}

function ReplyItem({ reply, onReply, depth = 0, highlightId = null }) {
  const { t } = useI18n();
  const author = reply.author?.displayName || reply.author?.username;
  const canNest = depth < MAX_REPLY_DEPTH;
  const isHighlighted = highlightId && String(reply._id) === String(highlightId);

  return (
    <li
      id={`reply-${reply._id}`}
      className={`reply-item depth-${depth}${isHighlighted ? ' reply-highlight' : ''}`}
    >
      <VoteControl
        targetType="reply"
        targetId={reply._id}
        score={reply.score}
        myVote={reply.myVote}
        layout="column"
      />
      <div className="reply-item-body">
      <div className="reply-body">
        <TranslatableMarkdown text={reply.body} />
      </div>
      {reply.attachments?.length > 0 && (
        <div className="thread-attachments">
          {reply.attachments.map((attachment) => renderThreadAttachment(attachment))}
        </div>
      )}
      <p className="meta">
        <Link href={`/u/${reply.author?.username}`}>{author}</Link>
        {' · '}
        {new Date(reply.createdAt).toLocaleString()}
        {canNest && isLoggedIn() && (
          <>
            {' · '}
            <button type="button" className="link-btn" onClick={() => onReply(reply._id)}>
              {t('reply_action')}
            </button>
          </>
        )}
      </p>
      {reply.children?.length > 0 && (
        <ul className="reply-children">
          {reply.children.map((child) => (
            <ReplyItem
              key={child._id}
              reply={child}
              onReply={onReply}
              depth={depth + 1}
              highlightId={highlightId}
            />
          ))}
        </ul>
      )}
      </div>
    </li>
  );
}

export default function ThreadPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { id } = router.query;
  const [thread, setThread] = useState(null);
  const [related, setRelated] = useState([]);
  const [resonanceCandidates, setResonanceCandidates] = useState([]);
  const [rawReplies, setRawReplies] = useState([]);
  const [replyTree, setReplyTree] = useState([]);
  const [body, setBody] = useState('');
  const [parentReplyId, setParentReplyId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formingCrew, setFormingCrew] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const [t, replies, rel] = await Promise.all([
        getThread(id),
        getReplies(id),
        getRelatedThreads(id).catch(() => []),
      ]);
      setThread(t);
      setRawReplies(replies);
      setReplyTree(buildReplyTree(replies));
      setRelated(rel);
      const minds = await getThreadResonanceCandidates(id).catch(() => []);
      setResonanceCandidates(minds);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const replyHighlightId = useMemo(() => {
    const hash = typeof window !== 'undefined' ? window.location.hash : '';
    const fromHash = hash.match(/^#reply-(.+)$/);
    if (fromHash?.[1]) return decodeURIComponent(fromHash[1]);
    const q = router.query.reply;
    if (Array.isArray(q)) return q[0] || null;
    return q ? String(q) : null;
  }, [router.query.reply, router.asPath]);

  useEffect(() => {
    if (!replyHighlightId || loading || rawReplies.length === 0) return;
    const scrollToReply = () => {
      const el = document.getElementById(`reply-${replyHighlightId}`);
      if (!el) return false;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return true;
    };
    if (scrollToReply()) return undefined;
    const timer = setTimeout(scrollToReply, 400);
    return () => clearTimeout(timer);
  }, [replyHighlightId, loading, rawReplies.length]);

  const handleToggleLock = async () => {
    if (!thread || !isLoggedIn()) return;
    setSubmitting(true);
    try {
      const updated = await updateThread(id, { isLocked: !thread.isLocked });
      setThread(updated);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleTogglePin = async () => {
    if (!thread || !isLoggedIn()) return;
    setSubmitting(true);
    try {
      const updated = await updateThread(id, { isPinned: !thread.isPinned });
      setThread(updated);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isLoggedIn()) {
      router.push(`/login?next=${encodeURIComponent(router.asPath)}`);
      return;
    }
    if (thread?.isLocked) {
      setError('This thread is locked.');
      return;
    }
    if (!body.trim()) return;

    setSubmitting(true);
    setError(null);
    try {
      await createReply(id, { body: body.trim(), parentReplyId: parentReplyId || undefined });
      setBody('');
      setParentReplyId(null);
      setLoading(true);
      await load();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to post reply'));
    } finally {
      setSubmitting(false);
    }
  };

  const participantSignals = useMemo(() => {
    const counts = new Map();
    for (const reply of rawReplies) {
      const username = reply.author?.username;
      if (!username) continue;
      const entry = counts.get(username) || {
        username,
        displayName: reply.author?.displayName || username,
        count: 0,
      };
      entry.count += 1;
      counts.set(username, entry);
    }
    const topContributors = Array.from(counts.values()).sort((a, b) => b.count - a.count);
    return {
      uniqueVoices: counts.size,
      topContributors,
    };
  }, [rawReplies]);

  const crewCandidates = useMemo(() => {
    if (!thread) return [];
    const author = thread.author?.username
      ? [{ username: thread.author.username, displayName: thread.author.displayName || thread.author.username, count: 0 }]
      : [];
    const fromResonance = resonanceCandidates.map((mind) => ({
      username: mind.username,
      displayName: mind.displayName || mind.username,
      count: 0,
      resonantScore: mind.score || 0,
    }));
    const merged = [...author, ...participantSignals.topContributors, ...fromResonance];
    const byUser = new Map();
    for (const row of merged) {
      if (!row?.username) continue;
      if (!byUser.has(row.username)) byUser.set(row.username, row);
    }
    return Array.from(byUser.values()).slice(0, 7);
  }, [participantSignals.topContributors, resonanceCandidates, thread]);

  const handleCreateCrew = async () => {
    if (!isLoggedIn()) {
      router.push(`/login?next=${encodeURIComponent(router.asPath)}`);
      return;
    }
    const me = getStoredUser();
    const usernames = crewCandidates
      .map((p) => p.username)
      .filter((name) => name && name !== me?.username)
      .slice(0, 4);
    if (usernames.length === 0) {
      setError('Need at least one other participant to form a collision crew.');
      return;
    }
    setFormingCrew(true);
    setError(null);
    try {
      const group = await createGroup({
        name: `Collision crew · ${thread.title}`.slice(0, 80),
        memberUsernames: usernames,
      });
      router.push(`/messages/${group._id || group.id}`);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not form collision crew'));
    } finally {
      setFormingCrew(false);
    }
  };

  if (loading && !thread) {
    return (
      <Layout wide>
        <Loading label="Loading question…" />
      </Layout>
    );
  }

  if (!thread) {
    return (
      <Layout>
        <p className="error">{error || 'Question not found'}</p>
      </Layout>
    );
  }

  const author = thread.author?.displayName || thread.author?.username;
  return (
    <Layout title={thread.title} wide>
      <div className="thread-layout">
        <div className="thread-main">
          <div className="thread-detail-tags">
            {thread.category && (
              <Link
                href={`/c/${thread.category.slug}`}
                className="category-pill"
                style={{ borderColor: thread.category.color, color: thread.category.color }}
              >
                {thread.category.icon} {thread.category.name}
              </Link>
            )}
            {(thread.inquiries || []).map((inq) => (
              <Link key={inq.slug} href={`/i/${inq.slug}`} className="inquiry-pill">
                {inq.name}
              </Link>
            ))}
          </div>

          {thread.crosspostOf && (
            <p className="crosspost-banner panel-inset">
              Crossposted from{' '}
              <Link href={`/c/${thread.crosspostOf.category?.slug}`}>
                {thread.crosspostOf.category?.icon} {thread.crosspostOf.category?.name}
              </Link>
              {' · '}
              <Link href={`/t/${thread.crosspostOf._id}`}>{thread.crosspostOf.title}</Link>
            </p>
          )}

          <EmergenceBlock
            threadId={id}
            replyCount={thread.replyCount}
            participantSignals={participantSignals}
          />

          <article className="thread-detail panel thread-detail-with-vote">
            <VoteControl
              targetType="thread"
              targetId={thread._id}
              score={thread.score}
              myVote={thread.myVote}
              layout="column"
              onUpdate={(v) => setThread((prev) => (prev ? { ...prev, score: v.score, myVote: v.myVote } : prev))}
            />
            <div className="thread-detail-content">
            <h1>
              <TranslatableText text={thread.title} as="span" inlineToggle={false} />
            </h1>
            {thread.body && (
              <div className="thread-body">
                <TranslatableMarkdown text={thread.body} />
              </div>
            )}
            {thread.attachments?.length > 0 && (
              <div className="thread-attachments">
                {thread.attachments.map((attachment) => renderThreadAttachment(attachment))}
              </div>
            )}
            {thread.poll && (
              <ThreadPoll
                threadId={thread._id}
                poll={thread.poll}
                onPollChange={(poll) => setThread((prev) => (prev ? { ...prev, poll } : prev))}
              />
            )}
            <p className="meta">
              by <Link href={`/u/${thread.author?.username}`}>{author}</Link>
              {' · '}
              {new Date(thread.createdAt).toLocaleString()}
              {' · '}
              {thread.replyCount} {t('comments_count')}
              {thread.isPinned && (
                <>
                  {' · '}
                  <span className="issue-status-badge open">Pinned</span>
                </>
              )}
              {thread.isLocked && (
                <>
                  {' · '}
                  <span className="issue-status-badge closed">Locked</span>
                </>
              )}
              {' · '}
              <ReportButton targetType="thread" targetId={thread._id} />
              {isLoggedIn() && (
                <>
                  {' · '}
                  <Link href={`/crosspost/${thread._id}`} className="link-btn">
                    Crosspost
                  </Link>
                  <button type="button" className="link-btn" onClick={handleTogglePin} disabled={submitting}>
                    {thread.isPinned ? 'Unpin' : 'Pin'}
                  </button>
                  <button type="button" className="link-btn" onClick={handleToggleLock} disabled={submitting}>
                    {thread.isLocked ? 'Unlock thread' : 'Lock thread'}
                  </button>
                </>
              )}
        </p>
            {thread.author?.mindStatement && (
              <blockquote className="author-mind">
                {thread.author.mindStatement}
              </blockquote>
            )}
            </div>
          </article>

          {error && <p className="error">{error}</p>}

          <section className="panel">
            <h2>Responses</h2>
            {replyTree.length === 0 ? (
              <p className="muted">No responses yet. Add a perspective the question needs.</p>
            ) : (
              <ul className="reply-list">
                {replyTree.map((r) => (
                  <ReplyItem
                    key={r._id}
                    reply={r}
                    highlightId={replyHighlightId}
                    onReply={(pid) => {
                      setParentReplyId(pid);
                      document.getElementById('reply-form')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                  />
                ))}
              </ul>
            )}
          </section>

          <section className="panel" id="reply-form">
            <h2>{parentReplyId ? 'Respond in branch' : 'Add your response'}</h2>
            {parentReplyId && (
              <p className="muted">
                Branching from a response.{' '}
                <button type="button" className="link-btn" onClick={() => setParentReplyId(null)}>
                  Cancel
                </button>
              </p>
            )}
            {thread.isLocked ? (
              <p className="muted">This thread is locked — new responses are disabled.</p>
            ) : isLoggedIn() ? (
              <form className="form" onSubmit={handleSubmit}>
                <label>
                  Your response
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={4}
                    required
                    placeholder="A perspective only you can bring…"
                  />
                </label>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Posting…' : 'Post response'}
                </button>
              </form>
            ) : (
              <p className="muted">
                <Link href="/login">Sign in</Link> to respond.
              </p>
            )}
          </section>

          <section className="panel collision-crew-panel">
            <div className="collision-crew-head">
              <div>
                <p className="eyebrow">Long-form collaboration</p>
                <h2>Collision Crew</h2>
                <p className="muted">
                  Spin up a focused group chat with key participants and carry this question for weeks,
                  not minutes.
                </p>
              </div>
              <button type="button" className="btn btn-primary" onClick={handleCreateCrew} disabled={formingCrew}>
                {formingCrew ? 'Forming crew…' : 'Form crew room'}
              </button>
            </div>
            <ul className="collision-crew-list">
              {crewCandidates.map((mind) => (
                <li key={mind.username}>
                  <span>{mind.displayName || mind.username}</span>
                  <span className="muted">
                    @{mind.username}
                    {mind.count > 0
                      ? ` · ${mind.count} responses`
                      : mind.resonantScore
                        ? ` · resonance score ${mind.resonantScore}`
                        : ' · thread author'}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="thread-aside">
          <section className="panel">
            <h2>Resonant minds to invite</h2>
            {resonanceCandidates.length === 0 ? (
              <p className="muted">No extra matches yet. More responses will unlock sharper pairing.</p>
            ) : (
              <ul className="thread-list thread-list-compact">
                {resonanceCandidates.slice(0, 5).map((mind) => (
                  <li key={mind.username} className="resonant-mind-item">
                    <Link href={`/u/${mind.username}`}>
                      <strong>{mind.displayName || mind.username}</strong>
                      <span className="muted">
                        {' '}
                        @{mind.username} · score {mind.score}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="panel">
            <h2>Resonant questions</h2>
            {related.length === 0 ? (
              <p className="muted">No related questions yet.</p>
            ) : (
              <ul className="thread-list thread-list-compact">
                {related.map((t) => (
                  <ThreadCard key={t._id} thread={t} compact />
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </Layout>
  );
}
