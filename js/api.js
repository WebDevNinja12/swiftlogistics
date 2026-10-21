/**
 * API client for SwiftLogistics backend
 * Set window.API_BASE to your backend URL (default http://localhost:4000)
 */
const API_BASE = (typeof window !== 'undefined' && window.API_BASE) || 'http://localhost:4000';

function getToken() {
  return localStorage.getItem('sl_token');
}
function setToken(t) {
  if (t) localStorage.setItem('sl_token', t);
  else localStorage.removeItem('sl_token');
}
function getAdminToken() {
  return localStorage.getItem('sl_admin_token');
}
function setAdminToken(t) {
  if (t) localStorage.setItem('sl_admin_token', t);
  else localStorage.removeItem('sl_admin_token');
}

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText || 'Request failed');
  return data;
}

const Api = {
  async register({ name, email, phone, password }) {
    const data = await api('/api/auth/register', { method: 'POST', body: { name, email, phone, password } });
    setToken(data.token);
    localStorage.setItem('sl_session', JSON.stringify(data.user));
    return data;
  },
  async login(email, password) {
    const data = await api('/api/auth/login', { method: 'POST', body: { email, password } });
    setToken(data.token);
    localStorage.setItem('sl_session', JSON.stringify(data.user));
    return data;
  },
  async adminLogin(email, password) {
    const data = await api('/api/admin/login', { method: 'POST', body: { email, password } });
    setAdminToken(data.token);
    localStorage.setItem('sl_admin_session', JSON.stringify(data.admin));
    return data;
  },
  logout() {
    setToken(null);
    localStorage.removeItem('sl_session');
  },
  logoutAdmin() {
    setAdminToken(null);
    localStorage.removeItem('sl_admin_session');
  },
  async createBooking({ type, details, amount }) {
    return api('/api/bookings', {
      method: 'POST',
      token: getToken(),
      body: { type, details, amount },
    });
  },
  async myBookings() {
    return api('/api/bookings/mine', { token: getToken() });
  },
  async payBooking(id) {
    return api(`/api/bookings/${id}/pay`, { method: 'POST', token: getToken() });
  },
  async adminBookings(status = 'all') {
    const q = status && status !== 'all' ? `?status=${status}` : '';
    return api(`/api/admin/bookings${q}`, { token: getAdminToken() });
  },
  async approveBooking(id) {
    return api(`/api/admin/bookings/${id}/approve`, { method: 'POST', token: getAdminToken() });
  },
  async rejectBooking(id) {
    return api(`/api/admin/bookings/${id}/reject`, { method: 'POST', token: getAdminToken() });
  },
  async adminStats() {
    return api('/api/admin/stats', { token: getAdminToken() });
  },
  async health() {
    return api('/api/health');
  },
};

window.Api = Api;
window.API_BASE = API_BASE;
