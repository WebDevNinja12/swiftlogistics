# SwiftLogistics

Full logistics platform: book flights, rides, car rentals and goods shipment.

## Features
- Customer registration & login
- **Separate admin login** (`admin@swiftlogistics.com` / `Admin@123`)
- Book flights, rides, car rentals, goods shipment (road / air / sea)
- Booking only when logged in
- Payment required before admin approval
- Pages: Home, About, Services, Contact, Customer Dashboard, Admin Dashboard

## Structure

```
├── index.html, pages/, admin/, css/, js/   # Frontend (static)
├── backend/                               # Real API (Express + SQLite + JWT)
│   ├── server.js
│   ├── package.json
│   └── README.md
└── README.md
```

## Frontend (demo mode)
Open `index.html` or deploy the static files. Data lives in `localStorage`.

## Backend (real database + auth)

```bash
cd backend
npm install
npm start
```

API: `http://localhost:4000`

- Customer JWT and Admin JWT use **separate secrets**
- SQLite file database (`backend/data/swiftlogistics.db`)
- Password hashing with bcrypt
- Booking flow: `pending_payment` → `paid` → `approved` / `rejected`

See `backend/README.md` for all endpoints.

## Live demo
Vercel (static frontend): https://swiftlogistics-web-dev-ninja-12-s-projects.vercel.app

## Default admin
- Email: admin@swiftlogistics.com
- Password: Admin@123
