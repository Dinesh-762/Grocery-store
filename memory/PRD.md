# Ambajogai Grocery Store — PRD (Multi-Vendor Marketplace)

## Original problem statement
Build a production-ready Grocery Store website for Ambajogai Grocery Store, then upgrade it into a Multi-Vendor Marketplace with role-based access (customer / vendor / admin / delivery), vendor onboarding + approval, vendor-scoped product & order management, extended order lifecycle, coupons, delivery boy panel, business center, and customer re-order — without breaking any existing functionality.

## User personas
1. **Customer** — Browse, search, order, pay UPI/COD, apply coupons, track live status, save addresses, re-order past orders, reset password via email OTP.
2. **Vendor** — Public "Become a Vendor" signup; blocked until approved. Manage own catalogue (products, prices, stock, direct image upload, variants) and own orders (line-status). Business Center: analytics, commission, store open/close, vacation mode.
3. **Admin** (`admin@ambajogai.com`) — Full platform view. Approves/rejects/suspends vendors, approves vendor products, creates coupons, manages categories (direct image upload) & customers, monitors all orders with strict forward-only status flow, delivery-boy management, sales analytics, audible new-order alerts.
4. **Delivery Boy** — Sees assigned orders with audible new-assignment alerts, updates status (Out For Delivery / Delivered / Cancelled), tracks earnings.

## Architecture
- **Frontend**: React 19 + React Router + Tailwind + shadcn/ui + Sonner + Lucide + Web Audio API
- **Backend**: FastAPI + Motor async MongoDB + PyJWT + bcrypt + httpx + Cloudinary (`server.py`)
- **DB collections**: `users` (with `saved_addresses`), `vendors`, `products`, `categories`, `orders`, `reviews`, `coupons`, `otps`, `password_resets`
- **Auth**: JWT bearer tokens (`localStorage`, `Authorization: Bearer`). Login blocks vendors with `status != Approved`. Forgot-password via email OTP (Emergent-managed Resend).
- **Payments**: UPI QR (`upi://` deep link + qrserver image) + COD.
- **Uploads**: Cloudinary via `POST /api/upload/image` (already-configured account keys in .env).
- **Delivery fee**: Mandi Bazar center (18.735994, 76.3891403), ₹15 up to 1.5 km + ₹12/km beyond, free above ₹499.
- **WhatsApp**: `wa.me` links.

### Phase 5 (Feb 2026 — Push + Map + Rating batch)
- **VAPID Web Push** for admins: real `serviceWorker` (`/sw.js`) + `pushManager.subscribe`. Server sends push via `pywebpush` **from inside `POST /api/orders`** so notifications arrive even when the admin's tab/browser is closed. Endpoints: `GET /api/push/vapid-public-key`, `POST /api/push/subscribe` (admin/delivery only, RBAC-gated), `POST /api/push/unsubscribe`. Dead endpoints (410/404) auto-cleaned. VAPID keys live in `.env` under `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT`.
- **Live map preview at checkout**: after auto-detect, an inline OpenStreetMap embed shows the pinned drop-off with an "Open in maps ↗" link. Distance-from-Mandi-Bazar is displayed and still drives the correct fee tier (₹15/₹12-per-km — unchanged).
- **Vendor rating pill on storefront**: `/api/vendors/{id}` now aggregates reviews (by `vendor_id` **and** vendor-owned `product_slug`) and returns `avg_rating` + `review_count`. UI shows a ★ pill next to the Open-now indicator.

### Phase 4 (Feb 2026 — Post-launch polish batch)
- **Vendor storefront prominence**: Open-now / Closed / Vacation pill promoted next to business name with today's hours inline. Full weekly hours grid now always visible (Today row highlighted). Closed vendors show a full-width red/yellow banner explaining orders can't be placed.
- **Browser push notifications for Admin**: On unmuting the new-order alert, admin is prompted for `Notification` permission; every new pending order triggers a system-level notification (`Ambajogai — New order`) in addition to the Web-Audio chirp and toast. Works when the tab is backgrounded.
- **Checkout location auto-detect**: "Use my current location" button uses `navigator.geolocation` + Nominatim reverse-geocode (no API key) to auto-fill `line1`, `area`, `pincode`. Haversine distance from Mandi Bazar auto-selects the correct `distance_km` tier so the delivery fee still uses the production ₹15 / ₹12-per-km formula.
- **WhatsApp OTP fallback**: `/forgot-password` step 2 now has a "Still no code? Get help on WhatsApp" button that opens `wa.me` with a pre-filled message to the store admin. Purely a customer-support fallback — the primary email OTP path is unchanged.
- **Customer live order timeline**: `OrderDetail` now polls `GET /api/orders/{id}` every 20 s while the order is pre-Delivered, with a pulsing "🟢 Live · refreshes every 20s" indicator next to the status heading. Status_history timestamps update in-place as vendors/admin advance the order.

### Preserved (must-keep) rules
- **Delivery formula unchanged**: Mandi Bazar (18.735994, 76.3891403) center, ₹15 up to 1.5 km, ₹12/km beyond, free above ₹499 — verified live via `/api/store/info`.

## What's implemented (Feb 2026)
### Phase 0 (MVP grocery store)
- Home / Products / PDP / Cart / Checkout / Order tracker / My Orders / About / Contact / Legal
- Admin panel: dashboard, products CRUD, orders + status update, customers, categories

### Phase 1 (Multi-vendor marketplace)
- Vendor onboarding + approval flow
- Vendor dashboard, product CRUD (approval-gated), order line-status
- Admin product approval, coupons
- Extended 7-step order lifecycle
- Re-order button

### Phase 2 (Business center + delivery)
- Vendor Business Center (analytics, hours, vacation mode, commission)
- Delivery Boy panel (assigned orders, earnings, history)
- Smart order assignment + WhatsApp notifications
- Product variants with server-side validation

### Phase 3 (Feb 2026 — Message 363 batch)
- **Home**: "Shop by Store" section groups products by vendor with view-store links.
- **Discounts**: Manual "Apply" button on checkout (no auto-apply).
- **Saved addresses**: Users save multiple (Home/Work/Other) addresses to profile; pick or add at checkout; trash icon to delete. Endpoints: `GET/POST/DELETE /api/users/me/addresses`.
- **Delivery fee**: Mandi Bazar center, ₹15 up to 1.5 km, ₹12/km beyond, free above ₹499.
- **New-order alert**: Web-Audio chirp for Admin & Delivery via 15s polling of `/api/admin/orders/pending-count` and `/api/delivery/new-count`. Persistent 🔔 / 🔕 toggle stored in localStorage.
- **Vendor & Admin image upload**: Cloudinary upload input in Admin Category form (in addition to vendor products which already had it).
- **Strict order flow**: `PATCH /api/admin/orders/{id}/status` allows only forward-by-one progression (Pending → Accepted → Preparing → Packed → Ready → Out For Delivery → Delivered) and Cancel (any time before Delivered). Frontend dropdown only shows allowed statuses.
- **Forgot password**: `POST /api/auth/forgot-password` and `POST /api/auth/reset-password` — sends 6-digit OTP to email via Emergent-managed Resend, 10-minute expiry, 5-attempt lockout. New `/forgot-password` UI (2-step: email → OTP + new password) linked from login page.

### Security
- Passwords bcrypt-hashed, JWT bearer (7-day), server-side re-validation of prices/coupons/stock.
- ObjectId inputs validated (400 not 500 on malformed).
- Forgot-password: rate-limited attempts + anti-enumeration ("if account exists" response).
- Email HTML pass-through the Emergent guardrail gate (`_assert_safe_email`) — no forms/inputs, https-only, no impersonation.

## Testing (Feb 2026)
- Iter 16 (Message 363 batch): **26/26 pytest backend + 100% frontend flows** — `/app/backend/tests/test_iteration16_new_features.py`.
- Earlier iterations 1-15 covered auth, vendor onboarding, coupons, order lifecycle, delivery, business center, variants, WhatsApp templates.

## Test credentials
- Admin: `admin@ambajogai.com` / `Admin@123`
- Sample vendor (Approved): `test_vendor_ui_1785253172@example.com` / `Vendor@123`
- Sample customer: `test_it16_cust_ui@example.com` / `Test@123`
- Sample delivery boy: `test_it16_dp_ui@example.com` / `Deliver@123`

## Backlog (P1 / P2)
### P1
- [DONE Feb 2026] ✅ 60-second cooldown on `/api/auth/forgot-password` per email; attempts are preserved across OTP re-requests so the 5-attempt lockout can't be reset.
- [DONE Feb 2026] ✅ `POST /api/upload/image` now requires auth (admin or vendor), enforces MIME whitelist (JPG/PNG/WEBP/GIF), and caps size at 5 MB (413 on oversize).
- [DONE Feb 2026] ✅ Admin order-status backward transitions now return `"Order cannot move backward from {current} to {new}"` instead of the forward-hint message.
- Split `server.py` (~2300 lines) and `Admin.jsx` (~1460 lines) into modules.
- TTL index on `password_resets`.
- Replace `window.confirm` on address-delete with shadcn `AlertDialog`.
- Fix broken seeded vendor banner/logo image URLs.

### P2
- Real SMS OTP (Twilio) as fallback for email.
- Razorpay / Stripe integration replacing the UPI QR.
- PWA, sitemap, per-vendor SEO pages.
- Push notifications (Web Push) so new-order alerts fire even when the tab is backgrounded.
