-- Safe to run on new or existing Onsieng projects after schema.sql.
-- Retains the public API, pricing and locking behavior. Rejects SQL NULL carts.
begin;
create or replace function public.place_order(p_customer text, p_email text, p_address text, p_payment text, p_items jsonb)
returns public.orders language plpgsql security definer set search_path = public as $$
declare item jsonb; product public.products; result public.orders; snapshots jsonb := '[]'::jsonb; amount numeric := 0; qty integer;
begin
  if auth.uid() is null then raise exception 'Please sign in to place an order'; end if;
  if nullif(trim(p_customer),'') is null or nullif(trim(p_email),'') is null or nullif(trim(p_address),'') is null then raise exception 'Delivery details are required'; end if;
  if p_payment not in ('Cash on delivery','Bank transfer') then raise exception 'Invalid payment method'; end if;
  if p_items is null or jsonb_typeof(p_items) is distinct from 'array' then raise exception 'Your cart must be a nonempty array'; end if;
  if jsonb_array_length(p_items) = 0 then raise exception 'Your cart is empty'; end if;
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
commit;
