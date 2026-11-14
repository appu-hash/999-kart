-- OPTIONAL: add one sample coupon after the growth migration has been applied.
-- Change the code, dates and limits before using it in a live store.
insert into public.coupons
  (code,title,description,discount_type,discount_value,minimum_order_value,maximum_discount,per_user_limit,is_active)
values
  ('WELCOME10','Welcome offer','10% off an eligible order','percentage',10,499,150,1,true)
on conflict (code) do nothing;
