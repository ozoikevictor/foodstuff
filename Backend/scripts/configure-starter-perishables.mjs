import assert from 'node:assert/strict';
import {firebaseServices} from '../firebase.mjs';
import {deleteApp} from 'firebase-admin/app';
const {app,db}=firebaseServices();
try {
  assert.equal(app.options.projectId,'naijafresh-4cd5a');
  const slugs=new Set(['meat-poultry-pack','fish-seafood-pack','fresh-vegetable-basket','mixed-fruit-basket','frozen-chicken']);
  const products=await db.collection('products').get();
  let changed=0;
  for(const doc of products.docs) {
    const product=doc.data();
    if(!slugs.has(product.slug) || product.perishable !== undefined) continue;
    await db.runTransaction(async tx=>{
      const fresh=await tx.get(doc.ref);
      if(fresh.data()?.perishable !== undefined) return;
      tx.update(doc.ref,{perishable:true,orderStart:'08:00',orderCutoff:'14:00'});
      tx.create(db.collection('audit_log').doc(),{action:'product.perishable-window.setup',target:doc.id,actor:'owner-requested-setup',createdAt:new Date().toISOString()});
    });
    changed++;
  }
  console.log(JSON.stringify({perishableProductsConfigured:changed,timezone:'Africa/Lagos',opens:'08:00',cutoff:'14:00'}));
}finally{await db.terminate();await deleteApp(app);}
