import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../lib/api';
import { getSocket } from '../lib/socket';
import { isLoggedIn } from '../lib/auth';
import { useI18n } from '../lib/I18nContext';

export default function NotificationBell() {
  const router = useRouter();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);

  const load = useCallback(async () => {
    if (!isLoggedIn()) return;
    try {
      const data = await getNotifications();
      setItems(data.notifications);
      setUnread(data.unreadCount);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    load();
    const socket = getSocket();
    if (!socket) return undefined;

    const onNotif = (n) => {
      setItems((prev) => [n, ...prev].slice(0, 30));
      setUnread((c) => c + 1);
    };
    socket.on('notification', onNotif);
    return () => socket.off('notification', onNotif);
  }, [load]);

  if (!isLoggedIn()) return null;

  const handleClick = async (n) => {
    if (!n.read) {
      await markNotificationRead(n._id).catch(() => {});
      setUnread((c) => Math.max(0, c - 1));
    }
    setOpen(false);
    if (n.link) router.push(n.link);
  };

  return (
    <div className="notif-wrap">
      <button
        type="button"
        className="notif-bell"
        aria-label={t('notifications')}
        onClick={() => setOpen((o) => !o)}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M3.5 6.5a4.5 4.5 0 1 1 9 0v2l1.2 2.2a.5.5 0 0 1-.44.75H2.74a.5.5 0 0 1-.44-.75L3.5 8.5z" />
          <path d="M6.4 13a1.7 1.7 0 0 0 3.2 0" />
        </svg>
        {unread > 0 && <span className="notif-badge">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <>
          <button
            type="button"
            className="notif-backdrop"
            aria-label="Close"
            onClick={() => setOpen(false)}
          />
          <div className="notif-dropdown">
            <div className="notif-dropdown-head">
              <strong>{t('notifications')}</strong>
              {unread > 0 && (
                <button
                  type="button"
                  className="link-btn"
                  onClick={async () => {
                    await markAllNotificationsRead();
                    setUnread(0);
                    setItems((list) => list.map((n) => ({ ...n, read: true })));
                  }}
                >
                  {t('mark_all_read')}
                </button>
              )}
            </div>
            <ul className="notif-list">
              {items.length === 0 ? (
                <li className="muted">{t('no_notifications')}</li>
              ) : (
                items.map((n) => (
                  <li key={n._id}>
                    <button
                      type="button"
                      className={`notif-item${n.read ? '' : ' unread'}`}
                      onClick={() => handleClick(n)}
                    >
                      <span className="notif-title">{n.title}</span>
                      {n.body && <span className="notif-body">{n.body}</span>}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
