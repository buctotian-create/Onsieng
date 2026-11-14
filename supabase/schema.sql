-- Run once in a new Supabase project's SQL editor.
create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Customer',
  role text not null default 'customer' check (role in ('customer','staff','admin'))
);
create table public.products (
  id text primary key default gen_random_uuid()::text,
  code text not null unique,
  name text not null,
  category text not null,
  price numeric(12,2) not null check (price >= 0),
  stock integer not null default 0 check (stock >= 0),
  image text not null default '',
  description text not null default '',
  location text not null default ''
);
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  customer text not null,
  email text not null,
  address text not null,
  items jsonb not null,
  total numeric(12,2) not null,
  status text not null default 'Pending' check (status in ('Pending','Processing','Packed','Ready for dispatch','Completed')),
  payment text not null check (payment in ('Cash on delivery','Bank transfer')),
  payment_verified boolean not null default false,
  assigned_to uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create function public.current_role() returns text language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;
create function public.create_profile() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name) values (new.id, coalesce(nullif(new.raw_user_meta_data->>'display_name',''), 'Customer'));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.create_profile();
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
create policy "profiles visible to owner and admin" on public.profiles for select to authenticated using (id = auth.uid() or public.current_role() = 'admin');
create policy "products visible to signed in users" on public.products for select to authenticated using (true);
create policy "admins insert products" on public.products for insert to authenticated with check (public.current_role() = 'admin');
create policy "admins and staff update products" on public.products for update to authenticated using (public.current_role() in ('admin','staff')) with check (public.current_role() in ('admin','staff'));
create policy "admins delete products" on public.products for delete to authenticated using (public.current_role() = 'admin');
create policy "orders visible to owner, assigned staff and admin" on public.orders for select to authenticated using (user_id = auth.uid() or (public.current_role() = 'staff' and assigned_to = auth.uid()) or public.current_role() = 'admin');
create policy "admins and assigned staff update orders" on public.orders for update to authenticated using (public.current_role() = 'admin' or (public.current_role() = 'staff' and assigned_to = auth.uid())) with check (public.current_role() = 'admin' or (public.current_role() = 'staff' and assigned_to = auth.uid()));
-- Staff may adjust stock and advance orders, but cannot alter product details or payment/customer data.
create function public.restrict_staff_changes() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.current_role() = 'staff' then
    if tg_table_name = 'products' and (to_jsonb(new) - 'stock') is distinct from (to_jsonb(old) - 'stock') then
      raise exception 'Staff can only update product stock';
    elsif tg_table_name = 'orders' and (to_jsonb(new) - 'status') is distinct from (to_jsonb(old) - 'status') then
      raise exception 'Staff can only update order status';
    end if;
  end if;
  return new;
end $$;
create trigger restrict_product_changes before update on public.products for each row execute function public.restrict_staff_changes();
create trigger restrict_order_changes before update on public.orders for each row execute function public.restrict_staff_changes();

-- Locks each product in a stable order, checks availability and calculates prices on the server.
create function public.place_order(p_customer text, p_email text, p_address text, p_payment text, p_items jsonb)
returns public.orders language plpgsql security definer set search_path = public as $$
declare item jsonb; product public.products; result public.orders; snapshots jsonb := '[]'::jsonb; amount numeric := 0; qty integer;
begin
  if auth.uid() is null then raise exception 'Please sign in to place an order'; end if;
  if nullif(trim(p_customer),'') is null or nullif(trim(p_email),'') is null or nullif(trim(p_address),'') is null then raise exception 'Delivery details are required'; end if;
  if p_payment not in ('Cash on delivery','Bank transfer') then raise exception 'Invalid payment method'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Your cart is empty'; end if;
  if (select count(*) <> count(distinct value->>'id') from jsonb_array_elements(p_items)) then raise exception 'Duplicate products in cart'; end if;
  for item in select value from jsonb_array_elements(p_items) order by value->>'id' loop
    qty := (item->>'quantity')::integer;
    if qty is null or qty < 1 then raise exception 'Invalid quantity'; end if;
    select * into product from public.products where id = item->>'id' for update;
    if not found or product.stock < qty then raise exception 'An item is unavailable or has insufficient stock'; end if;
    update public.products set stock = stock - qty where id = product.id;
    amount := amount + product.price * qty;
    snapshots := snapshots || jsonb_build_array(jsonb_build_object('id',product.id,'name',product.name,'price',product.price,'quantity',qty));
  end loop;
  insert into public.orders(user_id,customer,email,address,payment,items,total) values(auth.uid(),p_customer,p_email,p_address,p_payment,snapshots,amount) returning * into result;
  return result;
end $$;
revoke all on function public.place_order(text,text,text,text,jsonb) from public;
grant execute on function public.place_order(text,text,text,text,jsonb) to authenticated;

insert into public.products (id,code,name,category,price,stock,image,description,location) values
('p1','ONS-001','Luna Lounge Chair','Furniture',4850,24,'https://images.unsplash.com/photo-1503602642458-232111445657?auto=format&fit=crop&w=600&q=80','A little more comfort for your everyday.','A-01'),
('p2','ONS-002','Arlo Table Lamp','Lighting',1890,8,'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=600&q=80','A warm glow for your favorite corner.','B-04'),
('p3','ONS-003','Sol Ceramic Vase','Home decor',850,42,'https://images.unsplash.com/photo-1578500494198-246f612d3b3d?auto=format&fit=crop&w=600&q=80','A timeless accent, made to stand out.','C-02'),
('p4','ONS-004','Oak Side Table','Furniture',3290,15,'https://images.unsplash.com/photo-1499933374294-4584851497cc?auto=format&fit=crop&w=600&q=80','Thoughtfully made for the spaces you love.','A-05'),
('p5','ONS-005','Haven Wall Shelf','Home decor',2150,5,'https://images.unsplash.com/photo-1594620302200-9a762244a156?auto=format&fit=crop&w=600&q=80','A beautiful home for your favorite things.','C-08'),
('p6','ONS-006','Nora Two-Seater Sofa','Furniture',12900,12,'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=600&q=80','Settle in and make yourself at home.','A-09');

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id),
  staff_id uuid not null references public.profiles(id),
  message text not null,
  created_at timestamptz not null default now()
);
alter table public.notifications enable row level security;
create policy "admins read notifications" on public.notifications for select to authenticated using (public.current_role() = 'admin');
create policy "staff notify admin about assigned orders" on public.notifications for insert to authenticated with check (public.current_role() = 'staff' and staff_id = auth.uid() and exists (select 1 from public.orders where id = order_id and assigned_to = auth.uid()));
create function public.set_user_role(p_user_id uuid, p_role text) returns void language plpgsql security definer set search_path = public as $$
begin
  if public.current_role() <> 'admin' or public.current_role() is null then raise exception 'Admin access required'; end if;
  if p_user_id = auth.uid() then raise exception 'You cannot change your own role'; end if;
  if p_role not in ('customer','staff','admin') then raise exception 'Invalid role'; end if;
  update public.profiles set role = p_role where id = p_user_id;
  if not found then raise exception 'Account not found'; end if;
end $$;
revoke all on function public.set_user_role(uuid,text) from public;
grant execute on function public.set_user_role(uuid,text) to authenticated;
