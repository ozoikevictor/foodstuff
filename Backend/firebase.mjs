import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
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

export function firebaseServices() {
  const { projectId, databaseId } = firebaseConfig();
  const name = 'naijafresh-backend';
  const existing = getApps().find(app=>app.name===name);
  if (existing && existing.options.projectId !== projectId) {
    throw new Error('Firebase was initialized for a different project; restart the backend.');
  }
  const app = existing || initializeApp({ projectId, credential: applicationDefault() }, name);
  return { app, db: getFirestore(app, databaseId), auth: getAuth(app) };
}
