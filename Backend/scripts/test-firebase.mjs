import { randomUUID } from 'node:crypto';
import { deleteApp } from 'firebase-admin/app';
import { FieldValue } from 'firebase-admin/firestore';
import { firebaseServices } from '../firebase.mjs';

let app;
let db;
let ref;
let created = false;
let timer;
try {
  ({app,db} = firebaseServices());
  timer = setTimeout(()=>{
    console.error('FAIL: Firebase connection timed out. Check credentials, project status, and network access.');
    if (created) console.error(`A test document may need cleanup: ${ref.path}`);
    process.exit(1);
  },20000);
  const marker = randomUUID();
  ref = db.collection('backend_connection_checks').doc(marker);
  // A read of a nonexistent document proves remote connectivity without reading customer data.
  const initial = await ref.get();
  if (initial.exists) throw new Error('Unexpected test document collision.');
  if (process.argv.includes('--write')) {
    await ref.create({marker,createdAt:FieldValue.serverTimestamp()});
    created = true;
    const saved = await ref.get();
    if(saved.data()?.marker !== marker) throw new Error('Firestore write/read verification failed.');
    await ref.delete();
    created = false;
    if((await ref.get()).exists) throw new Error('Test document cleanup could not be verified.');
    console.log('PASS: Real Firebase Firestore connection, write/read verification, and test-document cleanup.');
  } else {
    console.log('PASS: Real Firebase Firestore authenticated read. No records were created.');
  }
  console.log('Application queries and frontend have not been migrated yet.');
} catch (error) {
  if (created && ref) {
    try {await ref.delete();created=false;} catch {console.error(`Test document cleanup required: ${ref.path}`);}
  }
  const messages = {
    5:'Firestore database was not found. Create it in the Firebase console and check its database ID.',
    7:'Firebase permission denied. Check the service account permissions and project.',
    16:'Firebase authentication failed. Check the local service-account credentials.',
    14:'Firebase is unreachable. Check network access and project status.',
  };
  console.error(`FAIL: ${!app?'Firebase configuration or credentials are missing/invalid. See Backend/FIREBASE_CONNECTION.md.':messages[error.code]||'Firebase connection could not be verified. Check project setup and credentials.'}`);
  process.exitCode=1;
} finally {
  clearTimeout(timer);
  await db?.terminate().catch(()=>{});
  if(app) await deleteApp(app).catch(()=>{});
}
