-- Run on a disposable database after the base schema and bugfix migration.
grant usage on schema public to authenticated;
grant select,insert,update,delete on all tables in schema public to authenticated;
insert into auth.users values ('00000000-0000-0000-0000-000000000021','{"display_name":"Checkout regression"}');
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000021',false);
do $$
declare invalid_cart jsonb; rejected boolean;
begin
 foreach invalid_cart in array array[null::jsonb,'null'::jsonb,'{}'::jsonb,'[]'::jsonb,'[{"id":"p1","quantity":0}]'::jsonb,'[{"id":"p1","quantity":1},{"id":"p1","quantity":1}]'::jsonb] loop
  rejected:=false;
  begin
   perform public.place_order('Customer','c@example.test','123 Test Road','Cash on delivery',invalid_cart);
  exception when others then rejected:=true;
  end;
  if not rejected then raise exception 'Invalid cart was accepted: %', invalid_cart;end if;
 end loop;
 if exists(select 1 from public.orders) then raise exception 'Invalid cart created an order';end if;
 if (select stock from public.products where id='p1')<>24 then raise exception 'Rejected checkout changed stock';end if;
 perform public.place_order('Customer','c@example.test','123 Test Road','Cash on delivery','[{"id":"p1","quantity":1}]');
 if (select total from public.orders limit 1)<>4850 then raise exception 'Valid checkout failed';end if;
end $$;
