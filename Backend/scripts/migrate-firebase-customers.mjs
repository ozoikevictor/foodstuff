import { DatabaseSync } from "node:sqlite";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { deleteApp } from "firebase-admin/app";
import { firebaseServices } from "../firebase.mjs";
import {
  legacyCustomer,
  LEGACY_SCRYPT_OPTIONS,
} from "../firebase-user-migration.mjs";

const path =
  process.env.DATABASE_PATH ||
  fileURLToPath(new URL("../data/marketplace.sqlite", import.meta.url));
const sqlite = new DatabaseSync(path, { readOnly: true });
let app, db, auth;
try {
  const rows = sqlite.prepare("SELECT * FROM users ORDER BY created_at").all();
  const plan = rows.map(legacyCustomer);
  ({ app, db, auth } = firebaseServices());
  let pending = 0;
  for (const item of plan) {
    let existing = null;
    try {
      existing = await auth.getUserByEmail(item.identity.email);
    } catch (error) {
      if (error.code !== "auth/user-not-found") throw error;
    }
    if (existing && existing.uid !== item.identity.uid)
      throw new Error(
        "An existing Firebase email has a different UID. Manual account reconciliation is required; no accounts were overwritten.",
      );
    let byId = null;
    try {
      byId = await auth.getUser(item.identity.uid);
    } catch (error) {
      if (error.code !== "auth/user-not-found") throw error;
    }
    if (byId && byId.email?.toLowerCase() !== item.identity.email)
      throw new Error(
        "A Firebase UID is already assigned to a different account. No identity was overwritten.",
      );
    const profile = await db.collection("users").doc(item.profile.id).get();
    if (
      profile.exists &&
      (profile.data().email !== item.profile.email ||
        profile.data().role !== "CUSTOMER")
    )
      throw new Error(
        "An existing Firestore profile conflicts with the legacy customer; no profile was overwritten.",
      );
    item.exists = !!existing;
    item.profileExists = profile.exists;
    if (!existing || !profile.exists) pending++;
  }
  console.log(
    JSON.stringify({
      customers: plan.length,
      pending,
      mode: process.argv.includes("--apply") ? "apply" : "preview",
      source: "SQLite read-only",
      destination: "Firebase Authentication + Firestore",
    }),
  );
  if (!process.argv.includes("--apply")) {
    console.log(
      "Preview only. No cloud data changed. Apply with --apply after checking the plan.",
    );
  } else {
    for (const item of plan) {
      let created = false;
      try {
        if (!item.exists) {
          await auth.createUser({
            uid: item.identity.uid,
            email: item.identity.email,
            displayName: item.identity.displayName,
            password: `Migration-${randomBytes(32).toString("hex")}`,
          });
          created = true;
          const result = await auth.importUsers(
            [item.identity],
            LEGACY_SCRYPT_OPTIONS,
          );
          if (result.failureCount)
            throw new Error("Firebase rejected a customer password import.");
        }
        if (!item.profileExists)
          await db
            .collection("users")
            .doc(item.profile.id)
            .create(item.profile);
      } catch (error) {
        if (created) await auth.deleteUser(item.identity.uid).catch(() => {});
        throw error;
      }
    }
    console.log(
      "PASS: Customer identities/profiles migrated. Original password hashes are compatible; SQLite records and sessions were not deleted. Existing local sessions are not reused by Firebase.",
    );
  }
} catch (error) {
  console.error(
    error.code
      ? "Customer migration failed; check Firebase permissions or conflicting identities."
      : error.message,
  );
  process.exitCode = 1;
} finally {
  sqlite.close();
  await db?.terminate().catch(() => {});
  if (app) await deleteApp(app).catch(() => {});
}
