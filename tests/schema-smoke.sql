-- Run after schema-setup.sql and supabase/schema.sql against a disposable database.
grant usage on schema public to authenticated;
grant select,insert,update,delete on all tables in schema public to authenticated;
insert into auth.users values ('00000000-0000-0000-0000-000000000001','{"display_name":"Customer"}'),('00000000-0000-0000-0000-000000000002','{"display_name":"Admin"}'),('00000000-0000-0000-0000-000000000003','{"display_name":"Staff"}');
update public.profiles set role='admin' where id='00000000-0000-0000-0000-000000000002';
update public.profiles set role='staff' where id='00000000-0000-0000-0000-000000000003';
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
select (public.place_order('Customer','c@example.com','123 Test St','Cash on delivery','[{"id":"p1","quantity":2}]')).id;
do $$ begin
 if (select stock from public.products where id='p1') <> 22 then raise exception 'Stock was not reduced'; end if;
 if (select total from public.orders limit 1) <> 9700 then raise exception 'Order total incorrect'; end if;
 begin perform public.place_order('Customer','c@example.com','123 Test St','Cash on delivery','[{"id":"p1","quantity":999}]'); raise exception 'Oversell was accepted'; exception when raise_exception then if sqlerrm = 'Oversell was accepted' then raise; end if; end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
update public.orders set assigned_to='00000000-0000-0000-0000-000000000003';
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',false);
update public.orders set status='Processing';
insert into public.notifications(order_id,staff_id,message) select id,'00000000-0000-0000-0000-000000000003','Stock unavailable' from public.orders;
do $$ begin
 begin update public.products set price=1 where id='p1'; raise exception 'Staff changed price'; exception when raise_exception then if sqlerrm='Staff changed price' then raise; end if; end;
 begin update public.orders set payment_verified=true; raise exception 'Staff verified payment'; exception when raise_exception then if sqlerrm='Staff verified payment' then raise; end if; end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
do $$ begin if (select count(*) from public.notifications) <> 1 then raise exception 'Admin cannot see alert'; end if; end $$;
select public.set_user_role('00000000-0000-0000-0000-000000000001','staff');
