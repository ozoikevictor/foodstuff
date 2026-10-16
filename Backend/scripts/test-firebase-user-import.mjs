import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { deleteApp } from "firebase-admin/app";
import { firebaseServices } from "../firebase.mjs";
import { hashPassword } from "../auth.mjs";
import {
  legacyCustomer,
  LEGACY_SCRYPT_OPTIONS,
} from "../firebase-user-migration.mjs";
import { firebaseProjectIdentityProvider } from "../firebase-auth.mjs";
let app,
  db,
  auth,
  created = false;
const uid = randomUUID();
try {
  ({ app, db, auth } = firebaseServices());
  const email = `auth-check-${Date.now()}-${randomBytes(4).toString("hex")}@example.invalid`;
  const password = `Temporary-Test-${randomBytes(24).toString("hex")}`;
  const converted = legacyCustomer({
    id: uid,
    email,
    name: "Temporary Firebase Test",
    phone: "08000000000",
    role: "CUSTOMER",
    created_at: "2026-10-13 12:00:00",
    password_hash: await hashPassword(password),
  });
  await auth.createUser({
    uid,
    email,
    displayName: "Temporary Firebase Test",
    password: `Reservation-${randomBytes(32).toString("hex")}`,
  });
  created = true;
  const imported = await auth.importUsers(
    [converted.identity],
    LEGACY_SCRYPT_OPTIONS,
  );
  assert.equal(
    imported.failureCount,
    0,
    "Firebase rejected the isolated legacy hash import.",
  );
  const provider = await firebaseProjectIdentityProvider(app);
  const login = await provider.passwordRequest(
    "signInWithPassword",
    email,
    password,
  );
  assert.equal(login.localId, uid);
  const verified = await auth.verifyIdToken(login.idToken, true);
  assert.equal(verified.uid, uid);
  console.log(
    "PASS: A legacy Node.js scrypt password imports into real Firebase and signs in with the unchanged password.",
  );
} catch (error) {
  console.error(
    error.code === "ERR_ASSERTION"
      ? error.message
      : "FAIL: Firebase legacy-password compatibility test failed.",
  );
  process.exitCode = 1;
} finally {
  if (created) {
    try {
      await auth.deleteUser(uid);
      console.log("PASS: Temporary Firebase identity removed.");
    } catch {
      console.error(`CLEANUP REQUIRED: Firebase UID ${uid}`);
      process.exitCode = 1;
    }
  }
  await db?.terminate().catch(() => {});
  if (app) await deleteApp(app).catch(() => {});
}
