import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createFirebaseAuthService,authError,firebaseIdentityProvider,firebaseAuthProjectConfig,firebaseEmailPasswordEnabled} from './firebase-auth.mjs';
import {createFirebaseAuthApi} from './firebase-auth-server.mjs';

function dependencies(){
  const profiles=new Map();const sessions=new Map();const accounts=new Map();const deleted=[];let now=Date.now();
  const auth={
    async verifyIdToken(token){const uid=token.replace('test-token:','');if(!accounts.has(uid))throw authError(401,'Invalid identity.');return {uid,auth_time:Math.floor(now/1000)};},
    async updateUser(uid,fields){Object.assign(accounts.get(uid),fields);},
    async getUser(uid){if(!accounts.has(uid))throw Object.assign(new Error('User not found'),{code:'auth/user-not-found'});return accounts.get(uid);},
    async deleteUser(uid){accounts.delete(uid);deleted.push(uid);},
  };
  const identity={async passwordRequest(action,email,password){
    let record=[...accounts.values()].find(a=>a.email===email);
    if(action==='signUp'){if(record)throw authError(409,'An account with this email already exists.');record={uid:randomUUID(),email,password,disabled:false,tokensValidAfterTime:new Date(0).toISOString()};accounts.set(record.uid,record);}
    else if(!record||record.password!==password||record.disabled)throw authError(401,'Email or password is incorrect.');
    return {localId:record.uid,idToken:`test-token:${record.uid}`};
  }};
  const store={
    async createProfile(p){if(profiles.has(p.id))throw new Error('Conflict');profiles.set(p.id,structuredClone(p));},
    async ensureProfile(p){if(!profiles.has(p.id))profiles.set(p.id,structuredClone(p));return profiles.get(p.id);},
    async getProfile(uid){return profiles.get(uid)||null;},
    async updateProfile(uid,fields){const p=profiles.get(uid);Object.assign(p,fields);return p;},
    async deleteProfile(uid){profiles.delete(uid);},
    async createSession(hash,session){sessions.set(hash,structuredClone(session));},
    async getSession(hash){return sessions.get(hash)||null;},
    async deleteSession(hash){sessions.delete(hash);},
  };
  const service=createFirebaseAuthService({auth,store,identity,clock:()=>now});
  return {service,auth,store,identity,profiles,sessions,accounts,deleted,advance:ms=>{now+=ms;}};
}
const data={email:'customer@example.invalid',password:'Test-Password-12345',name:'Test Customer',phone:'08000000000'};
const cookie=token=>`cribs_firebase_session=${token}`;

test('profile photos persist, require ownership, and can be removed', async () => {
  const d = dependencies();
  const registered = await d.service.register(data);
  const ownPhoto = '/api/images/11111111-1111-4111-8111-111111111111';
  d.store.ownsImage = async (uid, url) => uid === registered.user.id && url === ownPhoto;
  const saved = await d.service.updateProfile(cookie(registered.token), { name: data.name, phone: data.phone, photoUrl: ownPhoto });
  assert.equal(saved.photoUrl, ownPhoto);
  assert.equal((await d.service.session(cookie(registered.token))).photoUrl, ownPhoto);
  await assert.rejects(d.service.updateProfile(cookie(registered.token), { name: data.name, phone: data.phone, photoUrl: '/api/images/22222222-2222-4222-8222-222222222222' }), e => e.status === 400);
  await d.service.updateProfile(cookie(registered.token), { name: 'New Name', phone: data.phone });
  assert.equal((await d.service.session(cookie(registered.token))).photoUrl, ownPhoto);
  const removed = await d.service.updateProfile(cookie(registered.token), { name: data.name, phone: data.phone, photoUrl: '' });
  assert.equal(removed.photoUrl, '');
});

test('Firebase email/password remains enabled when optional passwordRequired is omitted or false',()=>{
  assert.equal(firebaseEmailPasswordEnabled({signIn:{email:{enabled:true}}}),true);
  assert.equal(firebaseEmailPasswordEnabled({signIn:{email:{enabled:true,passwordRequired:false}}}),true);
  assert.equal(firebaseEmailPasswordEnabled({signIn:{email:{enabled:false}}}),false);
  assert.equal(firebaseEmailPasswordEnabled({}),false);
});

test('Firebase registration stores profiles/sessions without storing passwords or raw session tokens',async()=>{
  const d=dependencies();const r=await d.service.register({...data,role:'ADMIN'});
  assert.equal(r.user.role,'CUSTOMER');assert.equal(d.profiles.get(r.user.id).password,undefined);
  assert.ok(!d.sessions.has(r.token));assert.equal(d.sessions.size,1);
  assert.equal((await d.service.session(cookie(r.token))).id,r.user.id);
  await d.service.logout(cookie(r.token));assert.equal(await d.service.session(cookie(r.token)),null);
});
test('Firebase login rejects wrong passwords, preserves server roles, and does not duplicate profiles',async()=>{
  const d=dependencies();const r=await d.service.register(data);d.profiles.get(r.user.id).role='RIDER';
  await assert.rejects(d.service.login({email:data.email,password:'wrong'}),e=>e.status===401);
  await assert.rejects(d.service.register(data),e=>e.status===409);
  const login=await d.service.login(data);assert.equal(login.user.id,r.user.id);assert.equal(login.user.role,'RIDER');assert.equal(d.profiles.size,1);
});
test('expired, disabled, deleted, and globally revoked Firebase accounts cannot use sessions',async()=>{
  for(const kind of ['expired','disabled','deleted','revoked']){
    const d=dependencies();const r=await d.service.register(data);
    if(kind==='expired')d.advance(8*86400000);
    if(kind==='disabled')d.accounts.get(r.user.id).disabled=true;
    if(kind==='deleted')d.accounts.delete(r.user.id);
    if(kind==='revoked')d.accounts.get(r.user.id).tokensValidAfterTime=new Date(Date.now()+10000).toISOString();
    assert.equal(await d.service.session(cookie(r.token)),null,kind);assert.equal(d.sessions.size,0);
  }
});
test('failed profile creation compensates the newly created Firebase identity',async()=>{
  const d=dependencies();d.store.createProfile=async()=>{throw new Error('Firestore unavailable');};
  const service=createFirebaseAuthService({auth:d.auth,store:d.store,identity:d.identity});
  await assert.rejects(service.register(data));assert.equal(d.accounts.size,0);assert.equal(d.deleted.length,1);
});
test('Firebase provider errors are sanitized and returned as useful setup/credential failures',async()=>{
  assert.throws(()=>firebaseIdentityProvider({}),/FIREBASE_WEB_API_KEY/);
  for(const [code,status]of [['EMAIL_EXISTS',409],['OPERATION_NOT_ALLOWED',503],['INVALID_LOGIN_CREDENTIALS',401],['TOO_MANY_ATTEMPTS_TRY_LATER',429]]){
    const provider=firebaseIdentityProvider({apiKey:'test-only',fetcher:async()=>Response.json({error:{message:code}},{status:400})});
    await assert.rejects(provider.passwordRequest('signInWithPassword',data.email,data.password),e=>e.status===status);
  }
});

test('Firebase project configuration is read with server credentials and errors are sanitized',async()=>{
  const app={options:{projectId:'naijafresh-test-project',credential:{async getAccessToken(){return {access_token:'test-only-token'};}}}};
  let seen;
  const config=await firebaseAuthProjectConfig(app,async(url,options)=>{seen={url,options};return Response.json({signIn:{email:{enabled:true,passwordRequired:true}},client:{apiKey:'test-only-api-key'}});});
  assert.equal(config.signIn.email.enabled,true);
  assert.match(seen.url,/projects\/naijafresh-test-project\/config$/);
  assert.equal(seen.options.headers.Authorization,'Bearer test-only-token');
  await assert.rejects(firebaseAuthProjectConfig(app,async()=>Response.json({private:'not exposed'},{status:403})),e=>e.status===503&&!e.message.includes('not exposed'));
});

test('a mismatched Firebase token cannot delete an unrelated identity during registration cleanup',async()=>{
  const d=dependencies();d.auth.verifyIdToken=async()=>({uid:'different-uid',auth_time:Math.floor(Date.now()/1000)});
  const service=createFirebaseAuthService({auth:d.auth,store:d.store,identity:d.identity});
  await assert.rejects(service.register(data),e=>e.status===401);
  assert.equal(d.deleted.length,0);
});
test('Firebase auth HTTP endpoints enforce origins, validate input, protect session cookies, and log out',async t=>{
  const d=dependencies();const origin='https://shop.example';const server=createFirebaseAuthApi({service:d.service,origin});await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const base=`http://127.0.0.1:${server.address().port}`;t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));});
  const call=async(path,method='GET',body,session='',requestOrigin=origin)=>{const r=await fetch(base+path,{method,headers:{Origin:requestOrigin,Cookie:session,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:r.status,cookie:r.headers.get('set-cookie'),body:await r.json()};};
  assert.equal((await call('/api/auth/register','POST',data,'','https://evil.example')).status,403);
  assert.equal((await call('/api/auth/register','POST',{...data,password:'short'})).status,400);
  const registration=await call('/api/auth/register','POST',{...data,role:'ADMIN'});assert.equal(registration.status,200);assert.equal(registration.body.role,'CUSTOMER');
  assert.match(registration.cookie,/HttpOnly/);assert.match(registration.cookie,/SameSite=Lax/);assert.match(registration.cookie,/Secure/);assert.equal(registration.body.token,undefined);
  const session=registration.cookie.split(';')[0];assert.equal((await call('/api/auth/me','GET',undefined,session)).body.id,registration.body.id);
  assert.equal((await call('/api/profile','PATCH',{name:'Updated Name',phone:data.phone},session)).body.name,'Updated Name');
  await call('/api/auth/logout','POST',{},session);assert.equal((await call('/api/auth/me','GET',undefined,session)).body,null);
  assert.equal((await call('/api/profile','PATCH',{name:'No Permission',phone:data.phone})).status,401);
  const login=await call('/api/auth/login','POST',data);assert.equal(login.status,200);assert.equal(login.body.id,registration.body.id);
});
