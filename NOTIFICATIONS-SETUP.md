# 999+ KART Notifications setup

## Files added
- `src/features/customer/pages/Notifications.tsx`
- `src/features/customer/pages/Notifications.css`
- `supabase-notifications.sql`

## Files updated
- `src/App.tsx` adds `/account/notifications` and a View all notifications link in the bell dropdown.
- `src/App.css` styles the dropdown shortcut.

## Supabase setup
1. Open the Supabase project connected to this website.
2. If you have not already created `public.return_requests`, first run the return-request SQL from the returns feature.
3. Open SQL Editor and run `supabase-notifications.sql`.
4. Confirm the `notifications` table exists and enable Realtime for it if the script could not add it to `supabase_realtime`.

The SQL creates notifications when an order status or payment status changes, and when an existing return request status changes. Customer RLS allows each signed-in user to read and mark only their own notifications. Inserts are restricted to trusted database triggers/server-side operations.

## Run locally
```powershell
npm install
npm run build
npm run dev
```

Open `/account/notifications` after signing in. The bell dropdown has a shortcut to this page. Live updates are delivered through Supabase Realtime when the table is in the `supabase_realtime` publication.

## Important
- This feature assumes the existing `orders` table has `id`, `user_id`, `order_code`, `status`, and `payment_status` columns.
- The return notification trigger assumes `return_requests` has `id`, `order_id`, `user_id`, and `status` columns, and that `orders.id` joins to `return_requests.order_id`.
- The feature has been TypeScript-checked. A production Vite build could not be run in this Linux packaging environment because the uploaded `node_modules` lacks the platform-specific optional Rolldown binding. Run the build on your Windows machine after extracting the package.
