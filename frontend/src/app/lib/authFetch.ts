const TOKEN_KEY = 'token';
const USER_KEY = 'user';
let refreshInFlight: Promise<string | null> | null = null;

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredAuth(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

function withAuthHeader(headers: Headers, token: string | null): Headers {
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return headers;
}

function withRefreshedAuthHeader(headers: Headers, token: string | null): Headers {
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return headers;
}

async function performRefreshAccessToken(): Promise<string | null> {
  const res = await fetch('/api/auth/refresh', {
    method: 'POST',
    credentials: 'include',
  });

  if (!res.ok) {
    clearStoredAuth();
    return null;
  }

  const payload = await res.json().catch(() => null);
  const token = payload?.token;
  if (!token || typeof token !== 'string') {
    clearStoredAuth();
    return null;
  }

  setStoredToken(token);
  if (payload?.user) {
    localStorage.setItem(USER_KEY, JSON.stringify(payload.user));
  }
  return token;
}

export async function refreshAccessToken(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = performRefreshAccessToken().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

export async function fetchWithAuth(url: string, init: RequestInit = {}, retryOnUnauthorized = true): Promise<Response> {
  const initialHeaders = new Headers(init.headers || {});
  const token = getStoredToken();
  const response = await fetch(url, {
    ...init,
    credentials: 'include',
    headers: withAuthHeader(initialHeaders, token),
  });

  if (response.status !== 401 || !retryOnUnauthorized) {
    return response;
  }

  const refreshedToken = await refreshAccessToken();
  if (!refreshedToken) {
    return response;
  }

  const retryHeaders = new Headers(init.headers || {});
  return fetch(url, {
    ...init,
    credentials: 'include',
    headers: withRefreshedAuthHeader(retryHeaders, refreshedToken),
  });
}
