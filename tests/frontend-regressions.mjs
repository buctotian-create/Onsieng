// Dependency-free behavioral checks: node tests/frontend-regressions.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import * as data from '../data.js';

const source=fs.readFileSync(process.env.APP_SOURCE||new URL('../app.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace(/start\(\);\s*$/,'');
function app(initial={},storageFails=false){
 const values=new Map(Object.entries(initial)), listeners={}, intervals=[],timeouts=[];
 const root={innerHTML:'',addEventListener:(name,fn)=>{listeners[name]=fn},querySelector:()=>null};
 const document={querySelector:selector=>selector==='#root'?root:null,createElement:()=>({setAttribute(){},remove(){}}),body:{append(){}}};
 const context=vm.createContext({...data,SUPABASE_URL:'',SUPABASE_ANON_KEY:'',CONTACT_FACEBOOK_URL:'',CONTACT_INSTAGRAM_URL:'',CONTACT_PHONE:'',structuredClone,URL,console,crypto:webcrypto,document,HTMLImageElement:class {},localStorage:{getItem:key=>values.get(key)??null,setItem:(key,value)=>{if(storageFails)throw new Error('QuotaExceededError');values.set(key,value)}},setTimeout:fn=>timeouts.push(fn),clearTimeout(){},setInterval:fn=>intervals.push(fn)});
 vm.runInContext(source+`;globalThis.api={state,placeOrder,persist,upgradeDemoCatalog,saveProduct,refreshData,loadPublicCatalog,render,readLocal,setClient:client=>{supabase=client}}`,context);
 context.api.state.role='admin';context.api.state.page='Overview';
 return {...context.api,listeners,root,values,timeouts};
}
function clientFor(a,{role='customer',failRefresh=false}={}){
 const profile={id:'customer-one',display_name:'Test account',role};
 return {from(table){let result={data:table==='profiles'?profile:table==='products'?a.state.products:table==='orders'?a.state.orders:[],error:failRefresh?{message:'Offline during refresh'}:null};const query={select:()=>query,order:()=>Promise.resolve(result),eq:()=>query,maybeSingle:()=>Promise.resolve(result)};return query}};
}
const details=()=>({customer:'Test Customer',email:'test@example.test',address:'123 Test Road',payment:'Cash on delivery',phone:'+63 900 000 0000'});
const cart=a=>{a.state.cart=[{...a.state.products[0],quantity:1}]};
const tests=[];
function test(name,fn){tests.push([name,fn])}
test('malformed local JSON and non-array data recover to the demo',()=>{
 for(const value of ['{','{}','null','[null]','[{}]']){const a=app({'onsieng-products':value});a.state.page='Shop';a.render();assert.equal(a.state.products.length,data.seedProducts.length);assert.match(a.root.innerHTML,/Luna Lounge Chair/)}
});
test('storage quota failure cannot leave a committed order in the cart',async()=>{
 const a=app({},true);cart(a);await a.placeOrder(details());assert.equal(a.state.orders.length,6);assert.equal(a.state.cart.length,0);assert.equal(a.state.products[0].stock,23);assert.equal(a.state.modal,'confirmation');
});
test('demo saves products, orders and deliveries in one atomic snapshot',async()=>{
 const a=app();cart(a);await a.placeOrder(details());const b=app(Object.fromEntries(a.values));assert.equal(b.state.orders.length,6);assert.equal(b.state.products[0].stock,23);assert.ok(a.values.has('onsieng-demo-v2'));
});
test('changed prices require cart review before checkout',async()=>{
 const a=app();cart(a);a.state.products[0].price=5000;await assert.rejects(a.placeOrder(details()),/review|Review/);assert.equal(a.state.orders.length,5);assert.equal(a.state.cart[0].price,5000);await a.placeOrder(details());assert.equal(a.state.selected.total,5000);
});
test('removed and sold-out products cannot be ordered from an old cart',async()=>{
 for(const removed of [true,false]){const a=app();cart(a);if(removed)a.state.products.shift();else a.state.products[0].stock=0;await assert.rejects(a.placeOrder(details()));assert.equal(a.state.orders.length,5);assert.equal(a.state.cart.length,0)}
});
test('duplicate product codes and whitespace-only details are rejected in demo',async()=>{
 const a=app();await assert.rejects(a.saveProduct({...a.state.products[0],id:'another-id'}),/code/);cart(a);await assert.rejects(a.placeOrder({...details(),address:'   '}),/required/);assert.equal(a.state.orders.length,5);
});
test('successful RPC checkout stays confirmed if data refresh fails',async()=>{
 const a=app();cart(a);a.state.session={user:{id:'customer-one'}};a.state.profile={id:'customer-one',role:'customer'};
 const order={...details(),id:'saved-order',status:'Pending',created_at:new Date().toISOString(),total:4850,items:[]};
 const client=clientFor(a,{failRefresh:true});client.rpc=async()=>({data:order,error:null});a.setClient(client);
 await a.placeOrder(details());assert.equal(a.state.cart.length,0);assert.equal(a.state.selected.id,'saved-order');assert.equal(a.state.modal,'confirmation');assert.ok(a.state.orders.some(o=>o.id==='saved-order'));
});
test('repeated async delivery clicks send one update',async()=>{
 const a=app();a.state.selected=a.state.orders.find(o=>o.id==='1045');let calls=0,release;const pending=new Promise(resolve=>release=resolve);
 a.setClient({rpc:async()=>{calls++;await pending;return {data:{...a.state.deliveries[0],status:'Accepted'},error:null}}});
 const el={dataset:{action:'delivery-step',status:'Accepted'},disabled:false};const event={target:{closest:()=>el}};
 const first=a.listeners.click(event);const second=a.listeners.click(event);release();await Promise.all([first,second]);assert.equal(calls,1);assert.equal(a.state.busy,false);
});
test('role changes reset navigation and clear privileged cached records',async()=>{
 const a=app();a.state.session={user:{id:'customer-one'}};a.state.profile={id:'customer-one',role:'admin'};a.state.team=[{id:'private-account'}];a.state.alerts=[{message:'private alert'}];a.state.page='Team';a.state.modal='order';a.state.selected=a.state.orders[0];cart(a);
 a.setClient(clientFor(a));await a.refreshData();assert.equal(a.state.page,'Shop');assert.equal(a.state.modal,'');assert.equal(a.state.selected,null);assert.equal(a.state.team.length,0);assert.equal(a.state.alerts.length,0);assert.equal(a.state.cart.length,0);
});
test('late responses for a previous account cannot populate a new session',async()=>{
 const a=app();a.state.session={user:{id:'customer-one'}};let release;const pending=new Promise(resolve=>release=resolve);const client=clientFor(a);const original=client.from;client.from=table=>{const query=original(table);query.order=()=>pending;return query};a.setClient(client);
 const request=a.refreshData();a.state.session={user:{id:'another-account'}};a.state.products=[];release({data:[{id:'private-product'}],error:null});await request;assert.equal(a.state.products.length,0);
});
test('driver modal receives the refreshed warehouse status',async()=>{
 const a=app();a.state.session={user:{id:'customer-one'}};a.state.role='driver';a.state.profile={role:'driver'};a.state.modal='driver-order';a.state.selected={...a.state.orders[0],status:'Pending'};a.state.orders[0].status='Packed';a.setClient(clientFor(a,{role:'driver'}));await a.refreshData();assert.equal(a.state.selected.status,'Packed');
});
test('checkout response from a previous account is discarded',async()=>{
 const a=app();cart(a);a.state.session={user:{id:'customer-one'}};let release;const pending=new Promise(resolve=>release=resolve);
 a.setClient({rpc:async()=>{await pending;return {data:{id:'private-order'},error:null}}});
 const request=a.placeOrder(details());a.state.session={user:{id:'another-account'}};a.state.orders=[];release();await assert.rejects(request,/account changed/);assert.equal(a.state.orders.length,0);
});
test('guest can view and add products but cannot submit an order',async()=>{
 const a=app();a.state.role='guest';a.state.page='Shop';a.render();assert.match(a.root.innerHTML,/Our collection/);cart(a);
 await assert.rejects(a.placeOrder(details()),/Sign in/);assert.equal(a.state.orders.length,5);assert.equal(a.state.cart.length,1);
 const el={dataset:{action:'checkout'},disabled:false};await a.listeners.click({target:{closest:()=>el}});assert.equal(a.state.showAuth,true);assert.equal(a.state.cart.length,1);
});
test('signed-in profile errors remain visible and guest cart survives retry',async()=>{
 const a=app();a.state.role='guest';cart(a);a.state.session={user:{id:'customer-one'}};a.state.profile=null;a.state.loadError='Profile unavailable';
 a.setClient(clientFor(a));a.render();assert.match(a.root.innerHTML,/Profile unavailable/);assert.match(a.root.innerHTML,/Retry/);
 await a.refreshData(true);assert.equal(a.state.role,'customer');assert.equal(a.state.cart.length,1);
});
test('old demo snapshots gain new products once without overwriting edits',()=>{
 const products=structuredClone(data.seedProducts.slice(0,6));products[0].name='Edited chair';products.push({...data.seedProducts[6],id:'custom-id',name:'Existing code'});
 const snapshot={products,orders:structuredClone(data.seedOrders),alerts:[],deliveries:structuredClone(data.seedDeliveries)};
 const a=app({'onsieng-demo-v2':JSON.stringify(snapshot)});a.upgradeDemoCatalog();assert.equal(a.state.products[0].name,'Edited chair');assert.equal(a.state.products.filter(p=>p.code==='ONS-007').length,1);assert.equal(a.state.products.length,12);assert.equal(JSON.parse(a.values.get('onsieng-demo-v2')).catalogVersion,2);
 a.state.products=a.state.products.filter(p=>p.id!=='p8');a.persist();const b=app(Object.fromEntries(a.values));b.upgradeDemoCatalog();assert.ok(!b.state.products.some(p=>p.id==='p8'));assert.equal(b.state.orders.length,5);
});
test('public catalog returns only for guest and handles errors',async()=>{
 const a=app();a.state.role='guest';a.setClient({rpc:async()=>({data:[{...data.seedProducts[0]}],error:null})});
 await a.loadPublicCatalog();assert.equal(a.state.products.length,1);assert.equal(a.state.catalogError,'');
 a.setClient({rpc:async()=>({data:null,error:{message:'unavailable'}})});await a.loadPublicCatalog();assert.equal(a.state.products.length,0);assert.match(a.state.catalogError,/temporarily unavailable/);
});
let failures=0;
for(const [name,fn] of tests){try{await fn();console.log(`PASS ${name}`)}catch(error){failures++;console.error(`FAIL ${name}: ${error.message}`)}}
console.log(`${tests.length-failures}/${tests.length} regression checks passed`);
if(failures)process.exitCode=1;
