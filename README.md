# Ambajogai Grocery Store

Production-ready full-stack grocery e-commerce for **Ambajogai Grocery Store**. Search, order, pay via UPI/COD, track deliveries, and stay in touch on WhatsApp — all in one modern web app.

- **Frontend**: React 19 + React Router + Tailwind + shadcn/ui + Lucide icons + Sonner toasts
- **Backend**: FastAPI + Motor (async MongoDB) + PyJWT + bcrypt
- **Database**: MongoDB
- **Auth**: Email + password with JWT bearer tokens (mock OTP endpoints included)
- **Payments**: UPI QR (via `upi://` deep link + QR image) + Cash on Delivery
- **WhatsApp**: `wa.me` deep links (floating button, order confirmations, help chat)

Everything is open-source and portable — clone, edit, and deploy anywhere.

---

## Quick start (local)

### Prerequisites
- Node.js 18+ and Yarn
- Python 3.11+
- MongoDB 6+ running locally (or a MongoDB Atlas connection string)

### 1. Backend
```bash
cd backend
pip install -r requirements.txt
cp .env.example .env   # or edit /app/backend/.env directly
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

### 2. Frontend
```bash
cd frontend
yarn install
yarn start
```
The React app runs on port 3000 and calls the backend via `REACT_APP_BACKEND_URL/api`.

### 3. Admin login
- Email: `admin@ambajogai.com`
- Password: `Admin@123`
Change these in `backend/.env` before going to production.

---

## Environment variables (`backend/.env`)

| Variable | Purpose |
| --- | --- |
| `MONGO_URL` | MongoDB connection string |
| `DB_NAME` | Database name |
| `JWT_SECRET` | Secret used to sign JWT tokens (change in prod!) |
| `JWT_EXPIRE_DAYS` | JWT expiry (days) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Seeded admin account credentials |
| `STORE_NAME` | Store display name |
| `STORE_WHATSAPP` | WhatsApp phone number in `+countrycodeXXXXXXXXXX` |
| `STORE_UPI_ID` | UPI VPA used in the QR (e.g. `store@upi`) |
| `STORE_UPI_NAME` | Name that appears in UPI app |
| `CLOUDINARY_*` | Optional Cloudinary keys if you enable image upload |

Frontend `.env` needs only `REACT_APP_BACKEND_URL`.

---

## Project structure

```
app/
├── backend/
│   ├── server.py         # FastAPI app (auth, products, orders, admin, seed)
│   ├── requirements.txt
│   └── .env
└── frontend/
    ├── package.json
    ├── tailwind.config.js
    └── src/
        ├── App.js           # Router
        ├── index.css        # Design tokens + fonts
        ├── lib/api.js       # Axios instance + helpers
        ├── context/
        │   ├── AuthContext.jsx
        │   └── CartContext.jsx
        ├── components/
        │   ├── Header.jsx
        │   ├── Footer.jsx
        │   ├── ProductCard.jsx
        │   ├── ProtectedRoute.jsx
        │   ├── WhatsAppFloat.jsx
        │   └── ui/          # shadcn primitives
        └── pages/           # Home, Products, ProductDetail, Cart, Checkout,
                             # Login, Register, Orders, OrderDetail, About,
                             # Contact, Legal, Admin
```

---

## Key features

### Customer flow
- Browse by category or search
- Product detail with quantity selector
- Persistent cart (localStorage)
- Address + payment checkout (UPI QR / COD)
- WhatsApp confirmation pops open after every order
- Track live order status (Pending → Confirmed → Packed → Out For Delivery → Delivered)
- My Orders history

### Admin panel (`/admin`)
- Dashboard: revenue, orders, low stock alerts, recent orders
- Products: full CRUD with categories, MRP, stock, featured/popular flags
- Orders: filter by status, expand items, update status inline
- Customers: list of registered users
- Categories: full CRUD

### Security
- Passwords hashed with **bcrypt**
- **JWT** access tokens (default 7 days) stored in `localStorage`
- Admin routes gated by role check on both frontend and backend
- Input validation via Pydantic

---

## API overview

All endpoints prefixed with `/api`. Full list:

### Auth
- `POST /auth/register` `{ name, email, password, phone? }`
- `POST /auth/login`    `{ email, password }`
- `GET  /auth/me`       (Bearer token)
- `POST /auth/otp/request` (mock)
- `POST /auth/otp/verify`  (mock)

### Public
- `GET  /categories`
- `GET  /products?category=&q=&featured=&popular=&limit=`
- `GET  /products/:slug`
- `GET  /reviews?product_slug=`
- `POST /reviews`
- `GET  /store/info`

### Authenticated (customer)
- `POST /orders`
- `GET  /orders/my`
- `GET  /orders/:id`

### Admin
- `POST /products` · `PUT /products/:id` · `DELETE /products/:id`
- `POST /categories` · `DELETE /categories/:id`
- `GET  /admin/dashboard`
- `GET  /admin/orders?status=`
- `PATCH /admin/orders/:id/status` `{ status }`
- `GET  /admin/customers`

---

## Deployment

The app has zero vendor lock-in. Common deployment targets:

### Frontend (Vercel / Netlify / Hostinger static)
```bash
cd frontend
yarn build
# outputs to frontend/build — deploy that folder
```
Set env var `REACT_APP_BACKEND_URL=https://your-api-domain.com`.

### Backend (Railway / Render / VPS)
```bash
cd backend
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port $PORT
```
Set all env vars from `.env`. Point `MONGO_URL` to your MongoDB Atlas cluster.

### Database (MongoDB Atlas — free tier is plenty)
1. Create a free cluster on https://cloud.mongodb.com
2. Whitelist your backend server IP (or 0.0.0.0/0 for testing)
3. Copy the SRV connection string into `MONGO_URL`

---

## Roadmap / Notes

- Cloudinary upload endpoint & UI can be added — env vars are already scaffolded
- Real SMS/Email OTP via Twilio/SendGrid can plug into `/api/auth/otp/*`
- Payment gateway (Razorpay/Stripe) can replace the UPI QR flow
- Wishlist API is stubbed on the frontend (`Wishlist Ready` button placement) — extend with a `wishlists` collection

---

## License

MIT — you fully own this project. Rip, remix, ship it however you like.
