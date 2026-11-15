-- Run once after schema.sql, including on projects already using the original schema.
begin;
alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('customer','staff','admin','driver'));
alter table public.orders add column if not exists phone text not null default '';

create table public.deliveries (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id),
  assigned_driver uuid not null references public.profiles(id),
  driver_name text not null,
  status text not null default 'Assigned' check (status in ('Assigned','Accepted','Picked up','In transit','Arrived','Waiting for instructions','Delivered')),
  recipient_name text not null default '',
  history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.deliveries enable row level security;

-- These predicates expose only whether the caller owns the order or is its assigned driver.
create function public.owns_delivery_order(p_order_id uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.orders where id=p_order_id and user_id=auth.uid())
$$;
create function public.is_assigned_delivery_driver(p_order_id uuid) returns boolean language sql stable security definer set search_path = public as $$
  select public.current_role()='driver' and exists(select 1 from public.deliveries where order_id=p_order_id and assigned_driver=auth.uid())
$$;
revoke all on function public.owns_delivery_order(uuid) from public;
revoke all on function public.is_assigned_delivery_driver(uuid) from public;
grant execute on function public.owns_delivery_order(uuid), public.is_assigned_delivery_driver(uuid) to authenticated;
create policy "deliveries visible to customer, driver and admin" on public.deliveries for select to authenticated using (
  public.current_role()='admin' or public.owns_delivery_order(order_id) or (public.current_role()='driver' and assigned_driver=auth.uid())
);
create policy "assigned drivers can read delivery orders" on public.orders for select to authenticated using (public.is_assigned_delivery_driver(id));

-- Keep the original place_order signature available for existing clients.
create function public.place_order_with_phone(p_customer text,p_email text,p_address text,p_payment text,p_items jsonb,p_phone text default '')
returns public.orders language plpgsql security definer set search_path = public as $$
declare placed public.orders;
begin
  if length(coalesce(p_phone,''))>40 then raise exception 'Phone number is too long'; end if;
  placed:=public.place_order(p_customer,p_email,p_address,p_payment,p_items);
  update public.orders set phone=trim(coalesce(p_phone,'')) where id=placed.id returning * into placed;
  return placed;
end $$;
revoke all on function public.place_order_with_phone(text,text,text,text,jsonb,text) from public;
grant execute on function public.place_order_with_phone(text,text,text,text,jsonb,text) to authenticated;

create or replace function public.set_user_role(p_user_id uuid, p_role text) returns void language plpgsql security definer set search_path = public as $$
begin
  if public.current_role() <> 'admin' or public.current_role() is null then raise exception 'Admin access required'; end if;
  if p_user_id = auth.uid() then raise exception 'You cannot change your own role'; end if;
  if p_role not in ('customer','staff','admin','driver') then raise exception 'Invalid role'; end if;
  update public.profiles set role = p_role where id = p_user_id;
  if not found then raise exception 'Account not found'; end if;
end $$;

-- Assign only a driver account. Once accepted, a delivery cannot be reassigned here.
create function public.assign_delivery(p_order_id uuid,p_driver_id uuid) returns public.deliveries language plpgsql security definer set search_path = public as $$
declare d public.deliveries; driver_label text; stamp timestamptz:=now();
begin
  if public.current_role() is distinct from 'admin' then raise exception 'Admin access required'; end if;
  perform 1 from public.orders where id=p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  select display_name into driver_label from public.profiles where id=p_driver_id and role='driver';
  if driver_label is null then raise exception 'Select a driver account'; end if;
  select * into d from public.deliveries where order_id=p_order_id for update;
  if found then
    if d.status <> 'Assigned' then raise exception 'Accepted deliveries cannot be reassigned'; end if;
    update public.deliveries set assigned_driver=p_driver_id,driver_name=driver_label,updated_at=stamp,
      history=history || jsonb_build_array(jsonb_build_object('status','Assigned','at',stamp)) where id=d.id returning * into d;
  else
    insert into public.deliveries(order_id,assigned_driver,driver_name,history) values(p_order_id,p_driver_id,driver_label,jsonb_build_array(jsonb_build_object('status','Assigned','at',stamp))) returning * into d;
  end if;
  return d;
end $$;
revoke all on function public.assign_delivery(uuid,uuid) from public;
grant execute on function public.assign_delivery(uuid,uuid) to authenticated;

-- Drivers progress only their own delivery through the flowchart. No direct writes are granted by RLS.
create function public.advance_delivery(p_delivery_id uuid,p_status text,p_recipient text default '') returns public.deliveries language plpgsql security definer set search_path = public as $$
declare d public.deliveries; order_status text; stamp timestamptz:=now();
begin
  if public.current_role() is distinct from 'driver' then raise exception 'Driver access required'; end if;
  select * into d from public.deliveries where id=p_delivery_id and assigned_driver=auth.uid() for update;
  if not found then raise exception 'Delivery not found'; end if;
  if not ((d.status='Assigned' and p_status='Accepted') or
          (d.status='Accepted' and p_status='Picked up') or
          (d.status='Picked up' and p_status='In transit') or
          (d.status='In transit' and p_status='Arrived') or
          (d.status='Arrived' and p_status in ('Delivered','Waiting for instructions')) or
          (d.status='Waiting for instructions' and p_status='Arrived')) then
    raise exception 'Invalid delivery step';
  end if;
  if p_status='Picked up' then
    select status into order_status from public.orders where id=d.order_id;
    if order_status not in ('Packed','Ready for dispatch') then raise exception 'The order must be packed before pickup'; end if;
  end if;
  if p_status='Delivered' and nullif(trim(coalesce(p_recipient,'')),'') is null then raise exception 'Recipient name is required'; end if;
  if length(coalesce(p_recipient,''))>120 then raise exception 'Recipient name is too long'; end if;
  update public.deliveries set status=p_status,recipient_name=case when p_status='Delivered' then trim(p_recipient) else recipient_name end,
    updated_at=stamp,history=history || jsonb_build_array(jsonb_build_object('status',p_status,'at',stamp)) where id=d.id returning * into d;
  if p_status='Waiting for instructions' then
    insert into public.notifications(order_id,staff_id,message) values(d.order_id,auth.uid(),'Customer unavailable. Driver is waiting for instructions.');
  elsif p_status='Delivered' then
    update public.orders set status='Completed' where id=d.order_id;
    insert into public.notifications(order_id,staff_id,message) values(d.order_id,auth.uid(),'Delivery confirmed by driver.');
  end if;
  return d;
end $$;
revoke all on function public.advance_delivery(uuid,text,text) from public;
grant execute on function public.advance_delivery(uuid,text,text) to authenticated;
commit;
