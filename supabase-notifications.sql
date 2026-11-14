-- 999+ KART customer notifications
-- Run this script in Supabase SQL Editor.
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  message text not null,
  type text not null default 'general'
    check (type in ('order','payment','shipping','return','support','account','general')),
  link text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);
create index if not exists notifications_user_unread_idx
  on public.notifications (user_id, is_read)
  where is_read = false;

alter table public.notifications enable row level security;

drop policy if exists "Users can read their own notifications" on public.notifications;
create policy "Users can read their own notifications"
on public.notifications for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can update their own notifications" on public.notifications;
create policy "Users can update their own notifications"
on public.notifications for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Inserts are performed by trusted database triggers or server-side admin code.
drop policy if exists "Users cannot insert notifications directly" on public.notifications;
create policy "Users cannot insert notifications directly"
on public.notifications for insert to authenticated
with check (false);

create or replace function public.notify_customer_order_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text;
  v_message text;
  v_type text := 'order';
begin
  if new.user_id is null then return new; end if;

  if new.status is distinct from old.status then
    case new.status::text
      when 'confirmed' then
        v_title := 'Order confirmed';
        v_message := 'Your order ' || coalesce(new.order_code, new.id::text) || ' has been confirmed.';
      when 'shipped' then
        v_title := 'Your order has shipped';
        v_message := 'Your order ' || coalesce(new.order_code, new.id::text) || ' is on its way.';
        v_type := 'shipping';
      when 'out_for_delivery' then
        v_title := 'Out for delivery';
        v_message := 'Your order ' || coalesce(new.order_code, new.id::text) || ' is out for delivery.';
        v_type := 'shipping';
      when 'delivered' then
        v_title := 'Order delivered';
        v_message := 'Your order ' || coalesce(new.order_code, new.id::text) || ' has been delivered.';
      when 'cancelled' then
        v_title := 'Order cancelled';
        v_message := 'Your order ' || coalesce(new.order_code, new.id::text) || ' has been cancelled.';
      else
        v_title := 'Order status updated';
        v_message := 'The status of order ' || coalesce(new.order_code, new.id::text) || ' is now ' || replace(new.status::text, '_', ' ') || '.';
    end case;

    insert into public.notifications(user_id, title, message, type, link)
    values (new.user_id, v_title, v_message, v_type, '/account/orders/' || new.id::text);
  end if;

  if new.payment_status is distinct from old.payment_status then
    insert into public.notifications(user_id, title, message, type, link)
    values (
      new.user_id,
      'Payment status updated',
      'Payment for order ' || coalesce(new.order_code, new.id::text) || ' is now ' || replace(new.payment_status::text, '_', ' ') || '.',
      'payment',
      '/account/orders/' || new.id::text
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_customer_order_change on public.orders;
create trigger trg_notify_customer_order_change
after update of status, payment_status on public.orders
for each row execute function public.notify_customer_order_change();

create or replace function public.notify_customer_return_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_order_code text;
  v_title text;
  v_message text;
begin
  if new.status is not distinct from old.status then return new; end if;

  select rr.order_id, o.order_code
    into v_order_id, v_order_code
  from public.return_requests rr
  left join public.orders o on o.id = rr.order_id
  where rr.id = new.id;

  case new.status::text
    when 'approved' then
      v_title := 'Return request approved';
      v_message := 'Your return request for order ' || coalesce(v_order_code, v_order_id::text, '') || ' was approved. Return in Progress.';
    when 'rejected' then
      v_title := 'Return request update';
      v_message := 'Your return request for order ' || coalesce(v_order_code, v_order_id::text, '') || ' was not approved.';
    when 'completed' then
      v_title := 'Return completed';
      v_message := 'Your return for order ' || coalesce(v_order_code, v_order_id::text, '') || ' has been completed.';
    else
      v_title := 'Return request updated';
      v_message := 'Your return request status is now ' || replace(new.status::text, '_', ' ') || '.';
  end case;

  insert into public.notifications(user_id, title, message, type, link)
  values (new.user_id, v_title, v_message, 'return', '/account/returns-orders');
  return new;
end;
$$;

drop trigger if exists trg_notify_customer_return_change on public.return_requests;
create trigger trg_notify_customer_return_change
after update of status on public.return_requests
for each row execute function public.notify_customer_return_change();

-- Enable Realtime for the notification inbox if it is not already enabled.
do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception
  when duplicate_object then null;
  when undefined_object then null;
end;
$$;
