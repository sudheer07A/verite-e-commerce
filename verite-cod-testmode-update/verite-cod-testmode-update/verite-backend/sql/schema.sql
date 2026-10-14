create extension if not exists pgcrypto;

create table if not exists public.verite_orders (
  id uuid primary key default gen_random_uuid(),
  order_code text not null unique,
  customer jsonb not null,
  items jsonb not null,
  subtotal_minor integer not null check (subtotal_minor >= 0),
  shipping_minor integer not null check (shipping_minor >= 0),
  total_minor integer not null check (total_minor >= 0),
  currency text not null default 'INR',
  payment_method text not null default 'RAZORPAY' check (payment_method in ('RAZORPAY','COD')),
  payment_status text not null default 'PENDING' check (payment_status in ('PENDING','PAID','FAILED','REFUNDED')),
  order_status text not null default 'Awaiting Payment' check (order_status in ('Awaiting Payment','Processing','Confirmed','Packed','Shipped','Out for Delivery','Delivered','Cancelled')),
  razorpay_order_id text unique,
  razorpay_payment_id text,
  shipment jsonb not null default '{"carrier":"","trackingNumber":"","estimatedDelivery":"","trackingUrl":""}'::jsonb,
  status_history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists verite_orders_created_at_idx on public.verite_orders (created_at desc);
create index if not exists verite_orders_customer_email_idx on public.verite_orders ((lower(customer->>'email')));

-- The Express server uses the Supabase secret key and performs authorization itself.
-- Do not expose this table through the browser's Supabase client. RLS is enabled as defense in depth.
alter table public.verite_orders enable row level security;
revoke all on public.verite_orders from anon, authenticated;

-- Safe migration for projects where the table was created before COD support.
alter table public.verite_orders add column if not exists payment_method text not null default 'RAZORPAY';
alter table public.verite_orders drop constraint if exists verite_orders_payment_method_check;
alter table public.verite_orders add constraint verite_orders_payment_method_check check (payment_method in ('RAZORPAY','COD'));
