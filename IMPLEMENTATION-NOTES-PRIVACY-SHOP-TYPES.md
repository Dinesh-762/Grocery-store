# Ambajogai Grocery Store — Privacy & Shop-Type Update

## Customer/vendor data visibility
- Public vendor listings and storefront APIs expose the store identity (name and shop type) plus the approved product/category catalogue only.
- Vendor order APIs return the customer name and that vendor's own line items. Customer phone, email, address, GPS/location and payment-method details are not included in vendor order responses or the vendor order screen.
- Vendor order queries remain scoped to line items belonging to the authenticated vendor.
- Customer order APIs remain scoped to the authenticated customer. Admin order/vendor APIs retain the full records required for administration.

## Shop types and category assignment
- `fruits_vegetables` vendors receive only `Fruits & Vegetables` (`fruits-vegetables`).
- `kirana_store` vendors receive the other six categories: Cleaning & Household, Dairy & Bakery, Personal Care, Snacks & Beverages, Spices & Masala, and Staples & Grains.
- New vendor registration captures a shop type. Older API clients that omit it are classified from business metadata, with Kirana as the fallback.
- Existing vendors are classified idempotently at backend startup from their existing product categories and business metadata. Ambiguous legacy records are assigned Kirana so category access is not left empty, and are flagged for admin confirmation in the Vendors panel.
- Admins can correct/confirm a vendor's shop type. Vendor product creation/editing and admin product assignment validate category ownership server-side.
- The homepage now separates approved vendors into FRESH VEGETABLES and KIRANA STORE sections. Vendor storefronts show the category groups for their shop type, and category pages show only that vendor's approved products.

## Category image sources
The seven category image URLs supplied for this update are stored in the category seed data. Existing category records are updated with the current names, images and shop-type grouping during backend startup.

## Safety / rollout
- No live database was accessed or modified while preparing this archive.
- No `.env` or secret files are included.
- The idempotent shop-type migration runs when the backend's existing `seed_data()` startup routine runs. Review vendors marked **Needs review — defaulted to Kirana** in Admin → Vendors and confirm/correct their type.
- No deployment was performed. Review the archive locally before deploying.
