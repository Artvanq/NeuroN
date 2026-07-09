import { getToken } from '../lib/auth';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const PROVIDERS = [
  { slug: 'github', label: 'GitHub', icon: '◆' },
  { slug: 'linkedin', label: 'LinkedIn', icon: 'in' },
  { slug: 'google', label: 'Google', icon: 'G' },
];

export default function OAuthButtons({ link = false, className = '' }) {
  const startOAuth = (slug) => {
    const params = new URLSearchParams();
    if (link) {
      params.set('link', '1');
      const token = getToken();
      if (token) params.set('token', token);
    }
    const qs = params.toString();
    window.location.href = `${API_BASE}/api/auth/oauth/${slug}${qs ? `?${qs}` : ''}`;
  };

  return (
    <div className={`oauth-buttons${className ? ` ${className}` : ''}`} role="group" aria-label="Social sign in">
      <p className="oauth-divider">
        <span>or continue with</span>
      </p>
      <div className="oauth-row">
        {PROVIDERS.map((p) => (
          <button
            key={p.slug}
            type="button"
            className={`oauth-btn oauth-${p.slug}`}
            onClick={() => startOAuth(p.slug)}
          >
            <span className="oauth-icon" aria-hidden>
              {p.icon}
            </span>
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}
