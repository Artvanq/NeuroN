import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import {
  getConversation,
  getMessages,
  sendMessage,
  markConversationRead,
  reactToMessage,
  editMessage,
  deleteMessage,
  getErrorMessage,
} from '../../lib/api';
import MediaCompose from '../../components/MediaCompose';
import { getStoredUser, isLoggedIn } from '../../lib/auth';
import { getSocket } from '../../lib/socket';
import { encryptMessage, isEncryptedPayload } from '../../lib/chatCrypto';
import { loadGroupKey, messageDisplayText } from '../../lib/chatKeys';

async function buildDisplayMap(msgs, conversationId, groupKey) {
  const map = {};
  await Promise.all(
    msgs.map(async (m) => {
      map[m._id] = await messageDisplayText(m.body, conversationId, groupKey);
    })
  );
  return map;
}

export default function ChatPage() {
  const router = useRouter();
  const { id } = router.query;
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [displayBodies, setDisplayBodies] = useState({});
  const [groupKey, setGroupKey] = useState(null);
  const [body, setBody] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editingBody, setEditingBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [live, setLive] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const bottomRef = useRef(null);
  const groupKeyRef = useRef(null);
  const socketRef = useRef(null);
  const typingTimeoutsRef = useRef(new Map());
  const typingEmitRef = useRef({ active: false, timeoutId: null });
  const me = typeof window !== 'undefined' ? getStoredUser() : null;

  useEffect(() => {
    groupKeyRef.current = groupKey;
  }, [groupKey]);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [conv, page] = await Promise.all([
        getConversation(id),
        getMessages(id),
      ]);
      const msgs = Array.isArray(page) ? page : page.messages;
      setConversation(conv);
      setMessages(msgs);
      setHasMore(Array.isArray(page) ? false : Boolean(page.hasMore));

      let key = null;
      if (conv.encrypted !== false) {
        key = await loadGroupKey(id);
        setGroupKey(key);
      }
      setDisplayBodies(await buildDisplayMap(msgs, id, key));
      if (msgs.length > 0) {
        markConversationRead(id, { messageId: msgs[msgs.length - 1]._id }).catch(() => {});
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadOlder = useCallback(async () => {
    if (!id || !messages.length || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await getMessages(id, { before: messages[0]._id });
      const older = Array.isArray(page) ? page : page.messages;
      if (older.length) {
        setDisplayBodies((prev) => ({
          ...prev,
          ...(await buildDisplayMap(older, id, groupKeyRef.current)),
        }));
        setMessages((prev) => [...older, ...prev]);
      }
      setHasMore(Array.isArray(page) ? false : Boolean(page.hasMore));
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load older messages'));
    } finally {
      setLoadingMore(false);
    }
  }, [id, messages, loadingMore]);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace(`/login?next=/messages/${id || ''}`);
      return undefined;
    }
    load();

    const socket = getSocket();
    if (!socket || !id) return undefined;
    socketRef.current = socket;

    socket.emit('join_conversation', id);
    setLive(socket.connected);

    const onConnect = () => {
      // Socket.io rooms are per-connection: after any drop/reconnect the
      // server no longer has this socket in the conversation room even
      // though the UI kept showing "live". Without re-emitting here, new
      // messages silently stop arriving until a manual page reload.
      socket.emit('join_conversation', id);
      setLive(true);
    };
    const onDisconnect = () => setLive(false);
    const onMsg = async (msg) => {
      const plain = await messageDisplayText(
        msg.body,
        id,
        groupKeyRef.current
      );
      setDisplayBodies((prev) => ({ ...prev, [msg._id]: plain }));
      setMessages((prev) => {
        if (prev.some((m) => m._id === msg._id)) return prev;
        return [...prev, msg];
      });
      // Keep unread state current while the conversation is actively open —
      // previously only the initial load() marked it read, so unread count
      // went stale for anyone watching the conversation live.
      if (msg.sender?.username !== me?.username) {
        markConversationRead(id, { messageId: msg._id }).catch(() => {});
      }
    };
    const onMsgUpdated = async (msg) => {
      const plain = msg.deleted
        ? '(message deleted)'
        : await messageDisplayText(msg.body, id, groupKeyRef.current);
      setDisplayBodies((prev) => ({ ...prev, [msg._id]: plain }));
      setMessages((prev) => {
        if (prev.some((m) => m._id === msg._id)) {
          return prev.map((m) => (m._id === msg._id ? msg : m));
        }
        return [...prev, msg];
      });
    };
    const onReaction = ({ messageId, reaction }) => {
      setMessages((prev) =>
        prev.map((m) => {
          if (m._id !== messageId) return m;
          const existing = Array.isArray(m.reactions) ? m.reactions : [];
          const withoutSame = existing.filter((r) => r._id !== reaction?._id);
          return { ...m, reactions: [...withoutSame, reaction] };
        })
      );
    };
    const onReactionRemoved = ({ messageId, reactionId }) => {
      setMessages((prev) =>
        prev.map((m) => {
          if (m._id !== messageId) return m;
          const existing = Array.isArray(m.reactions) ? m.reactions : [];
          return { ...m, reactions: existing.filter((r) => r._id !== reactionId) };
        })
      );
    };
    const onTyping = ({ conversationId, isTyping, user }) => {
      if (String(conversationId) !== String(id) || !user?.username || user.username === me?.username) {
        return;
      }
      const key = user.username;
      const timeoutMap = typingTimeoutsRef.current;
      const prevTimer = timeoutMap.get(key);
      if (prevTimer) clearTimeout(prevTimer);

      if (isTyping) {
        setTypingUsers((prev) => {
          if (prev.some((u) => u.username === key)) return prev;
          return [...prev, user];
        });
        const timer = setTimeout(() => {
          setTypingUsers((prev) => prev.filter((u) => u.username !== key));
          timeoutMap.delete(key);
        }, 3500);
        timeoutMap.set(key, timer);
        return;
      }

      timeoutMap.delete(key);
      setTypingUsers((prev) => prev.filter((u) => u.username !== key));
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('chat_message', onMsg);
    socket.on('chat_message_updated', onMsgUpdated);
    socket.on('chat_reaction', onReaction);
    socket.on('chat_reaction_removed', onReactionRemoved);
    socket.on('chat_typing', onTyping);

    return () => {
      if (typingEmitRef.current.active) {
        socket.emit('chat_typing', { conversationId: id, isTyping: false });
      }
      typingEmitRef.current.active = false;
      if (typingEmitRef.current.timeoutId) clearTimeout(typingEmitRef.current.timeoutId);
      typingEmitRef.current.timeoutId = null;
      for (const timer of typingTimeoutsRef.current.values()) clearTimeout(timer);
      typingTimeoutsRef.current.clear();
      setTypingUsers([]);
      socket.emit('leave_conversation', id);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('chat_message', onMsg);
      socket.off('chat_message_updated', onMsgUpdated);
      socket.off('chat_reaction', onReaction);
      socket.off('chat_reaction_removed', onReactionRemoved);
      socket.off('chat_typing', onTyping);
      socketRef.current = null;
    };
  }, [load, router, id, me?.username]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, displayBodies, typingUsers]);

  const emitTyping = useCallback((isTyping) => {
    const socket = socketRef.current;
    if (!socket || !id) return;
    socket.emit('chat_typing', { conversationId: id, isTyping });
  }, [id]);

  const handleBodyChange = (value) => {
    setBody(value);
    const hasText = Boolean(String(value || '').trim());
    const typingState = typingEmitRef.current;
    if (hasText && !typingState.active) {
      emitTyping(true);
      typingState.active = true;
    }
    if (!hasText && typingState.active) {
      emitTyping(false);
      typingState.active = false;
    }
    if (typingState.timeoutId) clearTimeout(typingState.timeoutId);
    if (hasText) {
      typingState.timeoutId = setTimeout(() => {
        if (typingEmitRef.current.active) {
          emitTyping(false);
          typingEmitRef.current.active = false;
        }
      }, 1500);
    } else {
      typingState.timeoutId = null;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!body.trim() && attachments.length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const plaintext = body.trim();
      let payload = plaintext;
      if (groupKey) {
        payload = await encryptMessage(plaintext, groupKey);
      } else if (!isEncryptedPayload(plaintext)) {
        const key = await loadGroupKey(id);
        setGroupKey(key);
        groupKeyRef.current = key;
        payload = await encryptMessage(plaintext, key);
      }
      const msg = await sendMessage(id, {
        body: payload,
        attachments: attachments.length ? attachments : undefined,
      });
      const plain = await messageDisplayText(msg.body, id, groupKeyRef.current);
      setDisplayBodies((prev) => ({ ...prev, [msg._id]: plain }));
      setMessages((prev) => {
        if (prev.some((m) => m._id === msg._id)) return prev;
        return [...prev, msg];
      });
      setBody('');
      if (typingEmitRef.current.active) {
        emitTyping(false);
        typingEmitRef.current.active = false;
      }
      if (typingEmitRef.current.timeoutId) {
        clearTimeout(typingEmitRef.current.timeoutId);
        typingEmitRef.current.timeoutId = null;
      }
      setAttachments([]);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to send'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingMessageId || !editingBody.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      let payloadBody = editingBody.trim();
      if (groupKey) {
        payloadBody = await encryptMessage(payloadBody, groupKey);
      } else if (conversation?.encrypted !== false && !isEncryptedPayload(payloadBody)) {
        const key = await loadGroupKey(id);
        setGroupKey(key);
        groupKeyRef.current = key;
        payloadBody = await encryptMessage(payloadBody, key);
      }
      await editMessage(id, editingMessageId, { body: payloadBody });
      setEditingMessageId(null);
      setEditingBody('');
      await load();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to edit message'));
    } finally {
      setSubmitting(false);
    }
  };

  const isGroup = conversation?.type === 'GROUP';
  const other = conversation?.participants?.find(
    (p) => p.username !== me?.username
  );
  const pageTitle = isGroup
    ? conversation?.name || 'Group'
    : other?.displayName || 'Chat';

  return (
    <Layout title={pageTitle}>
      <div className="chat-header">
        <Link href="/messages" className="back-link">
          ← Dialogue
        </Link>
        {isGroup ? (
          <div className="chat-header-group">
            <h1>
              <span className="group-icon" aria-hidden>
                👥
              </span>
              {conversation.name || 'Group'}
              {conversation.encrypted && (
                <span className="lock-icon" title="Encrypted">
                  🔒
                </span>
              )}
            </h1>
            <p className="group-meta muted">
              {conversation.memberCount || conversation.members?.length || 0}{' '}
              members
            </p>
          </div>
        ) : (
          other && (
            <h1>
              <Link href={`/u/${other.username}`}>
                {other.displayName || other.username}
              </Link>
              {conversation?.encrypted && (
                <span className="lock-icon" title="Encrypted">
                  🔒
                </span>
              )}
            </h1>
          )
        )}
        {live && (
          <span className="live-dot" title="Connected">
            live
          </span>
        )}
      </div>

      {conversation?.encrypted && (
        <p className="encrypted-note">
          Messages are encrypted on your device (AES-GCM). The server stores
          ciphertext only.
        </p>
      )}

      {error && <p className="error">{error}</p>}
      {typingUsers.length > 0 && (
        <p className="muted">
          {typingUsers.map((u) => u.displayName || u.username).join(', ')} typing…
        </p>
      )}

      <section className="panel chat-panel">
        {loading ? (
          <p className="muted">Loading…</p>
        ) : (
          <div className="chat-messages">
            {hasMore && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={loadingMore}
                onClick={loadOlder}
              >
                {loadingMore ? 'Loading…' : 'Load older messages'}
              </button>
            )}
            {messages.map((m) => {
              const mine = m.sender?.username === me?.username;
              const text = m.deleted
                ? '(message deleted)'
                : displayBodies[m._id] ?? '…';
              return (
                <div
                  key={m._id}
                  className={`chat-bubble ${mine ? 'mine' : 'theirs'}`}
                >
                  {!mine && isGroup && (
                    <span className="bubble-author">
                      {m.sender?.displayName || m.sender?.username}
                    </span>
                  )}
                  {editingMessageId === m._id ? (
                    <div className="chat-edit-box">
                      <input
                        value={editingBody}
                        onChange={(e) => setEditingBody(e.target.value)}
                        disabled={submitting}
                        autoFocus
                      />
                      <div className="chat-edit-actions">
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          disabled={submitting || !editingBody.trim()}
                          onClick={handleSaveEdit}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          disabled={submitting}
                          onClick={() => {
                            setEditingMessageId(null);
                            setEditingBody('');
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p>{text}</p>
                  )}
                  {!m.deleted && m.attachments?.length > 0 && (
                    <div className="chat-attachments">
                      {m.attachments.map((a) =>
                        a.mimeType?.startsWith('image/') ? (
                          <img key={a.url} src={a.url} alt="" className="chat-attachment-img" />
                        ) : (
                          <a key={a.url} href={a.url} target="_blank" rel="noreferrer">
                            {a.name || 'attachment'}
                          </a>
                        )
                      )}
                    </div>
                  )}
                  {m.reactions?.length > 0 && (
                    <div className="chat-reactions">
                      {m.reactions.map((r) => (
                        <span key={r._id} className="chat-reaction-chip">
                          {r.emoji} {r.user?.username}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="chat-bubble-actions">
                    {!m.deleted && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={async () => {
                          await reactToMessage(id, m._id, '👍');
                          load();
                        }}
                      >
                        👍
                      </button>
                    )}
                    {mine && !m.deleted && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => {
                          setEditingMessageId(m._id);
                          setEditingBody(displayBodies[m._id] || '');
                        }}
                      >
                        Edit
                      </button>
                    )}
                    {mine && !m.deleted && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={async () => {
                          await deleteMessage(id, m._id);
                          load();
                        }}
                      >
                        Delete
                      </button>
                    )}
                    <span className="bubble-time">
                      {new Date(m.createdAt).toLocaleTimeString()}
                      {m.editedAt ? ' · edited' : ''}
                    </span>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}

        <form className="form chat-form" onSubmit={handleSubmit}>
          <input
            value={body}
            onChange={(e) => handleBodyChange(e.target.value)}
            placeholder={
              groupKey || conversation?.encrypted
                ? 'Type an encrypted message…'
                : 'Type a message…'
            }
            disabled={submitting}
          />
          {!groupKey && (
            <MediaCompose
              kind="CHAT"
              attachments={attachments}
              onChange={setAttachments}
              disabled={submitting}
            />
          )}
          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting || (!body.trim() && attachments.length === 0)}
          >
            Send
          </button>
        </form>
      </section>
    </Layout>
  );
}
