# 999+ KART Growth Features Pack

This bundle is built on the supplied `999-KART-with-Notifications.zip` project snapshot (React 19, TypeScript, Vite, React Router and Supabase). It retains the existing storefront, customer pages, admin pages, category records and order flow.

## Included and connected

- Customer Growth Hub at `/account/benefits` with account-menu entry.
- Wishlist storage and management using `public.wishlists`.
- Active coupon listing and secure server-side coupon validation RPC (`validate_coupon`).
- Loyalty wallet display and automatic points credit when an order status changes to `delivered` (1 point per ₹100 of order subtotal, minimum 1 point).
- Product comparison (up to four) persisted in browser local storage.
- Catalogue-based shopping helper. This is a deterministic product search helper, not a generative AI service and does not call an external AI API.
- Referral programme table structure and referral-code display placeholder. Referral signup attribution and reward settlement still need to be wired into your registration and order Edge Functions.
- Abandoned-cart storage schema. Cart snapshot capture, reminder scheduling and WhatsApp/email delivery still need to be wired into cart events and a scheduled Edge Function/automation.
- Admin analytics page at `/admin/analytics`, protected by the existing admin route guard and backed by an admin-only RPC.

## Installation

1. Make a backup of the Supabase database.
2. Open Supabase Dashboard → SQL Editor.
3. Run `supabase/migrations/202611140001_growth_features.sql` once.
4. Replace your local project with the contents of this ZIP, or merge the added files and updated `src/App.tsx` and `src/features/admin/components/AdminLayout.tsx` into your current project.
5. Keep your existing `.env` values. The project needs `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
6. In the project folder run:

   ```bash
   npm install
   npm run build
   npm run dev
   ```

7. Sign in as an administrator and visit `/admin/analytics`. Sign in as a customer and visit `/account/benefits`.

## Important checkout security note

`validate_coupon(code, subtotal)` checks coupon eligibility and computes the discount on the database side. It is deliberately not wired into the current COD checkout yet because the existing `place-cod-order` Edge Function is the trusted place that calculates prices and inserts orders. Before accepting coupon discounts, update that Edge Function to call the validation function, store the verified discount on the order, and create a `coupon_redemptions` row in the same transaction. Never trust a discount amount sent by the browser.

## Admin coupon setup

After running the migration, create coupon rows in Supabase Table Editor → `coupons`. Example:

```sql
insert into public.coupons
(code,title,description,discount_type,discount_value,minimum_order_value,maximum_discount,per_user_limit,is_active)
values ('WELCOME10','Welcome offer','10% off your first eligible order','percentage',10,499,150,1,true);
```

## Database objects created

- `wishlists`
- `coupons`
- `coupon_redemptions`
- `loyalty_transactions`
- `customer_referrals`
- `abandoned_carts`
- `validate_coupon(text,numeric)` RPC
- `get_admin_store_kpis()` admin-only RPC
- `award_loyalty_points_on_delivery()` trigger function and `trg_award_loyalty_points` trigger

The migration does not clear or replace existing categories, products, users or orders. It is additive. Review the SQL and test on a backup/staging project before applying to production.
