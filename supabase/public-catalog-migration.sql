-- Public storefront: expose catalog fields only; orders and warehouse locations remain private.
create or replace function public.store_products()
returns table (id text, code text, name text, category text, price numeric, stock integer, image text, description text)
language sql stable security definer set search_path = public as $$
 select p.id, p.code, p.name, p.category, p.price, p.stock, p.image, p.description from public.products p order by p.name;
$$;
revoke all on function public.store_products() from public;
grant execute on function public.store_products() to anon, authenticated;
