import assert from 'node:assert/strict';
import {deleteApp} from 'firebase-admin/app';
import {firebaseServices} from '../firebase.mjs';
import {FirestoreMarketplace} from '../firestore-marketplace.mjs';

// Owner-approved temporary prices and quantities, editable through the admin catalogue.
const items = [
  ['long-grain-rice', 'Long-grain Rice', 'rice', 'kg', '1 kg', 2500],
  ['brown-beans', 'Brown Beans', 'beans', 'kg', '1 kg', 3000],
  ['meat-poultry-pack', 'Meat & Poultry Pack', 'meat', 'kg', '1 kg pack', 6500],
  ['fish-seafood-pack', 'Fish & Seafood Pack', 'fish', 'kg', '1 kg pack', 5500],
  ['fresh-vegetable-basket', 'Fresh Vegetable Basket', 'veg', 'basket', '1 basket', 3500],
  ['mixed-fruit-basket', 'Mixed Fruit Basket', 'fruits', 'basket', '1 basket', 5000],
  ['yam-tuber', 'Yam', 'yam', 'tuber', '1 tuber', 2000],
  ['cooking-oil-pack', 'Cooking Oil Pack', 'oil', 'litre', '1 litre pack', 3000],
  ['spice-seasoning-pack', 'Spice & Seasoning Pack', 'spices', 'piece', '1 pack', 1500],
  ['frozen-chicken', 'Frozen Chicken', 'frozen', 'kg', '1 kg', 6000],
  ['pantry-provisions-pack', 'Pantry Provisions Pack', 'provisions', 'piece', '1 pack', 4500],
  ['wholesale-rice-bag', 'Wholesale Rice', 'wholesale', 'bag', '50 kg bag', 95000],
];
const {app, db, auth} = firebaseServices();
try {
  assert.equal(app.options.projectId, 'naijafresh-4cd5a');
  const identity = await auth.getUserByEmail('ozoikevictor@gmail.com');
  const user = (await db.collection('users').doc(identity.uid).get()).data();
  assert.equal(user?.role, 'ADMIN');
  const market = new FirestoreMarketplace({db});
  const existing = new Set((await market.products(true)).map(p => p.slug));
  let created = 0;
  for (const [index, [slug, name, categorySlug, unit, label, price]] of items.entries()) {
    if (existing.has(slug)) continue;
    const category = await market.get('categories', categorySlug);
    assert.ok(category?.image, `Missing category image: ${categorySlug}`);
    await market.saveProduct(user, {
      slug, name, categorySlug, images: [category.image],
      description: `${name}, sold as ${label}. Starter listing with an illustrative image and temporary price, pack contents and stock quantity. Confirm and update these details before accepting customer orders.`,
      available: true, featured: index < 8,
      tags: [...(index < 8 ? ['popular'] : []), ...(index < 4 ? ['deal'] : []), ...(unit === 'bag' ? ['wholesale'] : [])],
      options: [{unit, label, price, stock: 20, lowStock: 5, active: true}],
    });
    created++;
  }
  const products = await market.products();
  assert.ok(items.every(([slug]) => products.some(p => p.slug === slug)));
  console.log(JSON.stringify({created, totalVisible: products.length, popular: products.filter(p => p.tags.includes('popular')).length, deals: products.filter(p => p.tags.includes('deal')).length, temporaryStockPerNewVariant:20, existingProductsOverwritten:0}));
} finally { await db.terminate(); await deleteApp(app); }
