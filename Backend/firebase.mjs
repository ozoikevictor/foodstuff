import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

export function firebaseConfig(env = process.env) {
  const projectId = env.FIREBASE_PROJECT_ID?.trim();
  if (!projectId || !/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId)) {
    throw new Error('Set your real FIREBASE_PROJECT_ID in Backend/.env.');
  }
  if (env.FIRESTORE_EMULATOR_HOST || env.FIREBASE_AUTH_EMULATOR_HOST) {
    throw new Error('This connection check requires real Firebase; emulator settings must be removed.');
  }
  const databaseId = env.FIRESTORE_DATABASE_ID?.trim() || '(default)';
  if (databaseId !== '(default)' && !/^[a-z][a-z0-9-]{2,61}[a-z0-9]$/.test(databaseId)) {
    throw new Error('Use (default) or your actual Firestore database ID.');
  }
  return { projectId, databaseId };
}

export function serviceAccountConfig(env = process.env) {
  if (!env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim()) return null;
  let account;
  try { account = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON); }
  catch { throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON must contain the complete service-account JSON.'); }
  if (!account || account.type !== 'service_account' || typeof account.client_email !== 'string' || typeof account.private_key !== 'string')
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not a valid service-account credential.');
  if (account.project_id !== env.FIREBASE_PROJECT_ID?.trim())
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON must belong to FIREBASE_PROJECT_ID.');
  return account;
}

export function firebaseServices() {
  const { projectId, databaseId } = firebaseConfig();
  const name = 'naijafresh-backend';
  const existing = getApps().find(app=>app.name===name);
  if (existing && existing.options.projectId !== projectId) {
    throw new Error('Firebase was initialized for a different project; restart the backend.');
  }
  const account = serviceAccountConfig();
  const app = existing || initializeApp({ projectId, credential: account ? cert(account) : applicationDefault() }, name);
  return { app, db: getFirestore(app, databaseId), auth: getAuth(app) };
}
