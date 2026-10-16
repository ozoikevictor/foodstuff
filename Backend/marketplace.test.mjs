import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, createHmac } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase } from "./database.mjs";
import { hashPassword } from "./auth.mjs";
import { createMarketplace } from "./server.mjs";

async function fixture(t, { payments = true, persistent = false } = {}) {
  const uploads = mkdtempSync(join(tmpdir(), "cribs-test-"));
  const databasePath = persistent ? join(uploads, 'auth-test.sqlite') : ':memory:';
  let db = openDatabase(databasePath);
  const origin = "http://localhost:8080";
  const references = new Map();
  const paymentStatuses = new Map();
  const fakeProvider = async (url, options) => {
    if (url.endsWith("/initialize")) {
      const p = JSON.parse(options.body);
      references.set(p.reference, p.amount);
      return Response.json({
        status: true,
        data: { authorization_url: "https://checkout.paystack.com/test-only" },
      });
    }
    const reference = url.split("/").at(-1);
    return Response.json({
      status: true,
      data: {
        reference,
        status: paymentStatuses.get(reference) || "success",
        currency: "NGN",
        amount: references.get(reference),
        id: reference,
      },
    });
  };
  let app = createMarketplace({
    db,
    origin,
    uploadsDir: uploads,
    paystackKey: payments ? "test-secret" : "",
    fetcher: fakeProvider,
  });
  await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
  let base = `http://127.0.0.1:${app.server.address().port}`;
  async function restart() {
    if (!persistent) throw new Error('Restart test requires a file-backed database.');
    app.server.closeAllConnections();
    await new Promise(r=>app.server.close(r));
    db.close();
    db = openDatabase(databasePath);
    app = createMarketplace({db,origin,uploadsDir:uploads,paystackKey:payments?'test-secret':'',fetcher:fakeProvider});
    await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
    base = `http://127.0.0.1:${app.server.address().port}`;
  }
  t.after(async () => {
    app.server.closeAllConnections();
    await new Promise((r) => app.server.close(r));
    db.close();
    rmSync(uploads, { recursive: true, force: true });
  });
  async function call(path, method = "GET", data, cookie = "", headers = {}) {
    const res = await fetch(base + "/api" + path, {
      method,
      headers: {
        Origin: origin,
        ...(cookie ? { Cookie: cookie } : {}),
        ...(data !== undefined ? { "Content-Type": "application/json" } : {}),
        ...headers,
      },
      ...(data !== undefined ? { body: JSON.stringify(data) } : {}),
    });
    return {
      status: res.status,
      data: await res.json(),
      cookie: res.headers.get("set-cookie")?.split(";")[0],
      setCookie: res.headers.get("set-cookie"),
    };
  }
  const userId = randomUUID();
  db.prepare("INSERT INTO users (id,email,name,phone,password_hash,role) VALUES (?,?,?,?,?,?)").run(
    userId,
    "owner@test.ng",
    "Owner",
    "08030000000",
    await hashPassword("longpassword123"),
    "ADMIN",
  );
  const admin = (
    await call("/auth/login", "POST", { email: "owner@test.ng", password: "longpassword123" })
  ).cookie;
  const customer = (
    await call("/auth/register", "POST", {
      email: "customer@test.ng",
      name: "Customer",
      phone: "08030000001",
      password: "longpassword123",
    })
  ).cookie;
  const other = (
    await call("/auth/register", "POST", {
      email: "other@test.ng",
      name: "Other",
      phone: "08030000002",
      password: "longpassword123",
    })
  ).cookie;
  const uploadId = randomUUID();
  db.prepare("INSERT INTO uploads (id,owner_id,mime,private) VALUES (?,?,?,0)").run(
    uploadId,
    userId,
    "image/png",
  );
  const image = "/api/images/" + uploadId;
  await call("/admin/categories", "POST", { slug: "grains", name: "Grains", image }, admin);
  const product = (
    await call(
      "/admin/products",
      "POST",
      {
        name: "Local rice",
        slug: "local-rice",
        categorySlug: "grains",
        description: "Real store inventory",
        images: [image],
        options: [
          { unit: "kg", label: "1 kg", price: 3200, stock: 5 },
          { unit: "bag", label: "50 kg bag", price: 140000, stock: 2 },
        ],
      },
      admin,
    )
  ).data;
  await call(
    "/admin/settings",
    "PUT",
    {
      zones: [{ name: "Lagos", fee: 1500 }],
      supportPhone: "08030000000",
      pickup: { address: "Market pickup", latitude: 6.6, longitude: 3.3 },
    },
    admin,
  );
  const checkout = (variantId = product.options[0].id, qty = 1, key = randomUUID()) =>
    call(
      "/orders",
      "POST",
      {
        items: [{ variantId, qty }],
        zone: "Lagos",
        address: "10 Sample Street Lagos",
        phone: "08030000001",
        latitude: 6.4,
        longitude: 3.4,
        idempotencyKey: key,
      },
      customer,
    );
  return { get db(){return db;}, call, admin, customer, other, product, checkout, references, paymentStatuses, base, origin, restart };
}
test("authentication, role separation, origin checks and private order ownership", async (t) => {
  const f = await fixture(t);
  assert.equal((await f.call("/admin/products", "GET", undefined, f.customer)).status, 403);
  assert.equal(
    (await f.call("/auth/login", "POST", { email: "owner@test.ng", password: "wrong" })).status,
    401,
  );
  assert.equal(
    (
      await f.call(
        "/auth/register",
        "POST",
        { email: "new@test.ng", name: "Name", phone: "08030000003", password: "longpassword123" },
        "",
        { Origin: "https://evil.example" },
      )
    ).status,
    403,
  );
  const order = (await f.checkout()).data;
  assert.equal((await f.call(`/orders/${order.id}`, "GET", undefined, f.other)).status, 404);
  assert.equal(
    (await f.call(`/payments/${order.payment.reference}/initialize`, "POST", {}, f.other)).status,
    404,
  );
  assert.equal(
    (
      await f.call("/auth/register", "POST", {
        email: "admin2@test.ng",
        name: "Name",
        phone: "08030000003",
        password: "longpassword123",
        role: "ADMIN",
      })
    ).data.role,
    "CUSTOMER",
  );
});

test('registered accounts and sessions persist through a database restart; logout revokes access',async t=>{
  const f=await fixture(t,{persistent:true});
  const registration=await f.call('/auth/register','POST',{email:'restart-test@example.invalid',name:'Restart Test',phone:'08000000000',password:'Temporary-Test-Password-123'});
  assert.equal(registration.status,200);
  assert.match(registration.setCookie,/HttpOnly/);
  assert.match(registration.setCookie,/SameSite=Lax/);
  assert.equal(registration.data.password_hash,undefined);
  const saved=f.db.prepare('SELECT password_hash,role FROM users WHERE id=?').get(registration.data.id);
  assert.notEqual(saved.password_hash,'Temporary-Test-Password-123');
  assert.match(saved.password_hash,/^[a-f0-9]{32}:[a-f0-9]{128}$/);
  assert.equal(saved.role,'CUSTOMER');
  assert.equal((await f.call('/auth/register','POST',{email:'restart-test@example.invalid',name:'Duplicate',phone:'08000000000',password:'Temporary-Test-Password-123'})).status,409);
  await f.restart();
  assert.equal((await f.call('/auth/me','GET',undefined,registration.cookie)).data.id,registration.data.id);
  assert.equal((await f.call('/auth/login','POST',{email:'restart-test@example.invalid',password:'Wrong-Password-123'})).status,401);
  const login=await f.call('/auth/login','POST',{email:'restart-test@example.invalid',password:'Temporary-Test-Password-123'});
  assert.equal(login.status,200);
  assert.equal((await f.call('/auth/me','GET',undefined,login.cookie)).data.id,registration.data.id);
  assert.equal((await f.call('/auth/logout','POST',{},login.cookie)).status,200);
  assert.equal((await f.call('/auth/me','GET',undefined,login.cookie)).data,null);
  assert.equal((await f.call('/orders','GET',undefined,login.cookie)).status,401);
});
test("catalogue persists, variants retain identity, recipes link exact quantities", async (t) => {
  const f = await fixture(t);
  assert.equal((await f.call("/products")).data[0].options[0].price, 3200);
  const p = {
    ...f.product,
    name: "Updated rice",
    options: f.product.options.map((v) => ({ ...v, price: v.price + 100 })),
  };
  assert.equal((await f.call(`/admin/products/${p.id}`, "PUT", p, f.admin)).status, 200);
  const publicProduct = (await f.call(`/products/${p.id}`)).data;
  assert.equal(publicProduct.name, "Updated rice");
  assert.equal(publicProduct.options[0].id, p.options[0].id);
  const image = f.product.images[0];
  assert.equal(
    (
      await f.call(
        "/admin/recipes",
        "POST",
        {
          slug: "rice",
          name: "Rice recipe",
          image,
          description: "Cook rice",
          prepTime: "5 min",
          cookingTime: "20 min",
          serves: 2,
          difficulty: "Easy",
          category: "Rice",
          steps: ["Boil rice"],
          published: true,
          ingredients: [{ variantId: p.options[0].id, qty: 2 }],
        },
        f.admin,
      )
    ).status,
    200,
  );
  const recipe = (await f.call("/recipes/rice")).data;
  assert.equal(recipe.ingredients[0].variantId, p.options[0].id);
  assert.equal(recipe.ingredients[0].qty, 2);
});
test("atomic reservations prevent overselling, duplicate orders and double restoration", async (t) => {
  const f = await fixture(t);
  const key = randomUUID();
  const one = await f.checkout(f.product.options[0].id, 4, key);
  assert.equal(one.status, 201);
  const repeat = await f.checkout(f.product.options[0].id, 4, key);
  assert.equal(repeat.data.id, one.data.id);
  assert.equal((await f.checkout(f.product.options[0].id, 2)).status, 409);
  assert.equal(
    f.db.prepare("SELECT stock FROM variants WHERE id=?").get(f.product.options[0].id).stock,
    1,
  );
  assert.equal((await f.call(`/orders/${one.data.id}/cancel`, "POST", {}, f.customer)).status, 200);
  assert.equal((await f.call(`/orders/${one.data.id}/cancel`, "POST", {}, f.customer)).status, 409);
  assert.equal(
    f.db.prepare("SELECT stock FROM variants WHERE id=?").get(f.product.options[0].id).stock,
    5,
  );
});
test("only verified payments advance orders, replay is idempotent and amount mismatches fail", async (t) => {
  const f = await fixture(t);
  const o = (await f.checkout()).data;
  const path = `/payments/${o.payment.reference}`;
  assert.equal(
    (await f.call(`/orders/${o.id}/status`, "POST", { status: "Order Confirmed" }, f.admin)).status,
    409,
  );
  await f.call(path + "/initialize", "POST", {}, f.customer);
  f.references.set(o.payment.reference, 1);
  assert.equal((await f.call(path + "/verify", "POST", {}, f.customer)).status, 409);
  f.references.set(o.payment.reference, o.total * 100);
  assert.equal((await f.call(path + "/verify", "POST", {}, f.customer)).data.status, "paid");
  await f.call(path + "/verify", "POST", {}, f.customer);
  assert.equal(
    f.db
      .prepare(
        "SELECT COUNT(*) n FROM tracking_events WHERE order_id=? AND status='Payment Confirmed'",
      )
      .get(o.id).n,
    1,
  );
  const payload = { event: "charge.success", data: { reference: o.payment.reference } };
  assert.equal(
    (
      await f.call("/payments/webhook", "POST", payload, "", {
        "x-paystack-signature": "0".repeat(128),
      })
    ).status,
    401,
  );
  const signature = createHmac("sha512", "test-secret")
    .update(JSON.stringify(payload))
    .digest("hex");
  assert.equal(
    (await f.call("/payments/webhook", "POST", payload, "", { "x-paystack-signature": signature }))
      .status,
    200,
  );
});
test("late payment after cancellation is flagged for refund instead of fulfilling released stock", async (t) => {
  const f = await fixture(t);
  const o = (await f.checkout()).data;
  const path = `/payments/${o.payment.reference}`;
  await f.call(path + "/initialize", "POST", {}, f.customer);
  await f.call(`/orders/${o.id}/cancel`, "POST", {}, f.customer);
  assert.equal(
    (await f.call(path + "/verify", "POST", {}, f.customer)).data.status,
    "refund_required",
  );
  assert.equal(
    (await f.call(`/orders/${o.id}`, "GET", undefined, f.customer)).data.status,
    "Cancelled",
  );
});
test("assigned rider location is private and delivery requires customer confirmation", async (t) => {
  const f = await fixture(t);
  const o = (await f.checkout()).data;
  const orderPath = `/orders/${o.id}`;
  await f.call(`/payments/${o.payment.reference}/initialize`, "POST", {}, f.customer);
  await f.call(`/payments/${o.payment.reference}/verify`, "POST", {}, f.customer);
  for (const status of ["Order Confirmed", "Preparing Your Order", "Ready for Dispatch"])
    assert.equal((await f.call(orderPath + "/status", "POST", { status }, f.admin)).status, 200);
  const rider = (
    await f.call(
      "/admin/riders",
      "POST",
      { email: "rider@test.ng", name: "Rider", phone: "08030000003", password: "longpassword123" },
      f.admin,
    )
  ).data;
  const cookie = (
    await f.call("/auth/login", "POST", { email: "rider@test.ng", password: "longpassword123" })
  ).cookie;
  assert.equal(
    (await f.call(orderPath + "/assign", "POST", { riderId: rider.id }, f.admin)).status,
    200,
  );
  assert.equal(
    (await f.call(orderPath + "/rider", "POST", { action: "start" }, cookie)).status,
    409,
  );
  for (const action of ["accept", "pickup", "start"])
    assert.equal((await f.call(orderPath + "/rider", "POST", { action }, cookie)).status, 200);
  assert.equal(
    (
      await f.call(
        orderPath + "/location",
        "POST",
        { latitude: 6.5, longitude: 3.4, accuracy: 10 },
        cookie,
      )
    ).status,
    200,
  );
  assert.equal((await f.call(orderPath, "GET", undefined, f.other)).status, 404);
  assert.equal((await f.call(orderPath, "GET", undefined, f.customer)).data.rider.phone, null);
  assert.equal((await f.call(orderPath, "GET", undefined, f.customer)).data.location.latitude, 6.5);
  assert.equal(
    (
      await f.call(
        orderPath + "/rider",
        "POST",
        { action: "deliver", notes: "Handed to customer at the gate" },
        cookie,
      )
    ).data.status,
    "Rider Marked Delivered",
  );
  assert.equal((await f.call(orderPath, "GET", undefined, f.customer)).data.location, null);
  assert.equal((await f.call(orderPath + "/confirm", "POST", {}, cookie)).status, 409);
  assert.equal(
    (await f.call(orderPath + "/confirm", "POST", {}, f.customer)).data.status,
    "Completed",
  );
  assert.equal(
    (
      await f.call(
        orderPath + "/location",
        "POST",
        { latitude: 6.5, longitude: 3.4, accuracy: 10 },
        cookie,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await f.call(
        orderPath + "/review",
        "POST",
        {
          speed: 5,
          professionalism: 4,
          freshness: 5,
          quality: 5,
          overall: 5,
          comment: "Fresh food",
        },
        f.customer,
      )
    ).status,
    200,
  );
});
test("missing payment credentials cannot create pretend orders", async (t) => {
  const f = await fixture(t, { payments: false });
  assert.equal((await f.checkout()).status, 503);
  assert.equal(f.db.prepare("SELECT COUNT(*) n FROM orders").get().n, 0);
});

test('verified failed payments restore stock exactly once and notify administrators', async t=>{
  const f=await fixture(t);const o=(await f.checkout()).data;const path=`/payments/${o.payment.reference}`;
  await f.call(path+'/initialize','POST',{},f.customer);f.paymentStatuses.set(o.payment.reference,'failed');
  assert.equal((await f.call(path+'/verify','POST',{},f.customer)).data.status,'failed');
  await f.call(path+'/verify','POST',{},f.customer);
  assert.equal(f.db.prepare('SELECT stock FROM variants WHERE id=?').get(f.product.options[0].id).stock,5);
  assert.equal((await f.call(`/orders/${o.id}`,'GET',undefined,f.customer)).data.payment_status,'failed');
  assert.ok((await f.call('/notifications','GET',undefined,f.admin)).data.some(n=>n.message.includes('Payment failed')));
});

test('disputes require an audited administrator resolution, not implicit customer confirmation', async t=>{
  const f=await fixture(t);const o=(await f.checkout()).data;const path=`/orders/${o.id}`;
  f.db.prepare("UPDATE orders SET status='Rider Marked Delivered' WHERE id=?").run(o.id);
  assert.equal((await f.call(path+'/dispute','POST',{reason:'My order was not received at my address.'},f.customer)).data.status,'Disputed');
  assert.equal((await f.call(path+'/resolve','POST',{resolution:'Investigated evidence and completed the case.',outcome:'Completed'},f.customer)).status,403);
  const resolved=await f.call(path+'/resolve','POST',{resolution:'Customer receipt verified by support, resolution documented.',outcome:'Completed'},f.admin);
  assert.equal(resolved.data.status,'Completed');assert.equal(resolved.data.dispute.status,'resolved');
  assert.ok(resolved.data.confirmations.some(c=>c.kind==='ADMIN_RESOLUTION'));
  assert.ok(!resolved.data.confirmations.some(c=>c.kind==='CUSTOMER'));
  assert.equal(f.db.prepare("SELECT COUNT(*) n FROM audit_log WHERE action='dispute.resolve' AND entity_id=?").get(o.id).n,1);
});

test('image uploads reject executable content and customer uploads; private evidence is restricted',async t=>{
  const f=await fixture(t);
  const upload=async(cookie,type,bytes)=>fetch(f.base+'/api/images',{method:'POST',headers:{Origin:f.origin,Cookie:cookie,'Content-Type':type},body:bytes});
  assert.equal((await upload(f.customer,'image/png',Buffer.from('<svg/>'))).status,403);
  assert.equal((await upload(f.admin,'image/svg+xml',Buffer.from('<svg/>'))).status,400);
  const rider=(await f.call('/admin/riders','POST',{email:'proof@test.ng',name:'Rider',phone:'08030000009',password:'longpassword123'},f.admin)).data;
  const cookie=(await f.call('/auth/login','POST',{email:rider.email,password:'longpassword123'})).cookie;
  const bytes=Buffer.from([137,80,78,71,13,10,26,10,0]);const res=await upload(cookie,'image/png',bytes);assert.equal(res.status,201);const image=(await res.json()).url;
  assert.equal((await fetch(f.base+image,{headers:{Cookie:f.customer}})).status,403);
  assert.equal((await fetch(f.base+image,{headers:{Cookie:f.admin}})).status,200);
});
