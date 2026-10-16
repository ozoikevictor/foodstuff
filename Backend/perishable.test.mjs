import {test} from 'node:test';
import assert from 'node:assert/strict';
import {orderingStatus} from './perishable.mjs';
import {product, checkout} from './firestore-schemas.mjs';
import {FirestoreMarketplace} from './firestore-marketplace.mjs';
import {randomUUID} from 'node:crypto';
test('perishable ordering uses Lagos time with inclusive opening and exclusive cutoff', () => {
  const p={perishable:true,orderStart:'08:00',orderCutoff:'14:00'};
  assert.equal(orderingStatus(p,Date.parse('2026-10-13T06:59:00Z')).open,false);
  assert.equal(orderingStatus(p,Date.parse('2026-10-13T07:00:00Z')).open,true);
  assert.equal(orderingStatus(p,Date.parse('2026-10-13T12:59:00Z')).open,true);
  assert.equal(orderingStatus(p,Date.parse('2026-10-13T13:00:00Z')).open,false);
  assert.equal(orderingStatus(p,Date.parse('2026-10-14T07:00:00Z')).open,true);
  assert.equal(orderingStatus({perishable:false},Date.parse('2026-10-13T23:00:00Z')).open,true);
});
test('checkout enforces closed ordering windows and delivery preference before reserving stock', async () => {
  const variantId=randomUUID();
  const market=new FirestoreMarketplace({db:{runTransaction:fn=>fn({})},payments:{},clock:()=>Date.parse('2026-10-13T13:00:00Z')});
  market.adminIds=async()=>[];
  market.get=async(collection)=>collection==='settings'?{zones:[{name:'Lagos',fee:100}]}:collection==='variants'?{id:variantId,productId:'fish',active:true,stock:5}:collection==='products'?{id:'fish',name:'Fish',available:true,perishable:true,images:[],orderStart:'08:00',orderCutoff:'14:00'}:null;
  const data={items:[{variantId,qty:1}],address:'10 Example Street Lagos',phone:'08000000000',zone:'Lagos',idempotencyKey:randomUUID(),latitude:6.5,longitude:3.3,deliveryPreference:'within-2-hours'};
  await assert.rejects(market.checkout({id:'customer'},data),/only be ordered/);
  market.clock=()=>Date.parse('2026-10-13T09:00:00Z');
  await assert.rejects(market.checkout({id:'customer'},{...data,deliveryPreference:'standard'}),/delivery preference/);
});
test('perishable schedules reject overnight and malformed hours', () => {
  const p={name:'Fish',slug:'fish',categorySlug:'fish',description:'Fish',images:['/api/images/1234-abcd'],options:[{unit:'kg',label:'1 kg',price:100,stock:5}],perishable:true};
  assert.equal(product.parse(p).orderCutoff,'14:00');
  assert.throws(()=>product.parse({...p,orderStart:'15:00',orderCutoff:'08:00'}));
  assert.throws(()=>product.parse({...p,orderCutoff:'25:00'}));
  assert.throws(()=>checkout.parse({deliveryPreference:'tomorrow'}));
});
