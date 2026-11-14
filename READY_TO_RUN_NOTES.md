# 999+ KART - integration notes

## Included in this update
- Connected the existing AdminReturns page to `/admin/returns`.
- Reused the shared AdminLayout so the Returns page displays the same admin sidebar and header.
- The AdminLayout sidebar already contains the Returns link.
- Fixed four TypeScript unused-symbol errors found during project validation.

## Setup
1. Install Node.js 22 LTS or a compatible current Node.js release.
2. Copy `.env.example` to `.env`.
3. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` to your own Supabase project values.
4. Run `npm install`.
5. Run `npm run build`.
6. Run `npm run dev` to start the local development server.

## Important backend requirements
This is a React + Vite + Supabase application. A successful TypeScript check does not prove the Supabase backend is configured. Before real customer orders can work, confirm that your Supabase project contains the tables, columns, relationships, enum values, Storage buckets, RLS policies, and Edge Functions used by the application.

The Admin Returns screen reads `return_requests` and joins `orders` and `order_items`. It updates `return_requests.status` and `updated_at`. The admin user must have `app_metadata.role = "admin"`, and the corresponding SELECT/UPDATE RLS policies must permit that user.

Never expose a Supabase service-role key in a Vite `.env` file or browser code. Only use the publishable/anon key in `VITE_` variables. Keep service-role credentials in server-side secrets only.

## Validation status
- TypeScript project check: passed in the preparation environment.
- Full Vite production build: could not be completed in the preparation environment because the uploaded `node_modules` lacked the platform-specific Rolldown native binding. Reinstall dependencies with `npm install` on your machine, then run `npm run build`.
- Live Supabase operations, authentication, payments, order placement, email delivery, and deployment were not tested from this package.

This package is an updated project source, not a claim that a live store has been deployed or that external services have been configured.
