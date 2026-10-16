import { test } from "node:test";
import assert from "node:assert/strict";
import { listenOptions, firebaseStartupMessage } from "./server-config.mjs";

test("hosting binds the assigned port on all interfaces while local development stays local", () => {
  assert.deepEqual(listenOptions({ PORT: "10000", FIREBASE_MARKETPLACE_PORT: "3003", RENDER: "true" }), { port: 10000, host: "0.0.0.0" });
  assert.deepEqual(listenOptions({}), { port: 3003, host: "127.0.0.1" });
  assert.throws(() => listenOptions({ PORT: "invalid" }), /PORT/);
});

test("Firebase credential errors explain Render secret files without printing private values", () => {
  const message = firebaseStartupMessage(new Error("ENOENT: private-CUSTOMER-SECRET.json"));
  assert.match(message, /\/etc\/secrets\/firebase-service-account.json/);
  assert.ok(!message.includes("CUSTOMER-SECRET"));
  assert.match(firebaseStartupMessage(new Error("Set FIREBASE_PROJECT_ID")), /FIREBASE_PROJECT_ID/);
});
