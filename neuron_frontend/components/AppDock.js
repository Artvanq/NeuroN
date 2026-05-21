import Link from 'next/link';
import { useRouter } from 'next/router';
import { useI18n } from '../lib/I18nContext';
import { getStoredUser } from '../lib/auth';

const IconResonance = (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="10" cy="10" r="2.2" />
    <circle cx="10" cy="10" r="5.5" opacity="0.55" />
    <circle cx="10" cy="10" r="8.5" opacity="0.25" />
  </svg>
);

const IconProjects = (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="3" y="3" width="6" height="6" rx="1.2" />
    <rect x="11" y="3" width="6" height="6" rx="1.2" />
    <rect x="3" y="11" width="6" height="6" rx="1.2" />
    <rect x="11" y="11" width="6" height="6" rx="1.2" />
  </svg>
);

const IconDialogue = (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M3.5 9c0-3 2.6-5 6-5s6 2 6 5-2.6 5-6 5c-.8 0-1.55-.1-2.25-.3L4 15l1-2.7C4.1 11.3 3.5 10.2 3.5 9z" />
  </svg>
);

const IconProfile = (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="10" cy="7.5" r="3.2" />
    <path d="M3.8 16.5c1-2.6 3.4-4.2 6.2-4.2s5.2 1.6 6.2 4.2" />
  </svg>
);

function DockItem({ href, label, icon, active }) {
  return (
    <Link
      href={href}
      className={`app-dock-item${active ? ' active' : ''}`}
      aria-current={active ? 'page' : undefined}
    >
      <span className="app-dock-icon" aria-hidden>
        {icon}
      </span>
      <span className="app-dock-label">{label}</span>
    </Link>
  );
}

export default function AppDock() {
  const router = useRouter();
  const { t } = useI18n();
  const user = getStoredUser();
  const profileHref = user ? `/u/${user.username}` : '/login';

  const onResonance =
    router.pathname === '/explore' ||
    router.pathname === '/categories' ||
    router.pathname.startsWith('/c/');

  const onProjects =
    router.pathname.startsWith('/projects') ||
    router.pathname.startsWith('/p/') ||
    router.pathname.startsWith('/orgs');

  const onDialogue = router.pathname.startsWith('/messages');
  const onProfile =
    router.pathname === '/settings' ||
    (user && router.pathname === `/u/${user.username}`);

  return (
    <nav className="app-dock" aria-label={t('dock_label')}>
      <DockItem
        href="/explore"
        label={t('dock_resonance')}
        icon={IconResonance}
        active={onResonance}
      />
      <DockItem
        href="/projects"
        label={t('dock_projects')}
        icon={IconProjects}
        active={onProjects}
      />
      <DockItem
        href="/messages"
        label={t('dock_dialogue')}
        icon={IconDialogue}
        active={onDialogue}
      />
      <DockItem
        href={profileHref}
        label={t('dock_profile')}
        icon={IconProfile}
        active={onProfile}
      />
    </nav>
  );
}
