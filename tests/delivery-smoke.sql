-- Run after schema-setup.sql, schema.sql and delivery-migration.sql on a disposable database.
grant usage on schema public to authenticated;
grant select,insert,update,delete on all tables in schema public to authenticated;
insert into auth.users values
('00000000-0000-0000-0000-000000000011','{"display_name":"Customer"}'),
('00000000-0000-0000-0000-000000000012','{"display_name":"Admin"}'),
('00000000-0000-0000-0000-000000000013','{"display_name":"Driver One"}'),
('00000000-0000-0000-0000-000000000014','{"display_name":"Driver Two"}'),
('00000000-0000-0000-0000-000000000015','{"display_name":"Other Customer"}'),
('00000000-0000-0000-0000-000000000016','{"display_name":"Staff"}');
update public.profiles set role='admin' where id='00000000-0000-0000-0000-000000000012';
update public.profiles set role='driver' where id in ('00000000-0000-0000-0000-000000000013','00000000-0000-0000-0000-000000000014');
update public.profiles set role='staff' where id='00000000-0000-0000-0000-000000000016';
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000011',false);
select (public.place_order_with_phone('Customer','customer@example.test','123 Test Road','Cash on delivery','[{"id":"p1","quantity":2}]','+63 900 000 0000')).id;
do $$begin
 if (select phone from public.orders limit 1) <> '+63 900 000 0000' then raise exception 'Phone was not stored'; end if;
 if (select stock from public.products where id='p1')<>22 then raise exception 'Stock was not reserved'; end if;
end$$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000012',false);
select public.assign_delivery((select id from public.orders limit 1),'00000000-0000-0000-0000-000000000013');
select set_config('test.delivery_id',(select id::text from public.deliveries limit 1),false);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000014',false);
do $$begin
 if (select count(*) from public.orders)<>0 or (select count(*) from public.deliveries)<>0 then raise exception 'Unassigned driver can view private data'; end if;
 begin perform public.assign_delivery(gen_random_uuid(),'00000000-0000-0000-0000-000000000014'); raise exception 'Driver assigned delivery'; exception when raise_exception then if sqlerrm='Driver assigned delivery' then raise;end if;end;
 begin perform public.advance_delivery(current_setting('test.delivery_id')::uuid,'Accepted');raise exception 'Other driver changed delivery';exception when raise_exception then if sqlerrm='Other driver changed delivery' then raise;end if;end;
end$$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000015',false);
do $$begin if (select count(*) from public.deliveries)<>0 then raise exception 'Other customer can view delivery'; end if;end$$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000013',false);
select public.advance_delivery((select id from public.deliveries limit 1),'Accepted');
do $$declare changed integer; begin
 begin perform public.advance_delivery((select id from public.deliveries limit 1),'Picked up');raise exception 'Unpacked pickup accepted';exception when raise_exception then if sqlerrm='Unpacked pickup accepted' then raise;end if;end;
 update public.orders set payment_verified=true; get diagnostics changed = row_count;
 if changed<>0 then raise exception 'Driver changed payment';end if;
end$$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000012',false);
update public.orders set status='Packed';
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000013',false);
select public.advance_delivery((select id from public.deliveries limit 1),'Picked up');
select public.advance_delivery((select id from public.deliveries limit 1),'In transit');
select public.advance_delivery((select id from public.deliveries limit 1),'Arrived');
select public.advance_delivery((select id from public.deliveries limit 1),'Waiting for instructions');
select public.advance_delivery((select id from public.deliveries limit 1),'Arrived');
do $$begin
 begin perform public.advance_delivery((select id from public.deliveries limit 1),'Delivered');raise exception 'Missing recipient accepted';exception when raise_exception then if sqlerrm='Missing recipient accepted' then raise;end if;end;
end$$;
select public.advance_delivery((select id from public.deliveries limit 1),'Delivered','Customer');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000011',false);
do $$begin
 if (select status from public.deliveries limit 1)<>'Delivered' or (select recipient_name from public.deliveries limit 1)<>'Customer' then raise exception 'Delivery confirmation unavailable'; end if;
 if (select status from public.orders limit 1)<>'Completed' then raise exception 'Order was not completed'; end if;
end$$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000012',false);
do $$begin if (select count(*) from public.notifications)<>2 then raise exception 'Admin alerts missing'; end if;end$$;
