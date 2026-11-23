-- Run in a disposable database after the base schema and public catalog migration.
grant usage on schema public to anon;
grant select on public.products, public.orders, public.profiles, public.deliveries to anon;
set role anon;
do $$ begin
 if (select count(*) from public.store_products()) <> 6 then raise exception 'Public catalog unavailable'; end if;
 if (select count(*) from public.products) <> 0 then raise exception 'Anonymous user can access full product records'; end if;
 if (select count(*) from public.orders) <> 0 or (select count(*) from public.profiles) <> 0 or (select count(*) from public.deliveries) <> 0 then raise exception 'Anonymous user can access private records'; end if;
 if has_function_privilege('anon','public.place_order(text,text,text,text,jsonb)','execute') then raise exception 'Anonymous user can place an order'; end if;
 if exists(select 1 from information_schema.parameters where specific_schema='public' and specific_name like 'store_products_%' and parameter_name='location') then raise exception 'Warehouse location exposed'; end if;
end $$;
reset role;
