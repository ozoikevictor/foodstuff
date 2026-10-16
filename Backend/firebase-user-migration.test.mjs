import { test } from "node:test";
import assert from "node:assert/strict";
import { scryptSync } from "node:crypto";
import {
  legacyCustomer,
  LEGACY_SCRYPT_OPTIONS,
} from "./firebase-user-migration.mjs";
test("legacy customer import preserves Node scrypt bytes without putting hashes in Firestore profiles", () => {
  const salt = "0123456789abcdef0123456789abcdef";
  const password = "Isolated test password";
  const derived = scryptSync(password, salt, 64);
  const result = legacyCustomer({
    id: "test-customer",
    email: "Customer@example.invalid",
    name: "Test Customer",
    phone: "08000000000",
    role: "CUSTOMER",
    created_at: "2026-10-13 12:00:00",
    password_hash: `${salt}:${derived.toString("hex")}`,
  });
  assert.deepEqual(result.identity.passwordSalt, Buffer.from(salt, "utf8"));
  assert.deepEqual(result.identity.passwordHash, derived);
  const options = LEGACY_SCRYPT_OPTIONS.hash;
  assert.deepEqual(
    scryptSync(
      password,
      result.identity.passwordSalt,
      options.derivedKeyLength,
      {
        N: options.memoryCost,
        r: options.blockSize,
        p: options.parallelization,
      },
    ),
    result.identity.passwordHash,
  );
  assert.equal(result.profile.password_hash, undefined);
  assert.equal(result.profile.role, "CUSTOMER");
  assert.equal(result.profile.createdAt, "2026-10-13T12:00:00.000Z");
});
test("customer migration rejects elevated roles and unsupported password formats", () => {
  assert.throws(
    () => legacyCustomer({ role: "ADMIN" }),
    /only imports existing customers/,
  );
  assert.throws(
    () => legacyCustomer({ role: "CUSTOMER", password_hash: "unknown" }),
    /Unsupported/,
  );
});
