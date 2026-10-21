/**
 * SwiftLogistics Backend
 * Express + SQLite + JWT
 * Separate customer & admin auth
 */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'swift-logistics-dev-secret-change-me';
const JWT_ADMIN_SECRET = process.env.JWT_ADMIN_SECRET || 'swift-admin-secret-change-me';

// ---------- Database ----------
const dbPath = path.join(__dirname, 'data', 'swiftlogistics.db');
const fs = require('fs');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    password_hash TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS admins (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS bookings (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL,
    details TEXT NOT NULL,
    amount REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending_payment',
    created_at TEXT DEFAULT (datetime('now')),
    paid_at TEXT,
    approved_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

// Seed default admin
const adminCount = db.prepare('SELECT COUNT(*) as c FROM admins').get().c;
if (adminCount === 0) {
  const hash = bcrypt.hashSync('Admin@123', 10);
  db.prepare(
    'INSERT INTO admins (id, name, email, password_hash) VALUES (?, ?, ?, ?)'
  ).run(uuidv4(), 'System Admin', 'admin@swiftlogistics.com', hash);
  console.log('Seeded default admin: admin@swiftlogistics.com / Admin@123');
}

// ---------- Middleware ----------
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

function authCustomer(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Login required' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.role !== 'customer') throw new Error('Invalid role');
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
    if (payload.role !== 'admin') throw new Error('Invalid role');
    req.admin = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired admin token' });
  }
}

// ---------- Auth routes ----------
app.post('/api/auth/register', (req, res) => {
  const { name, email, phone, password } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email and password are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (existing) return res.status(409).json({ error: 'Email already registered' });

  const id = uuidv4();
  const hash = bcrypt.hashSync(password, 10);
  db.prepare(
    'INSERT INTO users (id, name, email, phone, password_hash) VALUES (?, ?, ?, ?, ?)'
  ).run(id, name, email.toLowerCase(), phone || null, hash);

  const token = jwt.sign({ id, email: email.toLowerCase(), name, role: 'customer' }, JWT_SECRET, {
    expiresIn: '7d',
  });
  res.status(201).json({ token, user: { id, name, email: email.toLowerCase() } });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
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
  const admin = db.prepare('SELECT * FROM admins WHERE email = ?').get(email.toLowerCase());
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

// ---------- Bookings ----------
app.post('/api/bookings', authCustomer, (req, res) => {
  const { type, details, amount } = req.body || {};
  if (!type || !details || amount == null) {
    return res.status(400).json({ error: 'type, details and amount are required' });
  }
  const allowed = ['flight', 'ride', 'car', 'shipment'];
  if (!allowed.includes(type)) return res.status(400).json({ error: 'Invalid booking type' });

  const id = 'bk-' + uuidv4().slice(0, 8);
  db.prepare(
    `INSERT INTO bookings (id, user_id, type, details, amount, status)
     VALUES (?, ?, ?, ?, ?, 'pending_payment')`
  ).run(id, req.user.id, type, JSON.stringify(details), Number(amount));

  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(id);
  res.status(201).json({
    booking: {
      ...booking,
      details: JSON.parse(booking.details),
    },
  });
});

app.get('/api/bookings/mine', authCustomer, (req, res) => {
  const rows = db
    .prepare('SELECT * FROM bookings WHERE user_id = ? ORDER BY created_at DESC')
    .all(req.user.id);
  res.json({
    bookings: rows.map((r) => ({ ...r, details: JSON.parse(r.details) })),
  });
});

app.post('/api/bookings/:id/pay', authCustomer, (req, res) => {
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  if (booking.user_id !== req.user.id) return res.status(403).json({ error: 'Not your booking' });
  if (booking.status !== 'pending_payment') {
    return res.status(400).json({ error: 'Booking is not awaiting payment' });
  }
  db.prepare(
    `UPDATE bookings SET status = 'paid', paid_at = datetime('now') WHERE id = ?`
  ).run(booking.id);
  const updated = db.prepare('SELECT * FROM bookings WHERE id = ?').get(booking.id);
  res.json({ booking: { ...updated, details: JSON.parse(updated.details) } });
});

// ---------- Admin bookings ----------
app.get('/api/admin/bookings', authAdmin, (req, res) => {
  const status = req.query.status;
  let rows;
  if (status && status !== 'all') {
    rows = db
      .prepare(
        `SELECT b.*, u.name as user_name, u.email as user_email
         FROM bookings b JOIN users u ON u.id = b.user_id
         WHERE b.status = ? ORDER BY b.created_at DESC`
      )
      .all(status);
  } else {
    rows = db
      .prepare(
        `SELECT b.*, u.name as user_name, u.email as user_email
         FROM bookings b JOIN users u ON u.id = b.user_id
         ORDER BY b.created_at DESC`
      )
      .all();
  }
  res.json({
    bookings: rows.map((r) => ({ ...r, details: JSON.parse(r.details) })),
  });
});

app.post('/api/admin/bookings/:id/approve', authAdmin, (req, res) => {
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  if (booking.status !== 'paid') {
    return res.status(400).json({ error: 'Only paid bookings can be approved' });
  }
  db.prepare(
    `UPDATE bookings SET status = 'approved', approved_at = datetime('now') WHERE id = ?`
  ).run(booking.id);
  const updated = db.prepare('SELECT * FROM bookings WHERE id = ?').get(booking.id);
  res.json({ booking: { ...updated, details: JSON.parse(updated.details) } });
});

app.post('/api/admin/bookings/:id/reject', authAdmin, (req, res) => {
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  if (booking.status !== 'paid') {
    return res.status(400).json({ error: 'Only paid bookings can be rejected' });
  }
  db.prepare(`UPDATE bookings SET status = 'rejected' WHERE id = ?`).run(booking.id);
  const updated = db.prepare('SELECT * FROM bookings WHERE id = ?').get(booking.id);
  res.json({ booking: { ...updated, details: JSON.parse(updated.details) } });
});

app.get('/api/admin/stats', authAdmin, (req, res) => {
  const total = db.prepare('SELECT COUNT(*) as c FROM bookings').get().c;
  const pending = db.prepare("SELECT COUNT(*) as c FROM bookings WHERE status = 'pending_payment'").get().c;
  const paid = db.prepare("SELECT COUNT(*) as c FROM bookings WHERE status = 'paid'").get().c;
  const approved = db.prepare("SELECT COUNT(*) as c FROM bookings WHERE status = 'approved'").get().c;
  res.json({ total, pending, paid, approved });
});

// Health
app.get('/api/health', (req, res) => res.json({ ok: true, service: 'SwiftLogistics API' }));

app.listen(PORT, () => {
  console.log(`SwiftLogistics API running on http://localhost:${PORT}`);
});
