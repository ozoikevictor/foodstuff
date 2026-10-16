import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync, copyFileSync, mkdirSync, existsSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {deleteApp} from 'firebase-admin/app';
import {firebaseServices} from '../firebase.mjs';
import {FirestoreMarketplace} from '../firestore-marketplace.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const categories=[
  ['rice','Rice & Grains'],['beans','Beans & Garri'],['meat','Meat & Poultry'],
  ['fish','Fish & Seafood'],['veg','Vegetables'],['fruits','Fruits'],
  ['yam','Tubers'],['oil','Cooking Oils'],['spices','Spices & Seasonings'],
  ['frozen','Frozen Foods'],['provisions','Provisions'],['wholesale','Wholesale'],
];
const {app,db,auth}=firebaseServices();
try {
  assert.equal(app.options.projectId,'naijafresh-4cd5a');
  const identity=await auth.getUserByEmail('ozoikevictor@gmail.com');
  const user=(await db.collection('users').doc(identity.uid).get()).data();
  assert.equal(user?.role,'ADMIN');
  const market=new FirestoreMarketplace({db});
  const uploads=resolve(root,'Backend',process.env.UPLOADS_PATH || 'data/uploads');
  mkdirSync(uploads,{recursive:true});
  async function image(filename,label) {
    const source=resolve(root,'Frontend/src/assets',filename);
    const bytes=readFileSync(source);
    assert.equal(bytes[0],255); assert.equal(bytes[1],216);
    const hash=createHash('sha256').update(filename).digest('hex');
    const id=`${hash.slice(0,8)}-${hash.slice(8,12)}-${hash.slice(12,16)}-${hash.slice(16,20)}-${hash.slice(20,32)}`;
    const ref=db.collection('uploads').doc(id);
    if (!existsSync(resolve(uploads,id))) copyFileSync(source,resolve(uploads,id));
    if (!(await ref.get()).exists) await ref.create({id,owner_id:user.id,mime:'image/jpeg',private:false,label,source:'Existing project artwork; restored without external image downloads',created_at:new Date().toISOString()});
    return `/api/images/${id}`;
  }
  let addedCategories=0;
  for (const [slug,name] of categories) {
    const url=await image(`c-${slug}.jpg`,name);
    if (!(await db.collection('categories').doc(slug).get()).exists) {
      await market.saveCategory(user,{slug,name,image:url,blurb:'',parentSlug:null});addedCategories++;
    }
  }
  for(const name of ['egusi','beans','ogbono','oha','pepper','yam']) await image(`r-${name}.jpg`,`${name} recipe`);
  const recipes=[{
    slug:'nigerian-jollof-rice',name:'Nigerian Jollof Rice',asset:'r-jollof.jpg',
    description:'Tomato and pepper rice, gently steamed for a family meal.',prepTime:'15 minutes',cookingTime:'50 minutes',serves:8,difficulty:'Medium',category:'Rice',
    ingredientNotes:['4 cups long-grain parboiled rice','3 bell peppers, 3 tomatoes, 1 onion, 1-2 Scotch bonnets','1/2 cup oil; 1 sliced onion; 4 tbsp tomato paste','4 garlic cloves; 1 tbsp grated ginger','2 bay leaves; 1 tbsp each thyme and curry powder','3-4 cups stock, adjusted for your rice; salt and bouillon to taste'],
    steps:['Blend peppers, tomatoes, onion and chillies. Rinse rice.','Soften sliced onion in oil. Cook tomato paste for 5 minutes; add garlic, ginger and bay leaves.','Add pepper blend. Reduce until thick and no longer raw, about 15 minutes. Season with thyme, curry, bouillon and salt.','Coat rice in sauce. Add stock gradually; cover tightly and simmer on low for about 30 minutes. If still firm, add a little hot water and continue steaming.','Rest covered for 5 minutes. Remove bay leaves, fluff and serve.'],
    video:'https://youtu.be/MrwBvPT7EGA',sources:[{title:"Cooking reference: Chef Lola's Kitchen",url:'https://cheflolaskitchen.com/jollof-rice/'},{title:'TikTok: Diary of a Kitchen Lover jollof feature',url:'https://newsroom.tiktok.com/jollof-day?lang=en-ZA'}],
  },{
    slug:'nigerian-fried-rice',name:'Nigerian Fried Rice',asset:'r-fried.jpg',
    description:'Golden rice with colourful vegetables and curry seasoning.',prepTime:'20 minutes',cookingTime:'40 minutes',serves:6,difficulty:'Easy',category:'Rice',
    ingredientNotes:['3 cups long-grain rice; 3 1/2 cups stock','1 cup diced onion; 1 cup mixed carrots, peas, corn and green beans','2-3 tbsp cooking oil; 1/2 inch grated ginger','1-2 tsp curry powder; 2 tsp thyme','2 tsp stock powder; salt and chilli to taste','Optional: cooked, diced liver or chicken'],
    steps:['Rinse rice, then cook in stock until tender but firm. Spread out briefly so excess steam escapes.','Heat oil in a wide pan. Soften onion, then stir in ginger and chilli.','Add vegetables and stir-fry for 2-3 minutes; keep some crunch. Add curry, thyme and stock powder.','Add optional fully cooked protein. Toss rice through the vegetables in small batches over high heat for 3-5 minutes.','Check seasoning and serve hot. Refrigerate leftovers promptly; reheat until steaming throughout.'],
    video:'https://www.youtube.com/watch?v=waap3kK9byY',sources:[{title:"Cooking reference: Chef Lola's Kitchen",url:'https://cheflolaskitchen.com/nigerian-fried-rice-recipe/'}],
  }];
  let addedRecipes=0;
  for(const {asset,...recipe} of recipes) {
    const url=await image(asset,recipe.name);
    if (!(await db.collection('recipes').doc(recipe.slug).get()).exists) {
      await market.saveRecipe(user,{...recipe,image:url,published:true,ingredients:[]});addedRecipes++;
    }
  }
  console.log(JSON.stringify({addedCategories,addedRecipes,mediaImages:(await db.collection('uploads').where('private','==',false).get()).size,productsCreated:0}));
} finally { await db.terminate(); await deleteApp(app); }
