# Growth features bundle notes

Base project: `999-KART-with-Notifications.zip`, supplied in this conversation.

Added:
- `src/features/growth/GrowthHub.tsx` and `.css`
- `src/features/admin/pages/AdminGrowthAnalytics.tsx` and `.css`
- `supabase/migrations/202611140001_growth_features.sql`
- `supabase/seed-growth-example.sql` (optional coupon)
- `INSTALL-GROWTH-FEATURES.md`

Updated:
- `src/App.tsx`: customer Growth Hub route and profile menu link; protected admin analytics route.
- `src/features/admin/components/AdminLayout.tsx`: Analytics sidebar link.

No existing category, product, order, customer or administrator rows are altered by the migration.
