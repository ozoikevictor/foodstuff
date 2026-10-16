import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {tabCookieName,requestSessionCookie} from './tab-sessions.mjs';
import {sessionToken,FIREBASE_SESSION_COOKIE} from './firebase-auth.mjs';
import {createFirebaseAuthApi} from './firebase-auth-server.mjs';

test('tab namespaces do not fall back to the shared login or activate on production origins',()=>{
  const id=randomUUID(),token=randomBytes(32).toString('hex');
  const req={url:'/api/auth/me',headers:{'x-test-tab-id':id,cookie:`${FIREBASE_SESSION_COOKIE}=${token}`}};
  assert.equal(requestSessionCookie(req,'http://localhost:8080',true),'');
  assert.equal(sessionToken(requestSessionCookie(req,'http://localhost:8080',false)),token);
  assert.equal(tabCookieName(req,'https://shop.example',true),FIREBASE_SESSION_COOKIE);
  assert.throws(()=>tabCookieName({...req,headers:{'x-test-tab-id':'bad;cookie'}},'http://localhost:8080',true));
  const events={url:`/api/events?testTab=${id}`,headers:{cookie:`${FIREBASE_SESSION_COOKIE}_${id}=${token}`}};
  assert.equal(sessionToken(requestSessionCookie(events,'http://localhost:8080',true)),token);
});

test('admin and customer logins and logout remain independent with a shared browser cookie jar',async t=>{
  const sessions=new Map();
  const service={
    async login({email}){const token=randomBytes(32).toString('hex');const user={id:email,role:email.startsWith('admin')?'ADMIN':'CUSTOMER'};sessions.set(token,user);return {token,user};},
    async session(cookie){return sessions.get(sessionToken(cookie)) || null;},
    async logout(cookie){sessions.delete(sessionToken(cookie));},
  };
  const origin='http://localhost:8080',adminTab=randomUUID(),customerTab=randomUUID();
  const server=createFirebaseAuthApi({service,origin,tabSessions:true});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  t.after(()=>{server.closeAllConnections();server.close();});
  const jar=new Map();
  const call=async(tab,path,data)=>{
    const res=await fetch(`http://127.0.0.1:${server.address().port}/api/auth/${path}`,{method:data?'POST':'GET',headers:{Origin:origin,'Content-Type':'application/json','X-Test-Tab-Id':tab,Cookie:[...jar].map(([k,v])=>`${k}=${v}`).join('; ')},...(data?{body:JSON.stringify(data)}:{})});
    const cookie=res.headers.get('set-cookie');
    if(cookie){assert.match(cookie,/HttpOnly/);const [pair]=cookie.split(';');const at=pair.indexOf('=');jar.set(pair.slice(0,at),pair.slice(at+1));}
    assert.equal(res.status,200);return res.json();
  };
  await call(adminTab,'login',{email:'admin@example.invalid',password:'test-password'});
  await call(customerTab,'login',{email:'customer@example.invalid',password:'test-password'});
  assert.equal((await call(adminTab,'me')).role,'ADMIN');
  assert.equal((await call(customerTab,'me')).role,'CUSTOMER');
  await call(customerTab,'logout',{});
  assert.equal(await call(customerTab,'me'),null);
  assert.equal((await call(adminTab,'me')).role,'ADMIN');
});
