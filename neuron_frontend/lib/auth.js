import { refreshAuth } from './api';

const ACCESS_KEY = 'neuron_access_token';
const USER_KEY = 'neuron_user';

/** In-memory copy — survives route changes, not tab close. */
let accessTokenMemory = null;

export function getToken() {
  if (typeof window === 'undefined') return null;
  if (accessTokenMemory) return accessTokenMemory;
  return sessionStorage.getItem(ACCESS_KEY);
}

export function getStoredUser() {
  if (typeof window === 'undefined') return null;
  const raw = sessionStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setAuth(token, user) {
  accessTokenMemory = token;
  sessionStorage.setItem(ACCESS_KEY, token);
  sessionStorage.setItem(USER_KEY, JSON.stringify(user));
  // Remove legacy long-lived token if present
  localStorage.removeItem('neuron_token');
}

export function updateStoredUser(user) {
  sessionStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuth() {
  accessTokenMemory = null;
  sessionStorage.removeItem(ACCESS_KEY);
  sessionStorage.removeItem(USER_KEY);
  localStorage.removeItem('neuron_token');
  localStorage.removeItem(USER_KEY);
}

export function isLoggedIn() {
  return Boolean(getToken());
}

export function userCanModerate(user) {
  return Array.isArray(user?.permissions) && user.permissions.includes('moderation.read');
}

/**
 * Restore session via httpOnly refresh cookie (no long-lived token in storage).
 */
export async function bootstrapSession() {
  if (typeof window === 'undefined') return null;
  if (getToken() && getStoredUser()) {
    return getStoredUser();
  }
  try {
    const { token, user } = await refreshAuth();
    setAuth(token, user);
    return user;
  } catch {
    clearAuth();
    return null;
  }
}
