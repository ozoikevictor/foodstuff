import assert from "node:assert/strict";
import { randomUUID, createHmac } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { deleteApp } from "firebase-admin/app";
import { firebaseServices } from "../firebase.mjs";
import { createFirebaseMarketplace } from "../firebase-marketplace-server.mjs";

if (!process.argv.includes("--allow-isolated-test-data")) {
  console.error(
    "This real Firestore test creates isolated fixtures under _backend_validation. Re-run with --allow-isolated-test-data after approval.",
  );
  process.exit(1);
}
const tempParent = resolve(tmpdir());
const uploadsDir = mkdtempSync(join(tempParent, "firestore-marketplace-test-"));
const runId = `marketplace-${randomUUID()}`;
let app, db, root, server;
let checks = 0;
const pass = (message) => {
  checks++;
  console.log(`PASS: ${message}`);
};
try {
  ({ app, db } = firebaseServices());
  root = db.collection("_backend_validation").doc(runId);
  await root.create({
    kind: "marketplace-integration-test",
    createdAt: new Date().toISOString(),
  });
  const roles = {
    admin: {
      id: randomUUID(),
      name: "Isolated Admin Fixture",
      email: "admin-fixture@example.invalid",
      phone: "08000000000",
      role: "ADMIN",
    },
    customer: {
      id: randomUUID(),
      name: "Isolated Customer Fixture",
      email: "customer-fixture@example.invalid",
      phone: "08000000000",
      role: "CUSTOMER",
    },
    other: {
      id: randomUUID(),
      name: "Other Fixture",
      email: "other-fixture@example.invalid",
      phone: "08000000000",
      role: "CUSTOMER",
    },
    rider: {
      id: randomUUID(),
      name: "Isolated Rider Fixture",
      email: "rider-fixture@example.invalid",
      phone: "08000000000",
      role: "RIDER",
    },
  };
  for (const u of Object.values(roles))
    await root
      .collection("users")
      .doc(u.id)
      .create({
        ...u,
        createdAt: new Date().toISOString(),
        contactConsent: false,
      });
  const tokens = Object.fromEntries(
    Object.keys(roles).map((role) => [role, randomUUID()]),
  );
  const authService = {
    async session(cookie = "") {
      return (
        roles[
          Object.keys(tokens).find(
            (role) => cookie === `test_session=${tokens[role]}`,
          )
        ] || null
      );
    },
  };
  const verified = new Map();
  const paymentProvider = {
    async initialize(data) {
      verified.set(data.reference, {
        id: randomUUID(),
        reference: data.reference,
        currency: "NGN",
        amount: data.amount,
        status: "success",
      });
      return { url: "https://checkout.paystack.com/test-only" };
    },
    async verify(reference) {
      return verified.get(reference);
    },
  };
  let now = Date.now();
  const origin = "http://localhost:8080";
  const api = createFirebaseMarketplace({
    db,
    root,
    authService,
    paystackKey: "isolated-webhook-test-key",
    payments: paymentProvider,
    origin,
    uploadsDir,
    clock: () => now,
  });
  server = api.server;
  const market = api.market;
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (
    path,
    method = "GET",
    data,
    role = "customer",
    headers = {},
  ) => {
    const res = await fetch(base + "/api" + path, {
      method,
      headers: {
        Origin: origin,
        Cookie: `test_session=${tokens[role] || "none"}`,
        "Content-Type": "application/json",
        ...headers,
      },
      ...(data === undefined ? {} : { body: JSON.stringify(data) }),
      signal: AbortSignal.timeout(25000),
    });
    return { status: res.status, data: await res.json() };
  };
  assert.equal((await call("/admin/products", "GET")).status, 403);
  assert.equal(
    (
      await call("/cart", "PUT", [], "customer", {
        Origin: "https://evil.example",
      })
    ).status,
    403,
  );
  pass("API role and origin checks protect Firestore routes");
  const upload = await fetch(base + "/api/images", {
    method: "POST",
    headers: {
      Origin: origin,
      Cookie: `test_session=${tokens.admin}`,
      "Content-Type": "image/png",
    },
    body: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]),
    signal: AbortSignal.timeout(25000),
  });
  assert.equal(upload.status, 201);
  const image = (await upload.json()).url;
  const config = {
    zones: [{ name: "Isolated Test Zone", fee: 100 }],
    supportPhone: "08000000000",
    pickup: { address: "Isolated test pickup", latitude: 6.5, longitude: 3.4 },
  };
  assert.equal(
    (await call("/admin/settings", "PUT", config, "admin")).status,
    200,
  );
  assert.equal(
    (
      await call(
        "/admin/categories",
        "POST",
        { slug: "test-grains", name: "Isolated grains", image },
        "admin",
      )
    ).status,
    200,
  );
  const draft = {
    name: "Isolated Test Rice",
    slug: "isolated-test-rice",
    categorySlug: "test-grains",
    description: "Integration fixture only; never a live storefront product.",
    images: [image],
    tags: ["deal"],
    options: [
      { unit: "kg", label: "1 kg", price: 1000.5, stock: 5, lowStock: 1 },
      { unit: "bag", label: "5 kg bag", price: 4500, stock: 2, lowStock: 1 },
    ],
  };
  const saved = await call("/admin/products", "POST", draft, "admin");
  assert.equal(saved.status, 200, saved.data.error);
  let product = saved.data;
  const v = product.options[0];
  assert.equal(
    (await call(`/products/${product.id}`)).data.options[0].price,
    1000.5,
  );
  product = (
    await call(
      `/admin/products/${product.id}`,
      "PUT",
      { ...draft, name: "Updated isolated rice", options: product.options },
      "admin",
    )
  ).data;
  assert.equal(product.options[0].id, v.id);
  assert.equal(
    (await call("/admin/categories/test-grains", "DELETE", undefined, "admin"))
      .status,
    409,
  );
  pass(
    "Image metadata, category references, exact-money prices, and stable product variations persist in Firestore",
  );
  const recipe = {
    slug: "isolated-recipe",
    name: "Isolated recipe",
    image,
    description: "Test only",
    prepTime: "5 min",
    cookingTime: "15 min",
    serves: 2,
    difficulty: "Easy",
    category: "Test",
    steps: ["Test cooking step"],
    published: true,
    ingredients: [
      { variantId: product.options[1].id, qty: 2, note: "Exact bag variation" },
    ],
  };
  assert.equal(
    (await call("/admin/recipes", "POST", recipe, "admin")).status,
    200,
  );
  assert.equal(
    (await call("/recipes/isolated-recipe")).data.ingredients[0].variantId,
    product.options[1].id,
  );
  assert.equal(
    (await call("/cart", "PUT", [{ variantId: v.id, qty: 2 }])).status,
    200,
  );
  assert.equal((await call("/cart")).data[0].qty, 2);
  pass("Recipes link exact variants, and customer baskets persist");
  const input = (qty = 1, key = randomUUID()) => ({
    items: [{ variantId: v.id, qty }],
    zone: "Isolated Test Zone",
    address: "Isolated Test Address, not a real delivery",
    phone: "08000000000",
    latitude: 6.4,
    longitude: 3.3,
    idempotencyKey: key,
  });
  const keys = [randomUUID(), randomUUID()];
  const race = await Promise.allSettled(
    keys.map((key) => market.checkout(roles.customer, input(4, key))),
  );
  assert.equal(race.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(
    race.filter((r) => r.status === "rejected" && r.reason.status === 409)
      .length,
    1,
  );
  const winner = race.find((r) => r.status === "fulfilled").value;
  assert.equal((await market.get("variants", v.id)).stock, 1);
  const replay = await market.checkout(
    roles.customer,
    input(4, keys[race.findIndex((r) => r.status === "fulfilled")]),
  );
  assert.equal(replay.id, winner.id);
  assert.equal(
    (await call(`/orders/${winner.id}`, "GET", undefined, "other")).status,
    404,
  );
  await market.orderAction(roles.customer, winner.id, "cancel");
  assert.equal((await market.get("variants", v.id)).stock, 5);
  await assert.rejects(
    market.orderAction(roles.customer, winner.id, "cancel"),
    (e) => e.status === 409,
  );
  pass(
    "Concurrent Firestore checkout prevents overselling, private order reads, duplicate reservation, and double restoration",
  );
  const order = (await call("/orders", "POST", input(2))).data;
  assert.ok(order.id);
  assert.equal(
    (
      await call(
        `/orders/${order.id}/status`,
        "POST",
        { status: "Order Confirmed" },
        "admin",
      )
    ).status,
    409,
  );
  assert.equal(
    (await call(`/payments/${order.payment.reference}/initialize`, "POST", {}))
      .status,
    200,
  );
  const correct = verified.get(order.payment.reference);
  verified.set(order.payment.reference, { ...correct, amount: 1 });
  assert.equal(
    (await call(`/payments/${order.payment.reference}/verify`, "POST", {}))
      .status,
    409,
  );
  verified.set(order.payment.reference, correct);
  assert.equal(
    (await call(`/payments/${order.payment.reference}/verify`, "POST", {})).data
      .status,
    "paid",
  );
  await call(`/payments/${order.payment.reference}/verify`, "POST", {});
  assert.equal(
    (await market.get("orders", order.id)).events.filter(
      (e) => e.status === "Payment Confirmed",
    ).length,
    1,
  );
  const payload = {
    event: "charge.success",
    data: { reference: order.payment.reference },
  };
  const signature = createHmac("sha512", "isolated-webhook-test-key")
    .update(JSON.stringify(payload))
    .digest("hex");
  assert.equal(
    (
      await call("/payments/webhook", "POST", payload, "customer", {
        "x-paystack-signature": "0".repeat(128),
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await call("/payments/webhook", "POST", payload, "customer", {
        "x-paystack-signature": signature,
      })
    ).status,
    200,
  );
  pass(
    "Verified-amount checks, payment replay, and signed webhook handling work with real Firestore transactions (test-only payment provider)",
  );
  for (const status of [
    "Order Confirmed",
    "Preparing Your Order",
    "Ready for Dispatch",
  ])
    assert.equal(
      (await call(`/orders/${order.id}/status`, "POST", { status }, "admin"))
        .status,
      200,
    );
  assert.equal(
    (
      await call(
        `/orders/${order.id}/assign`,
        "POST",
        { riderId: roles.rider.id },
        "admin",
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await call(
        `/orders/${order.id}/rider`,
        "POST",
        { action: "start" },
        "rider",
      )
    ).status,
    409,
  );
  for (const action of ["accept", "pickup", "start"])
    assert.equal(
      (await call(`/orders/${order.id}/rider`, "POST", { action }, "rider"))
        .status,
      200,
    );
  assert.equal(
    (
      await call(
        `/orders/${order.id}/location`,
        "POST",
        { latitude: 6.45, longitude: 3.35, accuracy: 10 },
        "rider",
      )
    ).status,
    200,
  );
  let details = (await call(`/orders/${order.id}`)).data;
  assert.equal(details.location.latitude, 6.45);
  assert.equal(details.rider.phone, null);
  await root
    .collection("users")
    .doc(roles.rider.id)
    .update({ contactConsent: true });
  assert.equal(
    (await call(`/orders/${order.id}`)).data.rider.phone,
    "08000000000",
  );
  const proof = await fetch(base + "/api/images", {
    method: "POST",
    headers: {
      Origin: origin,
      Cookie: `test_session=${tokens.rider}`,
      "Content-Type": "image/png",
    },
    body: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]),
  });
  assert.equal(proof.status, 201);
  const photo = (await proof.json()).url;
  assert.equal(
    (
      await fetch(base + photo, {
        headers: { Cookie: `test_session=${tokens.customer}` },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await call(
        `/orders/${order.id}/rider`,
        "POST",
        { action: "deliver", notes: "Test-only handover evidence", photo },
        "rider",
      )
    ).data.status,
    "Rider Marked Delivered",
  );
  details = (await call(`/orders/${order.id}`)).data;
  assert.equal(details.location, null);
  assert.equal(details.evidence, null);
  assert.ok(!details.confirmations.some((c) => c.kind === "CUSTOMER"));
  assert.equal(
    (await call(`/orders/${order.id}/confirm`, "POST", {}, "rider")).status,
    409,
  );
  assert.equal(
    (await call(`/orders/${order.id}/confirm`, "POST", {})).data.status,
    "Completed",
  );
  assert.equal(
    (
      await call(
        `/orders/${order.id}/location`,
        "POST",
        { latitude: 6.45, longitude: 3.35, accuracy: 10 },
        "rider",
      )
    ).status,
    403,
  );
  pass(
    "Rider assignment, consent, location/evidence privacy, status history, and separate customer delivery confirmation persist",
  );
  const review = {
    speed: 5,
    professionalism: 4,
    freshness: 5,
    quality: 5,
    overall: 5,
    comment: "Isolated test review",
  };
  assert.equal(
    (await call(`/orders/${order.id}/review`, "POST", review)).status,
    200,
  );
  assert.equal(
    (await call(`/orders/${order.id}/review`, "POST", review)).status,
    409,
  );
  assert.equal(
    (
      await call(`/orders/${order.id}/dispute`, "POST", {
        reason: "Isolated test problem for dispute verification.",
      })
    ).data.status,
    "Disputed",
  );
  assert.equal(
    (
      await call(
        `/orders/${order.id}/resolve`,
        "POST",
        {
          resolution: "Test evidence reviewed and dispute resolved.",
          outcome: "Returned",
        },
        "customer",
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await call(
        `/orders/${order.id}/resolve`,
        "POST",
        {
          resolution: "Test evidence reviewed and dispute resolved.",
          outcome: "Returned",
        },
        "admin",
      )
    ).data.status,
    "Returned",
  );
  const overview = (await call("/admin/overview", "GET", undefined, "admin"))
    .data;
  assert.equal(overview.products, 1);
  assert.equal(overview.customers, 2);
  assert.ok(overview.revenue > 0);
  assert.equal(
    (await call("/admin/reviews", "GET", undefined, "admin")).data.length,
    1,
  );
  pass(
    "Reviews, disputes, audited resolution, inventory, and admin analytics are backed by Firestore",
  );
  const failed = await market.checkout(roles.customer, input(1));
  await market.initializePayment(roles.customer, failed.payment.reference);
  verified.set(failed.payment.reference, {
    ...verified.get(failed.payment.reference),
    status: "failed",
  });
  await market.verifyPayment(failed.payment.reference);
  const stockAfterFailure = (await market.get("variants", v.id)).stock;
  await market.verifyPayment(failed.payment.reference);
  assert.equal((await market.get("variants", v.id)).stock, stockAfterFailure);
  const late = await market.checkout(roles.customer, input(1));
  await market.initializePayment(roles.customer, late.payment.reference);
  now += 31 * 60000;
  await market.expireReservations();
  assert.equal(
    (await market.verifyPayment(late.payment.reference)).status,
    "refund_required",
  );
  pass(
    "Failed payments and expiry restore stock once; late verified payments are flagged for refund",
  );
  const notifications = (await call("/notifications")).data;
  assert.ok(notifications.length > 0);
  assert.equal(
    (await call(`/notifications/${notifications[0].id}`, "PATCH", {}, "other"))
      .status,
    404,
  );
  assert.equal(
    (await call(`/notifications/${notifications[0].id}`, "PATCH", {})).status,
    200,
  );
  await call("/notifications", "DELETE");
  assert.ok(
    !(await call("/notifications")).data.some(
      (n) => n.id === notifications[0].id,
    ),
  );
  const controller = new AbortController();
  const events = await fetch(base + "/api/events", {
    headers: { Cookie: `test_session=${tokens.customer}` },
    signal: controller.signal,
  });
  assert.equal(events.status, 200);
  assert.match(events.headers.get("content-type"), /text\/event-stream/);
  const reader = events.body.getReader();
  const chunk = await reader.read();
  assert.match(new TextDecoder().decode(chunk.value), /event: change/);
  controller.abort();
  await reader.cancel().catch(() => {});
  pass(
    "Private notifications and the Firestore-backed event-stream endpoint work",
  );
  const staleLocation=randomUUID();
  await market.ref('delivery_locations',staleLocation).create({id:staleLocation,order_id:order.id,rider_id:roles.rider.id,latitude:6.4,longitude:3.3,accuracy:10,created_at:new Date(now-8*86400000).toISOString()});
  await market.cleanupLocations();
  assert.equal(await market.get('delivery_locations',staleLocation),null);
  pass('Old location history is removed for completed/cancelled/returned deliveries');
  console.log(
    `PASS: ${checks} live Firestore integration groups. Fixtures were isolated; no real admin, rider, customer identity, or storefront product was created.`,
  );
} catch (error) {
  console.error(
    error.code === "ERR_ASSERTION"
      ? error.message
      : `Firestore validation failed: ${error.status ? error.message : "check Firebase access and backend diagnostics."}`,
  );
  process.exitCode = 1;
} finally {
  if (server) {
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
  }
  if (root) {
    try {
      if (
        root.parent.id !== "_backend_validation" ||
        !root.id.startsWith("marketplace-")
      )
        throw new Error("Unsafe test namespace");
      await db.recursiveDelete(root);
      assert.equal((await root.get()).exists, false);
      console.log("PASS: Isolated Firestore test namespace removed.");
    } catch {
      console.error(`CLEANUP REQUIRED: _backend_validation/${runId}`);
      process.exitCode = 1;
    }
  }
  if (
    dirname(resolve(uploadsDir)) === tempParent &&
    uploadsDir.startsWith(join(tempParent, "firestore-marketplace-test-"))
  )
    rmSync(uploadsDir, { recursive: true, force: true });
  await db?.terminate().catch(() => {});
  if (app) await deleteApp(app).catch(() => {});
}
