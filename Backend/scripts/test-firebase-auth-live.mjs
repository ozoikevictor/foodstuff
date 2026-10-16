import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { deleteApp } from 'firebase-admin/app';
import { firebaseServices } from '../firebase.mjs';
import { createFirebaseAuthService,firestoreAuthStore,firebaseProjectIdentityProvider } from '../firebase-auth.mjs';
import { createFirebaseAuthApi } from '../firebase-auth-server.mjs';

let app,db,auth,server,uid;
const email=`auth-check-${Date.now()}-${randomBytes(4).toString('hex')}@example.invalid`;
try {
  ({app,db,auth}=firebaseServices());
  const identity=await firebaseProjectIdentityProvider(app);
  const service=createFirebaseAuthService({auth,store:firestoreAuthStore(db),identity});
  const origin=process.env.APP_ORIGIN||'http://localhost:8080';
  server=createFirebaseAuthApi({service,origin});
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const base=`http://127.0.0.1:${server.address().port}`;
  const call=async(path,method='GET',data,cookie='')=>{
    const res=await fetch(base+path,{method,headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie},...(data===undefined?{}:{body:JSON.stringify(data)}),signal:AbortSignal.timeout(20000)});
    return {status:res.status,data:await res.json(),cookie:res.headers.get('set-cookie')?.split(';')[0]};
  };
  const password=`Temporary-Test-${randomBytes(24).toString('hex')}`;
  const registration=await call('/api/auth/register','POST',{name:'Temporary Firebase Test',email,phone:'08000000000',password,role:'ADMIN'});
  assert.equal(registration.status,200,`Registration failed: ${registration.data.error||registration.status}`);
  uid=registration.data.id;
  assert.equal(registration.data.role,'CUSTOMER');
  assert.equal((await db.collection('users').doc(uid).get()).data()?.email,email);
  assert.equal((await call('/api/auth/me','GET',undefined,registration.cookie)).data.id,uid);
  await call('/api/auth/logout','POST',{},registration.cookie);
  assert.equal((await call('/api/auth/me','GET',undefined,registration.cookie)).data,null);
  const wrong=await call('/api/auth/login','POST',{email,password:'Wrong-Password-123'});
  assert.equal(wrong.status,401,'Wrong password was not rejected.');
  const login=await call('/api/auth/login','POST',{email,password});
  assert.equal(login.status,200,`Login failed: ${login.data.error||login.status}`);
  assert.equal(login.data.id,uid);
  assert.equal((await call('/api/auth/me','GET',undefined,login.cookie)).data.id,uid);
  const publicProfile=(await db.collection('users').doc(uid).get()).data();
  assert.equal(publicProfile.password,undefined);
  assert.equal(publicProfile.password_hash,undefined);
  await call('/api/auth/logout','POST',{},login.cookie);
  assert.equal((await call('/api/auth/me','GET',undefined,login.cookie)).data,null);
  console.log('PASS: Real Firebase registration, Firestore profile, customer-only role, login, wrong-password rejection, sessions, and logout.');
}catch(error){
  // Assertion messages below contain only safe endpoint status or sanitized service errors.
  console.error(error.code==='ERR_ASSERTION'?error.message:'FAIL: Live Firebase authentication test failed. Check provider settings and backend permissions.');
  process.exitCode=1;
}finally{
  try{
    if(!uid&&auth){try{uid=(await auth.getUserByEmail(email)).uid;}catch(error){if(error.code!=='auth/user-not-found')throw error;}}
    if(uid){
      const sessions=await db.collection('backend_sessions').where('uid','==',uid).get();
      const batch=db.batch();sessions.docs.forEach(doc=>batch.delete(doc.ref));batch.delete(db.collection('users').doc(uid));await batch.commit();
      await auth.deleteUser(uid);
      assert.equal((await db.collection('users').doc(uid).get()).exists,false);
      assert.equal((await db.collection('backend_sessions').where('uid','==',uid).get()).empty,true);
      try{await auth.getUser(uid);throw new Error('Test identity still exists.');}catch(error){if(error.code!=='auth/user-not-found')throw error;}
      console.log('PASS: Temporary Firebase identity, Firestore profile, and sessions removed.');
    }
  }catch{console.error(`CLEANUP REQUIRED: Temporary test account ${email}`);process.exitCode=1;}
  if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}
  await db?.terminate().catch(()=>{});
  if(app)await deleteApp(app).catch(()=>{});
}
