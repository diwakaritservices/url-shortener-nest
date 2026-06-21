import type { AuthUser } from './api';

const USER_KEY = 'url_shortener_user';

export function saveUser(user: AuthUser): void {
  sessionStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getUser(): AuthUser | null {
  const rawUser = sessionStorage.getItem(USER_KEY);

  if (!rawUser) {
    return null;
  }

  try {
    return JSON.parse(rawUser) as AuthUser;
  } catch {
    clearAuth();
    return null;
  }
}

export function clearAuth(): void {
  sessionStorage.removeItem(USER_KEY);
}

export function hasStoredUser(): boolean {
  return getUser() !== null;
}
