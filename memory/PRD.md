# Ambajogai Grocery Store — PRD (Phase 1 Multi-Vendor Marketplace)

## Original problem statement
Build a production-ready Grocery Store website for Ambajogai Grocery Store, then upgrade it into a Multi-Vendor Marketplace with role-based access (customer / vendor / admin), vendor onboarding + approval, vendor-scoped product & order management, extended order lifecycle, coupons, and customer re-order — without breaking any existing functionality.

## User personas
1. **Customer** — Browse, search, order, pay UPI/COD, apply coupons, track live status, re-order past orders.
2. **Vendor** — Public "Become a Vendor" signup; blocked until approved. Manage own catalogue (products, prices, stock, images, units) and own orders (line-status). Cannot see other vendors' data.
3. **Admin** (`admin@ambajogai.com`) — Full platform view. Approves/rejects/suspends vendors, approves vendor products, creates coupons, manages categories & customers, monitors all orders.

## Architecture
- **Frontend**: React 19 + React Router + Tailwind + shadcn/ui + Sonner + Lucide
- **Backend**: FastAPI + Motor async MongoDB + PyJWT + bcrypt (`server.py`)
- **DB collections**: `users`, `vendors`, `products`, `categories`, `orders`, `reviews`, `coupons`, `otps`
- **Auth**: JWT bearer tokens (`localStorage` on the client, `Authorization: Bearer`). Login blocks vendors with `status != Approved`.
- **Payments**: UPI QR (`upi://` deep link + qrserver image) + COD.
- **WhatsApp**: `wa.me` links (floating button, order confirmation, help chat).
- **Portability**: zero Emergent-only dependencies — Vercel / Railway / Render / Hostinger / VPS ready.

## What's implemented (Feb 2026)
### Phase 0 (MVP grocery store)
- Home / Products / PDP / Cart / Checkout / Order tracker / My Orders / About / Contact / Legal / 404 fallback
- Admin panel: dashboard, products CRUD, orders + status update, customers, categories
- Seeded 6 categories + 21 products; JWT auth with bcrypt; UPI/COD; mock OTP

### Phase 1 (Multi-vendor marketplace) — new
- **Vendor onboarding**: public `/become-vendor` form → creates user `role=vendor` + `vendor` doc `status=Pending`. Doc verification via URL fields (Aadhar / GST / Shop Licence)
- **Login gating**: Pending / Rejected / Suspended vendors cannot log in (403 + friendly message)
- **Admin approval panel** (`/admin/vendors`): filter by status, review docs modal, approve / reject-with-reason / suspend
- **Vendor dashboard** (`/vendor`): scoped stats (revenue on delivered items, product/order counts, low-stock, pending-approval callout)
- **Vendor product CRUD** (`/vendor/products`): create/edit/delete own products; `approval_status=pending` on create; only own products visible/editable
- **Admin product approval** (`/admin/products`): Vendor column, Approval badge, Approve/Reject inline buttons calling `PATCH /api/admin/products/<id>/approval`
- **Customer-facing product endpoints** filter to approved-only; PDP-by-slug returns 404 for unapproved
- **Extended order lifecycle**: `Pending → Accepted → Preparing → Packed → Ready → Out For Delivery → Delivered` (plus `Cancelled`)
- **Per-vendor line status**: each order item is tagged with `vendor_id`; vendors update only their own items; overall status derived as the min-progress across non-cancelled lines
- **Coupons**: admin CRUD (`/admin/coupons`) — code, discount %, min order, active, expiry. Customer applies at `/checkout` (`GET /api/coupons/<code>/validate` + POST /api/orders re-validates server-side); OrderDetail summary shows the discount row
- **Re-order** button on `/orders` list → `GET /api/orders/<id>/reorder` adds available items back to cart
- **Header vendor menu**, **footer "Sell with us" link**, **updated tracker with 7 progress steps**

### Security
- Passwords hashed with bcrypt
- JWT bearer tokens (7-day) with role in payload
- Vendor endpoints re-check `role=vendor` **and** `vendor.status=Approved` on every call
- Admin endpoints re-check `role=admin`
- Product prices, coupon discount, stock deduction all recomputed server-side on order create (never trust the client)
- ObjectId inputs validated (400 on malformed) instead of leaking 500

## Testing
Backend: **103/103 pytest** across 4 files
- `backend_test.py` (49 — customer + admin regression)
- `test_vendor_phase1.py` (36 — vendor onboarding, approval, product/order scoping, coupons, reorder)
- `test_iteration6_fixes.py` (8 — admin product approval endpoints + new order statuses)
- `test_iteration7_fixes.py` (10 — PDP 404 for unapproved + all 6 new admin statuses persisted)

Frontend: **100% of retested flows verified** in the real UI by the testing agent — become-vendor confirmation card, pending-vendor login block, admin approval panel with docs modal, vendor dashboard/products/orders, coupon apply on checkout with reconciled OrderDetail summary, vendor line-status propagation to customer tracker, re-order.

## Backlog (P1 / P2)
### P1
- Wire Cloudinary upload to replace URL fields for vendor documents & product images
- Split `Admin.jsx` (~870 lines) and `server.py` (~1271 lines) into focused modules
- Extract order-status list into a single exported constant (`src/lib/constants.js`) shared by Admin / OrderDetail / VendorDashboard
- Admin.jsx small no-unescaped-entities lint cleanup
- Product reviews + vendor ratings UI (backend already stores them)
- Wishlist API + UI

### P2
- Real OTP integration (Twilio / SendGrid)
- Razorpay / Stripe integration replacing the UPI QR
- Rate-limit `/api/auth/login` (brute-force protection)
- Analytics dashboard with charts (Chart.js / Recharts) for admin + vendor
- PWA (installable + offline shell), sitemap.xml, per-vendor storefront pages, SEO meta per PDP

## Test credentials
- Admin: `admin@ambajogai.com` / `Admin@123`
- Sample vendor (Approved): `test_vendor_ui_1785253172@example.com` / `Vendor@123`
- Sample customer: `test_cust_ui_1785253507@example.com` / `Test@123`
