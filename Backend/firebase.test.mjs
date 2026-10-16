import { test } from 'node:test';
import assert from 'node:assert/strict';
import { firebaseConfig, serviceAccountConfig } from './firebase.mjs';

test('environment credentials accept complete JSON and reject malformed or mismatched accounts without exposing values', () => {
  const account = { type: 'service_account', project_id: 'naijafresh-test-project', client_email: 'test@example.invalid', private_key: 'test-only-private-value' };
  const env = { FIREBASE_PROJECT_ID: account.project_id, FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify(account) };
  assert.deepEqual(serviceAccountConfig(env), account);
  assert.equal(serviceAccountConfig({}), null);
  assert.throws(() => serviceAccountConfig({ ...env, FIREBASE_SERVICE_ACCOUNT_JSON: 'invalid-secret-value' }), error => !error.message.includes('invalid-secret-value'));
  assert.throws(() => serviceAccountConfig({ ...env, FIREBASE_PROJECT_ID: 'other-project' }), /belong/);
});
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
