-- 999+ KART Growth Features
-- Run once in Supabase SQL Editor after taking a database backup.
-- Existing categories, products, orders and user records are not deleted or rewritten.
create extension if not exists pgcrypto;
create table if not exists public.wishlists (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, product_id uuid not null references public.products(id) on delete cascade, created_at timestamptz not null default now(), unique(user_id, product_id));
create table if not exists public.coupons (id uuid primary key default gen_random_uuid(), code text not null unique, title text not null, description text, discount_type text not null check (discount_type in ('percentage','fixed')), discount_value numeric(12,2) not null check (discount_value > 0), minimum_order_value numeric(12,2) not null default 0 check (minimum_order_value >= 0), maximum_discount numeric(12,2) check (maximum_discount is null or maximum_discount >= 0), usage_limit integer check (usage_limit is null or usage_limit > 0), per_user_limit integer not null default 1 check (per_user_limit > 0), starts_at timestamptz not null default now(), expires_at timestamptz, is_active boolean not null default true, created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(), check (expires_at is null or expires_at > starts_at));
create table if not exists public.coupon_redemptions (id uuid primary key default gen_random_uuid(), coupon_id uuid not null references public.coupons(id) on delete restrict, user_id uuid not null references auth.users(id) on delete cascade, order_id uuid references public.orders(id) on delete set null, discount_amount numeric(12,2) not null check (discount_amount >= 0), redeemed_at timestamptz not null default now(), unique(coupon_id, order_id));
create table if not exists public.loyalty_transactions (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, points integer not null check (points <> 0), reason text not null, order_id uuid references public.orders(id) on delete set null, created_at timestamptz not null default now());
create unique index if not exists loyalty_order_earn_once on public.loyalty_transactions(user_id, order_id, reason) where order_id is not null and reason = 'delivered_order';
create table if not exists public.customer_referrals (id uuid primary key default gen_random_uuid(), referrer_id uuid not null references auth.users(id) on delete cascade, referred_user_id uuid references auth.users(id) on delete set null, referral_code text not null unique, status text not null default 'pending' check (status in ('pending','qualified','rewarded','cancelled')), reward_points integer not null default 100 check (reward_points >= 0), qualified_order_id uuid references public.orders(id) on delete set null, created_at timestamptz not null default now(), qualified_at timestamptz, unique(referred_user_id));
create table if not exists public.abandoned_carts (id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete cascade, email text, cart_snapshot jsonb not null default '[]'::jsonb, subtotal numeric(12,2) not null default 0, status text not null default 'open' check (status in ('open','recovered','expired')), last_activity_at timestamptz not null default now(), reminder_sent_at timestamptz, recovered_order_id uuid references public.orders(id) on delete set null, created_at timestamptz not null default now());
create index if not exists wishlists_user_idx on public.wishlists(user_id);
create index if not exists coupon_redemptions_user_idx on public.coupon_redemptions(user_id,coupon_id);
create index if not exists loyalty_transactions_user_idx on public.loyalty_transactions(user_id,created_at desc);
create index if not exists abandoned_carts_open_idx on public.abandoned_carts(status,last_activity_at);
alter table public.wishlists enable row level security;
alter table public.coupons enable row level security;
alter table public.coupon_redemptions enable row level security;
alter table public.loyalty_transactions enable row level security;
alter table public.customer_referrals enable row level security;
alter table public.abandoned_carts enable row level security;
drop policy if exists "Users manage own wishlist" on public.wishlists;
create policy "Users manage own wishlist" on public.wishlists for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
drop policy if exists "Customers read active coupons" on public.coupons;
create policy "Customers read active coupons" on public.coupons for select to authenticated using(is_active and starts_at<=now() and (expires_at is null or expires_at>now()));
drop policy if exists "Admins manage coupons" on public.coupons;
create policy "Admins manage coupons" on public.coupons for all to authenticated using((auth.jwt()->'app_metadata'->>'role')='admin') with check((auth.jwt()->'app_metadata'->>'role')='admin');
drop policy if exists "Users read own coupon redemptions" on public.coupon_redemptions;
create policy "Users read own coupon redemptions" on public.coupon_redemptions for select to authenticated using(user_id=auth.uid());
drop policy if exists "Users read own loyalty" on public.loyalty_transactions;
create policy "Users read own loyalty" on public.loyalty_transactions for select to authenticated using(user_id=auth.uid());
drop policy if exists "Users read own referrals" on public.customer_referrals;
create policy "Users read own referrals" on public.customer_referrals for select to authenticated using(referrer_id=auth.uid() or referred_user_id=auth.uid());
drop policy if exists "Users read own abandoned carts" on public.abandoned_carts;
create policy "Users read own abandoned carts" on public.abandoned_carts for select to authenticated using(user_id=auth.uid());
drop policy if exists "Admins read abandoned carts" on public.abandoned_carts;
create policy "Admins read abandoned carts" on public.abandoned_carts for select to authenticated using((auth.jwt()->'app_metadata'->>'role')='admin');
create or replace function public.validate_coupon(p_code text,p_subtotal numeric) returns jsonb language plpgsql security definer set search_path=public,auth as $$
declare c public.coupons%rowtype; v_user uuid:=auth.uid(); v_used integer; v_total integer; v_discount numeric;
begin
 if v_user is null then return jsonb_build_object('valid',false,'message','Sign in to use coupons.'); end if;
 if p_subtotal is null or p_subtotal<0 then return jsonb_build_object('valid',false,'message','Invalid cart total.'); end if;
 select * into c from public.coupons where upper(code)=upper(trim(p_code)) and is_active and starts_at<=now() and (expires_at is null or expires_at>now()) limit 1;
 if not found then return jsonb_build_object('valid',false,'message','Coupon is invalid or expired.'); end if;
 if p_subtotal<c.minimum_order_value then return jsonb_build_object('valid',false,'message','Minimum order value not reached.','minimum_order_value',c.minimum_order_value); end if;
 select count(*) into v_used from public.coupon_redemptions where coupon_id=c.id and user_id=v_user;
 select count(*) into v_total from public.coupon_redemptions where coupon_id=c.id;
 if v_used>=c.per_user_limit then return jsonb_build_object('valid',false,'message','You have reached this coupon usage limit.'); end if;
 if c.usage_limit is not null and v_total>=c.usage_limit then return jsonb_build_object('valid',false,'message','Coupon usage limit reached.'); end if;
 v_discount:=case when c.discount_type='percentage' then p_subtotal*c.discount_value/100 else c.discount_value end;
 if c.maximum_discount is not null then v_discount:=least(v_discount,c.maximum_discount); end if;
 v_discount:=least(v_discount,p_subtotal);
 return jsonb_build_object('valid',true,'coupon_id',c.id,'code',c.code,'discount_amount',round(v_discount,2));
end; $$;
revoke all on function public.validate_coupon(text,numeric) from public;
grant execute on function public.validate_coupon(text,numeric) to authenticated;
create or replace function public.award_loyalty_points_on_delivery() returns trigger language plpgsql security definer set search_path=public as $$
declare v_points integer;
begin
 if new.status::text='delivered' and old.status::text is distinct from new.status::text and new.user_id is not null then
  v_points:=greatest(1,floor(coalesce(new.subtotal,0)/100)::integer);
  insert into public.loyalty_transactions(user_id,points,reason,order_id) values(new.user_id,v_points,'delivered_order',new.id) on conflict do nothing;
 end if; return new;
end; $$;
drop trigger if exists trg_award_loyalty_points on public.orders;
create trigger trg_award_loyalty_points after update of status on public.orders for each row execute function public.award_loyalty_points_on_delivery();
create or replace function public.get_admin_store_kpis() returns jsonb
language plpgsql security definer set search_path=public,auth as $$
begin
  if coalesce(auth.jwt()->'app_metadata'->>'role','') <> 'admin' then
    raise exception 'Administrator access required';
  end if;
  return jsonb_build_object(
    'total_orders',(select count(*) from public.orders),
    'delivered_orders',(select count(*) from public.orders where status::text='delivered'),
    'active_orders',(select count(*) from public.orders where status::text not in ('delivered','cancelled','returned')),
    'gross_order_value',(select coalesce(sum(grand_total),0) from public.orders),
    'active_products',(select count(*) from public.products where is_active),
    'low_stock_products',(select count(*) from public.products where is_active and track_inventory and stock_quantity<=5),
    'registered_accounts',(select count(*) from auth.users)
  );
end; $$;
revoke all on function public.get_admin_store_kpis() from public;
grant execute on function public.get_admin_store_kpis() to authenticated;

drop policy if exists "Admins manage loyalty ledger" on public.loyalty_transactions;
create policy "Admins manage loyalty ledger" on public.loyalty_transactions for all to authenticated using((auth.jwt()->'app_metadata'->>'role')='admin') with check((auth.jwt()->'app_metadata'->>'role')='admin');
drop policy if exists "Admins manage referrals" on public.customer_referrals;
create policy "Admins manage referrals" on public.customer_referrals for all to authenticated using((auth.jwt()->'app_metadata'->>'role')='admin') with check((auth.jwt()->'app_metadata'->>'role')='admin');
