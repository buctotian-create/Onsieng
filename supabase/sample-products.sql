-- Optional sample inventory. Review the products, prices, stock, images and locations before use.
-- Conflicting IDs or product codes are left untouched.
insert into public.products (id,code,name,category,price,stock,image,description,location) values
('p7','ONS-007','Mira Dining Chair','Furniture',2890,18,'https://images.unsplash.com/photo-1598300056393-4aac492f4344?auto=format&fit=crop&w=600&q=80','A comfortable seat for everyday gatherings.','A-11'),
('p8','ONS-008','Elio Wall Mirror','Home decor',2450,16,'https://images.unsplash.com/photo-1618220179428-22790b461013?auto=format&fit=crop&w=600&q=80','Bring a little more light into your space.','C-11'),
('p9','ONS-009','Sora Pendant Light','Lighting',3690,11,'https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?auto=format&fit=crop&w=600&q=80','Soft light with a sculptural touch.','B-06'),
('p10','ONS-010','Sunday Cushion','Soft furnishings',690,35,'https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?auto=format&fit=crop&w=600&q=80','An easy layer of everyday comfort.','D-01'),
('p11','ONS-011','Terra Plant Pot','Home decor',780,28,'https://images.unsplash.com/photo-1485955900006-10f4d324d411?auto=format&fit=crop&w=600&q=80','A natural home for your favorite greens.','C-13'),
('p12','ONS-012','Eden Accent Stool','Furniture',1290,20,'https://images.unsplash.com/photo-1503602642458-232111445657?auto=format&fit=crop&w=600&q=80','A versatile extra seat for any room.','D-04')
on conflict do nothing;
