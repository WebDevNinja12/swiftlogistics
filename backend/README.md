# SwiftLogistics Backend

Real backend for the logistics website.

## Stack
- **Express** – REST API
- **better-sqlite3** – SQLite database (file-based, zero config)
- **bcryptjs** – password hashing
- **jsonwebtoken** – separate JWT secrets for customers vs admins

## Setup

```bash
cd backend
npm install
cp .env.example .env   # edit secrets for production
npm start
```

API runs at `http://localhost:4000`.

## Default admin
- Email: `admin@swiftlogistics.com`
- Password: `Admin@123`

## Main endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/register` | – | Customer register |
| POST | `/api/auth/login` | – | Customer login |
| POST | `/api/admin/login` | – | Admin login (separate) |
| POST | `/api/bookings` | Customer | Create booking |
| GET | `/api/bookings/mine` | Customer | List my bookings |
| POST | `/api/bookings/:id/pay` | Customer | Mark paid (demo payment) |
| GET | `/api/admin/bookings` | Admin | List all / filter by status |
| POST | `/api/admin/bookings/:id/approve` | Admin | Approve paid booking |
| POST | `/api/admin/bookings/:id/reject` | Admin | Reject paid booking |

## Status flow
`pending_payment` → `paid` → `approved` | `rejected`
