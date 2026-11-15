export const images = {
 chair: 'https://images.unsplash.com/photo-1503602642458-232111445657?auto=format&fit=crop&w=600&q=80',
 lamp: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=600&q=80',
 vase: 'https://images.unsplash.com/photo-1578500494198-246f612d3b3d?auto=format&fit=crop&w=600&q=80',
 table: 'https://images.unsplash.com/photo-1499933374294-4584851497cc?auto=format&fit=crop&w=600&q=80',
 shelf: 'https://images.unsplash.com/photo-1594620302200-9a762244a156?auto=format&fit=crop&w=600&q=80',
 sofa: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=600&q=80',
};
export const seedProducts = [
 {id:'p1', code:'ONS-001', name:'Luna Lounge Chair', category:'Furniture', price:4850, stock:24, image:images.chair, description:'A little more comfort for your everyday.', location:'A-01'},
 {id:'p2', code:'ONS-002', name:'Arlo Table Lamp', category:'Lighting', price:1890, stock:8, image:images.lamp, description:'A warm glow for your favorite corner.', location:'B-04'},
 {id:'p3', code:'ONS-003', name:'Sol Ceramic Vase', category:'Home decor', price:850, stock:42, image:images.vase, description:'A timeless accent, made to stand out.', location:'C-02'},
 {id:'p4', code:'ONS-004', name:'Oak Side Table', category:'Furniture', price:3290, stock:15, image:images.table, description:'Thoughtfully made for the spaces you love.', location:'A-05'},
 {id:'p5', code:'ONS-005', name:'Haven Wall Shelf', category:'Home decor', price:2150, stock:5, image:images.shelf, description:'A beautiful home for your favorite things.', location:'C-08'},
 {id:'p6', code:'ONS-006', name:'Nora Two-Seater Sofa', category:'Furniture', price:12900, stock:12, image:images.sofa, description:'Settle in and make yourself at home.', location:'A-09'},
];
export const seedOrders = [
 {id:'1048', customer:'Isabella Santos', email:'isabella@example.com', address:'Quezon City, Metro Manila', items:[{id:'p1',name:'Luna Lounge Chair',price:4850,quantity:1}], total:4850, status:'Pending', payment:'Cash on delivery', payment_verified:false, assigned_to:'', created_at:'2026-11-14T09:15:00Z'},
 {id:'1047', customer:'Miguel Reyes', email:'miguel@example.com', address:'Makati City, Metro Manila', items:[{id:'p2',name:'Arlo Table Lamp',price:1890,quantity:2}], total:3780, status:'Processing', payment:'Bank transfer', payment_verified:true, assigned_to:'Maria Cruz', created_at:'2026-11-13T15:30:00Z'},
 {id:'1046', customer:'Sofia Garcia', email:'sofia@example.com', address:'Pasig City, Metro Manila', items:[{id:'p3',name:'Sol Ceramic Vase',price:850,quantity:2}], total:1700, status:'Packed', payment:'Cash on delivery', payment_verified:false, assigned_to:'Maria Cruz', created_at:'2026-11-13T11:20:00Z'},
 {id:'1045', customer:'Daniel Lim', email:'daniel@example.com', address:'Taguig City, Metro Manila', items:[{id:'p4',name:'Oak Side Table',price:3290,quantity:1}], total:3290, status:'Ready for dispatch', payment:'Bank transfer', payment_verified:true, assigned_to:'Maria Cruz', created_at:'2026-11-12T08:00:00Z'},
 {id:'1044', user_id:'demo-customer', customer:'Amelia Cruz', email:'amelia@example.com', address:'Manila City, Metro Manila', items:[{id:'p5',name:'Haven Wall Shelf',price:2150,quantity:1}], total:2150, status:'Completed', payment:'Cash on delivery', payment_verified:true, assigned_to:'Maria Cruz', created_at:'2026-11-11T08:00:00Z'},
];
export const money = n => `₱${Number(n || 0).toLocaleString('en-PH', {minimumFractionDigits:2, maximumFractionDigits:2})}`;
export const date = d => new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
export const seedDeliveries = [
 {id:'demo-delivery-1045',order_id:'1045',assigned_driver:'demo-driver',driver_name:'Daniel Ramos',status:'Assigned',recipient_name:'',created_at:'2026-11-12T08:30:00Z',updated_at:'2026-11-12T08:30:00Z',history:[{status:'Assigned',at:'2026-11-12T08:30:00Z'}]},
 {id:'demo-delivery-1044',order_id:'1044',assigned_driver:'demo-driver',driver_name:'Daniel Ramos',status:'Delivered',recipient_name:'Amelia Cruz',created_at:'2026-11-11T09:00:00Z',updated_at:'2026-11-13T12:00:00Z',history:[{status:'Assigned',at:'2026-11-11T09:00:00Z'},{status:'Accepted',at:'2026-11-11T10:00:00Z'},{status:'Picked up',at:'2026-11-12T09:00:00Z'},{status:'In transit',at:'2026-11-12T10:00:00Z'},{status:'Arrived',at:'2026-11-13T11:45:00Z'},{status:'Delivered',at:'2026-11-13T12:00:00Z'}]}
];
