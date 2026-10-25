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

test("origin checks normalize configuration and allow only explicitly trusted sites", async () => {
  const { isAllowedOrigin } = await import('./server-config.mjs');
  assert.equal(isAllowedOrigin('https://foodstuff-zeta.vercel.app', ' https://foodstuff-zeta.vercel.app/ ', {}), true);
  assert.equal(isAllowedOrigin('https://shop.example', 'http://localhost:8080', { APP_ORIGINS: 'https://shop.example/, https://other.example' }), true);
  for (const origin of [undefined, 'null', 'https://evil.example', 'https://shop.example.evil.test', 'https://shop.example/path']) {
    assert.equal(isAllowedOrigin(origin, 'https://shop.example', {}), false);
  }
  assert.equal(isAllowedOrigin('http://localhost:8080', 'https://shop.example', {}), false);
});
