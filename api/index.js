/**
 * SwiftLogistics API – Vercel serverless (Express)
 * In-memory store (demo). For production use Vercel Postgres / Turso / Neon.
 */
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const app = express();
const JWT_SECRET = process.env.JWT_SECRET || 'swift-logistics-dev-secret-change-me';
const JWT_ADMIN_SECRET = process.env.JWT_ADMIN_SECRET || 'swift-admin-secret-change-me';

const globalStore = globalThis.__swiftStore || {
  users: [],
  admins: [],
  bookings: [],
};
globalThis.__swiftStore = globalStore;

if (globalStore.admins.length === 0) {
  globalStore.admins.push({
    id: 'admin-1',
    name: 'System Admin',
    email: 'admin@swiftlogistics.com',
    password_hash: bcrypt.hashSync('Admin@123', 10),
  });
}

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

function authCustomer(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Login required' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.role !== 'customer') throw new Error('bad role');
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function authAdmin(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Admin login required' });
  try {
    const payload = jwt.verify(token, JWT_ADMIN_SECRET);
    if (payload.role !== 'admin') throw new Error('bad role');
    req.admin = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired admin token' });
  }
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'SwiftLogistics API', runtime: 'vercel' });
});

app.post('/api/auth/register', (req, res) => {
  const { name, email, phone, password } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email and password are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  if (globalStore.users.find((u) => u.email === email.toLowerCase())) {
    return res.status(409).json({ error: 'Email already registered' });
  }
  const id = uuidv4();
  globalStore.users.push({
    id,
    name,
    email: email.toLowerCase(),
    phone: phone || null,
    password_hash: bcrypt.hashSync(password, 10),
    created_at: new Date().toISOString(),
  });
  const token = jwt.sign(
    { id, email: email.toLowerCase(), name, role: 'customer' },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
  res.status(201).json({ token, user: { id, name, email: email.toLowerCase() } });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  const user = globalStore.users.find((u) => u.email === email.toLowerCase());
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  const token = jwt.sign(
    { id: user.id, email: user.email, name: user.name, role: 'customer' },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
  res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
});

app.post('/api/admin/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  const admin = globalStore.admins.find((a) => a.email === email.toLowerCase());
  if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {
    return res.status(401).json({ error: 'Invalid admin credentials' });
  }
  const token = jwt.sign(
    { id: admin.id, email: admin.email, name: admin.name, role: 'admin' },
    JWT_ADMIN_SECRET,
    { expiresIn: '1d' }
  );
  res.json({ token, admin: { id: admin.id, name: admin.name, email: admin.email } });
});

app.get('/api/auth/me', authCustomer, (req, res) => {
  res.json({ user: { id: req.user.id, name: req.user.name, email: req.user.email } });
});

app.post('/api/bookings', authCustomer, (req, res) => {
  const { type, details, amount } = req.body || {};
  if (!type || !details || amount == null) {
    return res.status(400).json({ error: 'type, details and amount are required' });
  }
  const allowed = ['flight', 'ride', 'car', 'shipment'];
  if (!allowed.includes(type)) return res.status(400).json({ error: 'Invalid booking type' });
  const id = 'bk-' + uuidv4().slice(0, 8);
  const booking = {
    id,
    user_id: req.user.id,
    user_name: req.user.name,
    user_email: req.user.email,
    type,
    details,
    amount: Number(amount),
    status: 'pending_payment',
    created_at: new Date().toISOString(),
    paid_at: null,
    approved_at: null,
  };
  globalStore.bookings.unshift(booking);
  res.status(201).json({ booking });
});

app.get('/api/bookings/mine', authCustomer, (req, res) => {
  const bookings = globalStore.bookings.filter((b) => b.user_id === req.user.id);
  res.json({ bookings });
});

app.post('/api/bookings/:id/pay', authCustomer, (req, res) => {
  const booking = globalStore.bookings.find((b) => b.id === req.params.id);
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  if (booking.user_id !== req.user.id) return res.status(403).json({ error: 'Not your booking' });
  if (booking.status !== 'pending_payment') {
    return res.status(400).json({ error: 'Booking is not awaiting payment' });
  }
  booking.status = 'paid';
  booking.paid_at = new Date().toISOString();
  res.json({ booking });
});

app.get('/api/admin/bookings', authAdmin, (req, res) => {
  let bookings = globalStore.bookings;
  const status = req.query.status;
  if (status && status !== 'all') bookings = bookings.filter((b) => b.status === status);
  res.json({ bookings });
});

app.post('/api/admin/bookings/:id/approve', authAdmin, (req, res) => {
  const booking = globalStore.bookings.find((b) => b.id === req.params.id);
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  if (booking.status !== 'paid') {
    return res.status(400).json({ error: 'Only paid bookings can be approved' });
  }
  booking.status = 'approved';
  booking.approved_at = new Date().toISOString();
  res.json({ booking });
});

app.post('/api/admin/bookings/:id/reject', authAdmin, (req, res) => {
  const booking = globalStore.bookings.find((b) => b.id === req.params.id);
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  if (booking.status !== 'paid') {
    return res.status(400).json({ error: 'Only paid bookings can be rejected' });
  }
  booking.status = 'rejected';
  res.json({ booking });
});

app.get('/api/admin/stats', authAdmin, (req, res) => {
  const all = globalStore.bookings;
  res.json({
    total: all.length,
    pending: all.filter((b) => b.status === 'pending_payment').length,
    paid: all.filter((b) => b.status === 'paid').length,
    approved: all.filter((b) => b.status === 'approved').length,
  });
});

module.exports = app;
