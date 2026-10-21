// ===== Auth & Data Layer (localStorage + optional API) =====
const STORAGE = {
  users: 'sl_users',
  admins: 'sl_admins',
  bookings: 'sl_bookings',
  session: 'sl_session',
  adminSession: 'sl_admin_session'
};

(function seedAdmin() {
  const admins = JSON.parse(localStorage.getItem(STORAGE.admins) || '[]');
  if (admins.length === 0) {
    admins.push({
      id: 'admin-1',
      email: 'admin@swiftlogistics.com',
      password: 'Admin@123',
      name: 'System Admin'
    });
    localStorage.setItem(STORAGE.admins, JSON.stringify(admins));
  }
})();

function getUsers() { return JSON.parse(localStorage.getItem(STORAGE.users) || '[]'); }
function saveUsers(users) { localStorage.setItem(STORAGE.users, JSON.stringify(users)); }
function getBookings() { return JSON.parse(localStorage.getItem(STORAGE.bookings) || '[]'); }
function saveBookings(bookings) { localStorage.setItem(STORAGE.bookings, JSON.stringify(bookings)); }
function getSession() { return JSON.parse(localStorage.getItem(STORAGE.session) || 'null'); }
function setSession(user) { localStorage.setItem(STORAGE.session, JSON.stringify(user)); }
function clearSession() { localStorage.removeItem(STORAGE.session); }
function getAdminSession() { return JSON.parse(localStorage.getItem(STORAGE.adminSession) || 'null'); }
function setAdminSession(admin) { localStorage.setItem(STORAGE.adminSession, JSON.stringify(admin)); }
function clearAdminSession() { localStorage.removeItem(STORAGE.adminSession); }

function registerUser({ name, email, phone, password }) {
  const users = getUsers();
  if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
    return { ok: false, error: 'Email already registered' };
  }
  const user = {
    id: 'u-' + Date.now(),
    name, email: email.toLowerCase(), phone, password,
    createdAt: new Date().toISOString()
  };
  users.push(user);
  saveUsers(users);
  setSession({ id: user.id, name: user.name, email: user.email });
  return { ok: true, user };
}

function loginUser(email, password) {
  const users = getUsers();
  const user = users.find(u => u.email === email.toLowerCase() && u.password === password);
  if (!user) return { ok: false, error: 'Invalid email or password' };
  setSession({ id: user.id, name: user.name, email: user.email });
  return { ok: true, user };
}

function loginAdmin(email, password) {
  const admins = JSON.parse(localStorage.getItem(STORAGE.admins) || '[]');
  const admin = admins.find(a => a.email === email.toLowerCase() && a.password === password);
  if (!admin) return { ok: false, error: 'Invalid admin credentials' };
  setAdminSession({ id: admin.id, name: admin.name, email: admin.email });
  return { ok: true, admin };
}

function logout() {
  clearSession();
  if (window.Api) window.Api.logout();
  window.location.href = window.location.pathname.includes('/pages/') || window.location.pathname.includes('/admin/')
    ? '../index.html' : 'index.html';
}

function logoutAdmin() {
  clearAdminSession();
  if (window.Api) window.Api.logoutAdmin();
  window.location.href = 'login.html';
}

function requireAuth(redirectTo = 'login.html') {
  const session = getSession();
  if (!session) {
    alert('Please log in to continue.');
    window.location.href = redirectTo;
    return null;
  }
  return session;
}

function requireAdmin() {
  const session = getAdminSession();
  if (!session) {
    window.location.href = 'login.html';
    return null;
  }
  return session;
}

function createBooking(data) {
  const session = getSession();
  if (!session) return { ok: false, error: 'Not authenticated' };
  const bookings = getBookings();
  const booking = {
    id: 'bk-' + Date.now(),
    userId: session.id,
    userName: session.name,
    userEmail: session.email,
    ...data,
    status: 'pending_payment',
    createdAt: new Date().toISOString(),
    paidAt: null,
    approvedAt: null
  };
  bookings.unshift(booking);
  saveBookings(bookings);
  return { ok: true, booking };
}

function updateBookingStatus(id, status, extra = {}) {
  const bookings = getBookings();
  const idx = bookings.findIndex(b => b.id === id);
  if (idx === -1) return false;
  bookings[idx].status = status;
  Object.assign(bookings[idx], extra);
  saveBookings(bookings);
  return true;
}

function getUserBookings(userId) {
  return getBookings().filter(b => b.userId === userId);
}

function updateNavAuth() {
  const session = getSession();
  const authLinks = document.getElementById('authLinks');
  const userMenu = document.getElementById('userMenu');
  if (!authLinks || !userMenu) return;
  if (session) {
    authLinks.style.display = 'none';
    userMenu.style.display = 'flex';
    userMenu.style.alignItems = 'center';
    userMenu.style.gap = '0.75rem';
    const greet = userMenu.querySelector('.user-greeting');
    if (greet) greet.textContent = 'Hi, ' + session.name.split(' ')[0];
  } else {
    authLinks.style.display = 'flex';
    authLinks.style.gap = '0.5rem';
    userMenu.style.display = 'none';
  }
}

document.addEventListener('DOMContentLoaded', updateNavAuth);
