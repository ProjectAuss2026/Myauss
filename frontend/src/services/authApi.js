const API_URL = import.meta.env.VITE_API_URL || '';

async function request(endpoint, options = {}) {
  const res = await fetch(`${API_URL}/api/auth${endpoint}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data.error || 'Something went wrong');
    err.status = data.status; // e.g. 'PENDING_VERIFICATION'
    throw err;
  }
  return data;
}

export function registerUser(email, password) {
  return request('/register', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function resendCode(email) {
  return request('/resend-code', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export function verifyUser(email, code) {
  return request('/verify', {
    method: 'POST',
    body: JSON.stringify({ email, code }),
  });
}

export function loginUser(email, password) {
  return request('/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}
