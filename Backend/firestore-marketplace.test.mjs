import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import * as schemas from "./firestore-schemas.mjs";
import {
  paystackProvider,
  createFirebaseMarketplace,
} from "./firebase-marketplace-server.mjs";

test("recipes accept measured ingredients without inventing saleable products", () => {
  const recipe = {slug:"rice",name:"Rice",image:`/api/images/${randomUUID()}`,description:"Rice meal",prepTime:"10 minutes",cookingTime:"30 minutes",serves:4,difficulty:"Easy",category:"Rice",steps:["Cook rice."],published:true,ingredients:[],ingredientNotes:["2 cups rice"]};
  assert.equal(schemas.recipe.parse(recipe).ingredients.length,0);
  assert.throws(() => schemas.recipe.parse({...recipe,ingredientNotes:[]}));
  assert.throws(() => schemas.recipe.parse({...recipe,sources:[{title:"Unsafe",url:"javascript:alert(1)"}]}));
  assert.throws(() => schemas.recipe.parse({...recipe,ingredients:[{variantId:"invalid",qty:1}]}));
});

test("Firestore commerce validates kobo precision, variations, location bounds, and identifiers", () => {
  const value = { unit: "kg", label: "1 kg", price: 1200.5, stock: 5 };
  assert.equal(schemas.variant.parse(value).price, 1200.5);
  assert.throws(() => schemas.variant.parse({ ...value, price: 1200.001 }));
  assert.throws(() => schemas.variant.parse({ ...value, stock: -1 }));
  assert.throws(() => schemas.identifier.parse("../users"));
  assert.throws(() => schemas.coords.latitude.parse(91));
  assert.throws(() =>
    schemas.checkout.parse({ items: [{ variantId: randomUUID(), qty: 0 }] }),
  );
});
test("unconfigured Paystack remains unavailable and hosted checkout URLs are validated", async () => {
  assert.equal(
    paystackProvider({ key: "", origin: "https://shop.example" }),
    null,
  );
  let seen;
  const payments = paystackProvider({
    key: "test-secret",
    origin: "https://shop.example",
    fetcher: async (url, options) => {
      seen = { url, options };
      return Response.json({
        status: true,
        data: { authorization_url: "https://evil.example/checkout" },
      });
    },
  });
  await assert.rejects(
    payments.initialize({
      email: "test@example.invalid",
      amount: 12345,
      reference: "test-reference",
    }),
    (e) => e.status === 502,
  );
  assert.equal(seen.options.headers.Authorization, "Bearer test-secret");
  assert.equal(JSON.parse(seen.options.body).currency, "NGN");
});
test("Firebase marketplace rejects unauthenticated admin access, forged origins, and unsigned webhooks", async (t) => {
  const api = createFirebaseMarketplace({
    db: {},
    root: {},
    authService: {
      async session() {
        return null;
      },
    },
    paystackKey: "test-only",
    origin: "https://shop.example",
  });
  const { server } = api;
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(base + "/api/admin/products")).status, 401);
  assert.equal(
    (
      await fetch(base + "/api/orders", {
        method: "POST",
        headers: { Origin: "https://evil.example" },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await fetch(base + "/api/payments/webhook", {
        method: "POST",
        body: "{}",
      })
    ).status,
    401,
  );
  const health = await (await fetch(base + "/api/health")).json();
  assert.equal(health.database, "firestore");
});
