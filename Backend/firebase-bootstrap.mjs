import {deleteApp} from 'firebase-admin/app';
import {firebaseServices} from './firebase.mjs';
import {z} from 'zod';

const data=z.object({email:z.string().trim().email().transform(v=>v.toLowerCase()),password:z.string().min(12).max(128),name:z.string().trim().min(2).max(150)}).parse({email:process.env.ADMIN_EMAIL,password:process.env.ADMIN_PASSWORD,name:process.env.ADMIN_NAME||'Store Administrator'});
let app,db,auth,created;
try{
  ({app,db,auth}=firebaseServices());
  let exists=false;try{await auth.getUserByEmail(data.email);exists=true;}catch(error){if(error.code!=='auth/user-not-found')throw error;}
  if(exists)throw new Error('An account already exists with this email. Nothing was changed or promoted.');
  created=await auth.createUser({email:data.email,password:data.password,displayName:data.name});
  await db.collection('users').doc(created.uid).create({id:created.uid,email:data.email,name:data.name,phone:'',role:'ADMIN',contactConsent:false,createdAt:new Date().toISOString()});
  created=undefined;
  console.log('Firebase administrator created. Remove ADMIN_PASSWORD from Backend/.env.');
}catch(error){if(created)await auth.deleteUser(created.uid).catch(()=>console.error(`Review incomplete admin setup for UID ${created.uid}`));console.error(error.code?'Firebase administrator setup failed. Check credentials and permissions.':error.message);process.exitCode=1;}
finally{await db?.terminate().catch(()=>{});if(app)await deleteApp(app).catch(()=>{});}
