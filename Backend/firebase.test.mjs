import { test } from 'node:test';
import assert from 'node:assert/strict';
import { firebaseConfig } from './firebase.mjs';
test('Firebase requires an explicitly configured project without a local fallback',()=>{
  assert.throws(()=>firebaseConfig({}),/FIREBASE_PROJECT_ID/);
  assert.throws(()=>firebaseConfig({FIREBASE_PROJECT_ID:'https://wrong.example'}),/FIREBASE_PROJECT_ID/);
  assert.deepEqual(firebaseConfig({FIREBASE_PROJECT_ID:'naijafresh-test-project'}),{projectId:'naijafresh-test-project',databaseId:'(default)'});
});
test('real Firebase checks reject emulator settings',()=>{
  assert.throws(()=>firebaseConfig({FIREBASE_PROJECT_ID:'naijafresh-test-project',FIRESTORE_EMULATOR_HOST:'localhost:8081'}),/emulator/);
  assert.throws(()=>firebaseConfig({FIREBASE_PROJECT_ID:'naijafresh-test-project',FIREBASE_AUTH_EMULATOR_HOST:'localhost:9099'}),/emulator/);
});
test('named Firestore database IDs are explicit and validated',()=>{
  assert.equal(firebaseConfig({FIREBASE_PROJECT_ID:'naijafresh-test-project',FIRESTORE_DATABASE_ID:'marketplace'}).databaseId,'marketplace');
  assert.throws(()=>firebaseConfig({FIREBASE_PROJECT_ID:'naijafresh-test-project',FIRESTORE_DATABASE_ID:'invalid/path'}),/database ID/);
});
