# Ambajogai Grocery Store — PRD

## Original problem statement
Build a COMPLETE production-ready Grocery Store Website for Ambajogai Grocery Store where customers can search products, order groceries online, pay via UPI/COD, track orders and communicate with the store on WhatsApp. Must look like a modern commercial product, use open-source tech only, and be portable (no vendor lock-in).

## User personas
1. **Local customer** — Browses categories, searches, orders daily essentials, pays via UPI/COD, tracks delivery, chats on WhatsApp for support.
2. **Store admin** (`admin@ambajogai.com`) — Manages products/categories, monitors orders, updates order statuses, sees revenue and low-stock alerts.

## Architecture (v1)
- **Frontend**: React 19 (CRA + Craco) · React Router · Tailwind · shadcn/ui · Sonner · Lucide
- **Backend**: FastAPI · Motor async MongoDB driver · PyJWT · bcrypt
- **DB**: MongoDB (collections: `users`, `products`, `categories`, `orders`, `reviews`, `otps`)
- **Auth**: JWT bearer tokens (localStorage on client, `Authorization` header) with bcrypt password hashing. Mock OTP endpoints stubbed.
- **Payments**: UPI QR (upi:// deep link + qrserver image) + Cash on Delivery. No payment gateway integration.
- **WhatsApp**: `wa.me` deep links (floating button, order confirmation on checkout, help link from order detail, contact form).

## What's implemented (v1 — Feb 2026)
- Full customer flow: Home → Products → Detail → Cart → Checkout → Order Detail with live tracker
- User auth (register / login / logout / /me / mock OTP)
- Persistent cart in localStorage
- Order creation with delivery fee logic (free above ₹499)
- Admin panel: dashboard (revenue, low stock, recent orders), Products CRUD, Orders + status update, Customers, Categories CRUD
- Seeded 6 categories and 20+ products across fruits/veg, dairy, staples, spices, snacks, personal care
- WhatsApp floating button pulled from `/api/store/info`
- SEO-friendly semantic markup, mobile-first responsive, keyboard-accessible
- README + `.env.example` + `test_credentials.md`

## Backlog (P1 / P2)
### P1
- Wishlist API + UI (backend collection + save/remove buttons)
- Cloudinary image upload for product admin (env vars scaffolded)
- User profile/saved addresses page
- Order cancellation from customer side

### P2
- Real OTP integration (Twilio / SendGrid)
- Razorpay / Stripe / UPI-verify payment flow (auto-mark COD-vs-paid)
- Product reviews with logged-in user (only after delivery)
- Coupon codes / discount engine
- SEO meta tags + sitemap.xml
- PWA (offline shell + install prompt)
- Analytics dashboard with charts

## Next tasks
- Testing agent end-to-end pass
- After user feedback, prioritise backlog by business impact
