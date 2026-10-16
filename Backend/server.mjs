import { createServer } from "node:http";
import { randomBytes, createHmac, timingSafeEqual } from "node:crypto";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { z } from "zod";
import { openDatabase, id, transaction } from "./database.mjs";
import {
  hashPassword,
  checkPassword,
  createSession,
  sessionUser,
  publicUser,
  hashToken,
} from "./auth.mjs";

const text = z.string().trim().min(1).max(500);
const money = z.number().finite().positive().max(100000000).refine(v=>Math.abs(v*100-Math.round(v*100))<0.00001,'Use at most two decimal places.');
const coords = { latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180) };
const image = z.string().regex(/^\/api\/images\/[a-f0-9-]+$/);
const unit = z.enum([
  "kg",
  "g",
  "piece",
  "basket",
  "cup",
  "derica",
  "litre",
  "carton",
  "bag",
  "paint",
  "tuber",
  "bottle",
]);
const variantSchema = z.object({
  id: z.string().uuid().optional(),
  unit,
  label: text,
  price: money,
  originalPrice: money.nullable().optional(),
  stock: z.number().int().min(0).max(1000000),
  lowStock: z.number().int().min(0).default(5),
  active: z.boolean().default(true),
});
const productSchema = z.object({
  name: text,
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .max(150),
  categorySlug: text,
  description: z.string().trim().min(1).max(10000),
  images: z.array(image).min(1).max(8),
  available: z.boolean().default(true),
  featured: z.boolean().default(false),
  tags: z.array(z.enum(["deal", "popular", "recommended", "wholesale", "essential"])).default([]),
  options: z.array(variantSchema).min(1).max(30),
});
const categorySchema = z.object({
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .max(150),
  name: text,
  image,
  blurb: z.string().max(500).default(""),
  parentSlug: z.string().nullable().default(null),
});
const recipeSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  name: text,
  image,
  description: text,
  prepTime: text,
  cookingTime: text,
  serves: z.number().int().min(1).max(1000),
  difficulty: z.enum(["Easy", "Medium", "Hard"]),
  category: text,
  video: z
    .string()
    .url()
    .refine((v) => v.startsWith("https://"))
    .or(z.literal(""))
    .default(""),
  steps: z.array(text).min(1).max(50),
  published: z.boolean(),
  ingredients: z
    .array(
      z.object({
        variantId: z.string().uuid(),
        qty: z.number().int().min(1).max(1000),
        note: z.string().max(500).default(""),
      }),
    )
    .min(1)
    .max(100),
});
const workflow = [
  "Order Placed",
  "Payment Confirmed",
  "Order Confirmed",
  "Preparing Your Order",
  "Ready for Dispatch",
  "Rider Assigned",
  "Out for Delivery",
  "Arriving Soon",
  "Rider Marked Delivered",
  "Customer Confirmed Received",
  "Completed",
];
const inactive = ["Completed", "Cancelled", "Delivery Failed", "Returned", "Disputed"];
const liveStatuses = ["Out for Delivery", "Arriving Soon"];
function fail(status, message) {
  throw Object.assign(new Error(message), { status });
}
const json = (res, status, value) => {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(JSON.stringify(value));
};
async function rawBody(req, limit = 6000000) {
  const chunks = [];
  let length = 0;
  for await (const chunk of req) {
    length += chunk.length;
    if (length > limit) fail(413, "Request too large.");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
async function body(req) {
  if (!req.headers["content-type"]?.startsWith("application/json")) fail(415, "JSON required.");
  try {
    return JSON.parse((await rawBody(req, 1000000)).toString());
  } catch (e) {
    if (e.status) throw e;
    fail(400, "Invalid JSON.");
  }
}

export function createMarketplace({
  db = openDatabase(),
  origin = process.env.APP_ORIGIN || "http://localhost:8080",
  paystackKey = process.env.PAYSTACK_SECRET_KEY || "",
  fetcher = fetch,
  uploadsDir = process.env.UPLOADS_PATH || fileURLToPath(new URL("./data/uploads", import.meta.url)),
} = {}) {
  const streams = new Map();
  const attempts = new Map();
  const get = (sql, ...args) => db.prepare(sql).get(...args);
  const all = (sql, ...args) => db.prepare(sql).all(...args);
  const run = (sql, ...args) => db.prepare(sql).run(...args);
  const audit = (user, action, entity) =>
    run(
      "INSERT INTO audit_log (id,actor_id,action,entity_id) VALUES (?,?,?,?)",
      id(),
      user.id,
      action,
      entity,
    );
  function push(userId) {
    for (const res of streams.get(userId) || []) res.write("event: change\ndata: {}\n\n");
  }
  function notify(userId, message, orderId = null) {
    run(
      "INSERT INTO notifications (id,user_id,order_id,message) VALUES (?,?,?,?)",
      id(),
      userId,
      orderId,
      message,
    );
    push(userId);
  }
  function admins(message, orderId = null) {
    all("SELECT id FROM users WHERE role='ADMIN'").forEach((u) => notify(u.id, message, orderId));
  }
  function changed() {
    for (const userId of streams.keys()) push(userId);
  }
  function requireUser(req, roles) {
    const u = sessionUser(db, req);
    if (!u) fail(401, "Please log in.");
    if (roles && !roles.includes(u.role)) fail(403, "You do not have permission.");
    return u;
  }
  function ownedOrder(orderId, u) {
    const o = get("SELECT * FROM orders WHERE id=?", orderId);
    if (!o) fail(404, "Order not found.");
    if (
      u.role !== "ADMIN" &&
      o.user_id !== u.id &&
      !(
        u.role === "RIDER" &&
        get("SELECT 1 FROM delivery_assignments WHERE order_id=? AND rider_id=?", o.id, u.id)
      )
    )
      fail(404, "Order not found.");
    return o;
  }
  function product(p, admin = false) {
    const options = all(
      `SELECT * FROM variants WHERE product_id=? ${admin ? "" : "AND active=1"} ORDER BY rowid`,
      p.id,
    ).map((v) => ({
      id: v.id,
      unit: v.unit,
      label: v.label,
      price: v.price / 100,
      originalPrice: v.original_price ? v.original_price / 100 : null,
      stock: v.stock,
      lowStock: v.low_stock,
      active: !!v.active,
    }));
    return {
      id: p.id,
      slug: p.slug,
      name: p.name,
      categorySlug: p.category_slug,
      storeSlug: "",
      description: p.description,
      images: JSON.parse(p.images),
      tags: JSON.parse(p.tags),
      featured: !!p.featured,
      available: !!p.available,
      options,
      stock: p.available ? options.reduce((s, v) => s + v.stock, 0) : 0,
      rating: 0,
      oldPrice: options[0]?.originalPrice || undefined,
    };
  }
  function recipe(r) {
    return {
      ...r,
      prepTime: r.prep_time,
      cookingTime: r.cooking_time,
      published: !!r.published,
      steps: JSON.parse(r.steps),
      ingredients: all(
        "SELECT ri.*,v.product_id,v.unit,v.label FROM recipe_ingredients ri JOIN variants v ON v.id=ri.variant_id WHERE recipe_slug=? ORDER BY ri.rowid",
        r.slug,
      ).map((i) => ({
        variantId: i.variant_id,
        productId: i.product_id,
        unit: i.unit,
        qty: i.qty,
        note: i.note,
      })),
    };
  }
  function event(o, status, u, note = "") {
    run("UPDATE orders SET status=? WHERE id=?", status, o.id);
    run(
      "INSERT INTO tracking_events (id,order_id,status,actor_id,note) VALUES (?,?,?,?,?)",
      id(),
      o.id,
      status,
      u.id,
      note,
    );
    notify(o.user_id, `Your order ${o.id}: ${status}.`, o.id);
    admins(`${o.id}: ${status}`, o.id);
  }
  function restore(o, actor, reason) {
    if (o.stock_released) return;
    for (const i of all("SELECT * FROM order_items WHERE order_id=?", o.id)) {
      run("UPDATE variants SET stock=stock+? WHERE id=?", i.qty, i.variant_id);
      run(
        "INSERT INTO inventory_transactions (id,variant_id,order_id,actor_id,delta,reason) VALUES (?,?,?,?,?,?)",
        id(),
        i.variant_id,
        o.id,
        actor.id,
        i.qty,
        reason,
      );
    }
    run("UPDATE orders SET stock_released=1 WHERE id=?", o.id);
  }
  function expireReservations() {
    transaction(db, () => {
      for (const o of all(
        "SELECT * FROM orders WHERE payment_status='pending' AND stock_released=0 AND reserved_until<?",
        Date.now(),
      )) {
        const actor = { id: o.user_id };
        restore(o, actor, "Payment reservation expired");
        event(o, "Cancelled", actor, "Payment window expired");
      }
    });
  }
  async function paystack(path, options = {}) {
    if (!paystackKey) fail(503, "Online payments are not configured. Contact the store.");
    const res = await fetcher(`https://api.paystack.co${path}`, {
      ...options,
      signal: AbortSignal.timeout(15000),
      headers: { Authorization: `Bearer ${paystackKey}`, "Content-Type": "application/json" },
    });
    const result = await res.json();
    if (!res.ok || !result.status) fail(502, "Payment provider unavailable. Please retry.");
    return result.data;
  }
  async function verifyPayment(reference) {
    const p = get("SELECT * FROM payments WHERE reference=?", reference);
    if (!p) fail(404, "Payment not found.");
    if (p.status === "paid" || p.status === "refund_required") return p;
    const result = await paystack(`/transaction/verify/${encodeURIComponent(reference)}`);
    if (result.reference !== reference || result.currency !== "NGN" || result.amount !== p.amount)
      fail(409, "Payment details do not match the order.");
    if (result.status !== "success") {
      if (["failed", "abandoned"].includes(result.status))
        transaction(db, () => {
          const o = get("SELECT * FROM orders WHERE id=?", p.order_id);
          if (o.payment_status !== "pending") return;
          run("UPDATE payments SET status='failed' WHERE reference=?", reference);
          run("UPDATE orders SET payment_status='failed' WHERE id=?", o.id);
          restore(o, { id: o.user_id }, "Verified payment failure");
          event(o, "Cancelled", { id: o.user_id }, "Payment was not completed");
          admins(`Payment failed for ${o.id}`, o.id);
        });
      return { ...p, status: result.status };
    }
    transaction(db, () => {
      const current = get("SELECT * FROM payments WHERE reference=?", reference);
      if (current.status === "paid" || current.status === "refund_required") return;
      const o = get("SELECT * FROM orders WHERE id=?", p.order_id);
      const status = o.stock_released ? "refund_required" : "paid";
      run(
        "UPDATE payments SET status=?,provider_id=?,verified_at=CURRENT_TIMESTAMP WHERE reference=?",
        status,
        String(result.id),
        reference,
      );
      run("UPDATE orders SET payment_status=? WHERE id=?", status, o.id);
      if (status === "paid") event(o, "Payment Confirmed", { id: o.user_id });
      else admins(`Late payment for ${o.id}; refund required. Stock was released.`, o.id);
    });
    return get("SELECT * FROM payments WHERE reference=?", reference);
  }
  function orderDetails(o, u) {
    const assignment = get(
      "SELECT a.*,u.name,u.phone,u.contact_consent FROM delivery_assignments a JOIN users u ON u.id=a.rider_id WHERE order_id=?",
      o.id,
    );
    const active = !!assignment && liveStatuses.includes(o.status);
    const location = active
      ? get(
          "SELECT latitude,longitude,accuracy,created_at FROM delivery_locations WHERE order_id=? ORDER BY rowid DESC LIMIT 1",
          o.id,
        ) || null
      : null;
    const evidence =
      u.role === "ADMIN" || u.role === "RIDER"
        ? get("SELECT * FROM delivery_evidence WHERE order_id=?", o.id) || null
        : null;
    return {
      ...o,
      subtotal: o.subtotal / 100,
      delivery_fee: o.delivery_fee / 100,
      total: o.total / 100,
      items: all("SELECT * FROM order_items WHERE order_id=?", o.id).map((i) => ({
        ...i,
        price: i.price / 100,
      })),
      events: all(
        "SELECT status,note,created_at FROM tracking_events WHERE order_id=? ORDER BY rowid",
        o.id,
      ),
      rider: assignment
        ? {
            id: assignment.rider_id,
            name: assignment.name,
            phone:
              assignment.contact_consent && !inactive.includes(o.status) ? assignment.phone : null,
            assignmentStatus: assignment.status,
          }
        : null,
      location,
      evidence,
      confirmations: all(
        "SELECT kind,created_at FROM delivery_confirmations WHERE order_id=?",
        o.id,
      ),
      dispute: get("SELECT * FROM disputes WHERE order_id=?", o.id) || null,
      review: get("SELECT * FROM reviews WHERE order_id=?", o.id) || null,
      payment: get("SELECT reference,status,verified_at FROM payments WHERE order_id=?", o.id),
    };
  }
  async function handler(req, res) {
    try {
      const url = new URL(req.url, origin);
      const path = url.pathname;
      const method = req.method;
      const mutating = !["GET", "HEAD", "OPTIONS"].includes(method);
      if (mutating && path !== "/api/payments/webhook" && req.headers.origin !== origin)
        fail(403, "Request origin not allowed.");
      res.setHeader("X-Content-Type-Options", "nosniff");
      const parts = path.split("/").filter(Boolean);
      const b = async () => body(req);
      if (path === "/api/health") return json(res, 200, { ok: true });
      if (path === "/api/config" && method === "GET")
        return json(res, 200, {
          paymentsConfigured: !!paystackKey,
          zones: JSON.parse(get("SELECT value FROM settings WHERE key='zones'")?.value || "[]"),
          supportPhone: JSON.parse(
            get("SELECT value FROM settings WHERE key='supportPhone'")?.value || '""',
          ),
          pickup: JSON.parse(get("SELECT value FROM settings WHERE key='pickup'")?.value || "null"),
        });
      if (path === "/api/auth/register" || path === "/api/auth/login") {
        if (method !== "POST") fail(405, "Method not allowed.");
        const address = req.socket.remoteAddress;
        const counter = attempts.get(address) || { count: 0, until: Date.now() + 600000 };
        if (counter.until < Date.now()) {
          counter.count = 0;
          counter.until = Date.now() + 600000;
        }
        counter.count++;
        attempts.set(address, counter);
        if (counter.count > 30) fail(429, "Too many attempts. Try again in 10 minutes.");
        const data = z
          .object({
            email: z
              .string()
              .email()
              .max(254)
              .transform((v) => v.toLowerCase()),
            password: z
              .string()
              .min(path.endsWith("register") ? 12 : 1)
              .max(128),
            name: text.optional(),
            phone: z
              .string()
              .regex(/^(?:0\d{10}|\+234\d{10})$/)
              .optional(),
          })
          .parse(await b());
        let user = get("SELECT * FROM users WHERE email=?", data.email);
        if (path.endsWith("register")) {
          if (user) fail(409, "An account with this email already exists.");
          if (!data.name || !data.phone) fail(400, "Name and phone number are required.");
          const userId = id();
          run(
            "INSERT INTO users (id,email,name,phone,password_hash,role) VALUES (?,?,?,?,?,?)",
            userId,
            data.email,
            data.name,
            data.phone,
            await hashPassword(data.password),
            "CUSTOMER",
          );
          user = get("SELECT * FROM users WHERE id=?", userId);
          admins("A new customer registered.");
        } else if (
          !(await checkPassword(
            data.password,
            user?.password_hash || "00000000000000000000000000000000:" + "00".repeat(64),
          )) ||
          !user
        )
          fail(401, "Email or password is incorrect.");
        const token = createSession(db, user.id);
        res.setHeader(
          "Set-Cookie",
          `cribs_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800${origin.startsWith("https:") ? "; Secure" : ""}`,
        );
        return json(res, 200, publicUser(user));
      }
      if (path === "/api/auth/me" && method === "GET") {
        const user = sessionUser(db, req);
        return json(res, 200, user ? publicUser(user) : null);
      }
      if (path === "/api/auth/logout" && method === "POST") {
        const token = req.headers.cookie?.match(/cribs_session=([a-f0-9]{64})/)?.[1];
        if (token) run("DELETE FROM sessions WHERE token_hash=?", hashToken(token));
        res.setHeader("Set-Cookie", "cribs_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");
        return json(res, 200, { ok: true });
      }
      if (path === "/api/profile" && method === "PATCH") {
        const u = requireUser(req);
        const data = z
          .object({
            name: text,
            phone: z.string().regex(/^(?:0\d{10}|\+234\d{10})$/),
            contactConsent: z.boolean(),
          })
          .parse(await b());
        run(
          "UPDATE users SET name=?,phone=?,contact_consent=? WHERE id=?",
          data.name,
          data.phone,
          +data.contactConsent,
          u.id,
        );
        return json(res, 200, publicUser(get("SELECT * FROM users WHERE id=?", u.id)));
      }
      if (path === "/api/categories" && method === "GET")
        return json(
          res,
          200,
          all("SELECT * FROM categories ORDER BY name").map((c) => ({
            ...c,
            tint: "bg-leaf",
            parentSlug: c.parent_slug,
          })),
        );
      if (parts[1] === "products" && method === "GET") {
        const list = all("SELECT * FROM products WHERE available=1 ORDER BY created_at DESC")
          .map((p) => product(p))
          .filter((p) => p.options.length);
        return json(res, 200, parts[2] ? list.find((p) => p.id === parts[2]) || null : list);
      }
      if (parts[1] === "recipes" && method === "GET") {
        const list = all("SELECT * FROM recipes WHERE published=1 ORDER BY name").map(recipe);
        return json(res, 200, parts[2] ? list.find((r) => r.slug === parts[2]) || null : list);
      }
      if (path === "/api/images" && method === "POST") {
        const u = requireUser(req, ["ADMIN", "RIDER"]);
        const bytes = await rawBody(req, 5000000);
        const png = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
        const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
        const webp =
          bytes.subarray(0, 4).toString() === "RIFF" && bytes.subarray(8, 12).toString() === "WEBP";
        const mime = png ? "image/png" : jpeg ? "image/jpeg" : webp ? "image/webp" : null;
        if (!mime || req.headers["content-type"] !== mime)
          fail(400, "Upload a JPEG, PNG, or WebP image, up to 5 MB.");
        const uploadId = id();
        mkdirSync(resolve(uploadsDir), { recursive: true });
        writeFileSync(resolve(uploadsDir, uploadId), bytes, { flag: "wx" });
        run(
          "INSERT INTO uploads (id,owner_id,mime,private) VALUES (?,?,?,?)",
          uploadId,
          u.id,
          mime,
          +(u.role === "RIDER"),
        );
        return json(res, 201, { url: `/api/images/${uploadId}` });
      }
      if (parts[1] === "images" && parts[2] && method === "GET") {
        const upload = get("SELECT * FROM uploads WHERE id=?", parts[2]);
        if (!upload) fail(404, "Image not found.");
        if (upload.private) {
          const u = requireUser(req, ["ADMIN", "RIDER"]);
          if (u.role !== "ADMIN" && upload.owner_id !== u.id) fail(404, "Image not found.");
        }
        res.writeHead(200, {
          "Content-Type": upload.mime,
          "Cache-Control": upload.private ? "private, no-store" : "public, max-age=86400",
          "X-Content-Type-Options": "nosniff",
        });
        return res.end(readFileSync(resolve(uploadsDir, upload.id)));
      }
      if (path === "/api/events" && method === "GET") {
        const u = requireUser(req);
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
        });
        res.write("event: change\ndata: {}\n\n");
        const set = streams.get(u.id) || new Set();
        set.add(res);
        streams.set(u.id, set);
        const heartbeat = setInterval(() => {
          if (!sessionUser(db, req)) res.end();
          else res.write(": heartbeat\n\n");
        }, 25000);
        req.on("close", () => {
          clearInterval(heartbeat);
          set.delete(res);
          if (!set.size) streams.delete(u.id);
        });
        return;
      }
      if (parts[1] === "notifications") {
        const u = requireUser(req);
        if (method === "GET")
          return json(
            res,
            200,
            all("SELECT * FROM notifications WHERE user_id=? ORDER BY rowid DESC LIMIT 200", u.id),
          );
        if (method === "PATCH") {
          run(
            "UPDATE notifications SET read_at=CURRENT_TIMESTAMP WHERE user_id=? AND id=?",
            u.id,
            parts[2],
          );
          push(u.id);
          return json(res, 200, { ok: true });
        }
        if (method === "DELETE" && !parts[2]) {
          run("DELETE FROM notifications WHERE user_id=? AND read_at IS NOT NULL", u.id);
          push(u.id);
          return json(res, 200, { ok: true });
        }
      }
      if (path === "/api/cart") {
        const u = requireUser(req, ["CUSTOMER"]);
        if (method === "GET")
          return json(
            res,
            200,
            JSON.parse(get("SELECT items FROM carts WHERE user_id=?", u.id)?.items || "[]"),
          );
        if (method === "PUT") {
          const items = z
            .array(
              z.object({ variantId: z.string().uuid(), qty: z.number().int().min(1).max(1000) }),
            )
            .max(100)
            .parse(await b());
          run(
            "INSERT INTO carts (user_id,items) VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET items=excluded.items,updated_at=CURRENT_TIMESTAMP",
            u.id,
            JSON.stringify(items),
          );
          return json(res, 200, { ok: true });
        }
      }
      if (path === "/api/orders" && method === "POST") {
        const u = requireUser(req, ["CUSTOMER"]);
        if (!paystackKey) fail(503, "Payments are not configured. Your basket has been kept.");
        const data = z
          .object({
            items: z
              .array(
                z.object({ variantId: z.string().uuid(), qty: z.number().int().min(1).max(1000) }),
              )
              .min(1)
              .max(100),
            address: z.string().trim().min(10).max(1000),
            phone: z.string().regex(/^(?:0\d{10}|\+234\d{10})$/),
            zone: text,
            instructions: z.string().max(1000).default(""),
            idempotencyKey: z.string().uuid(),
            ...coords,
          })
          .parse(await b());
        expireReservations();
        const existing = get(
          "SELECT * FROM orders WHERE user_id=? AND idempotency_key=?",
          u.id,
          data.idempotencyKey,
        );
        if (existing) return json(res, 200, orderDetails(existing, u));
        const zones = JSON.parse(
          get("SELECT value FROM settings WHERE key='zones'")?.value || "[]",
        );
        const zone = zones.find((z) => z.name === data.zone);
        if (!zone) fail(400, "Select an available delivery location.");
        const o = transaction(db, () => {
          const combined = new Map();
          data.items.forEach((i) =>
            combined.set(i.variantId, (combined.get(i.variantId) || 0) + i.qty),
          );
          const lines = [...combined].map(([variantId, qty]) => {
            const v = get(
              "SELECT v.*,p.name,p.images,p.available FROM variants v JOIN products p ON p.id=v.product_id WHERE v.id=?",
              variantId,
            );
            if (!v || !v.active || !v.available || v.stock < qty)
              fail(409, `${v?.name || "Product"} is unavailable in the requested quantity.`);
            return { v, qty };
          });
          const subtotal = lines.reduce((s, l) => s + l.v.price * l.qty, 0);
          const orderId = `CRB-${randomBytes(6).toString("hex").toUpperCase()}`;
          const fee = Math.round(zone.fee * 100);
          if (!Number.isSafeInteger(subtotal + fee) || subtotal + fee > 100000000000) fail(400, 'Order total exceeds the supported limit.');
          run(
            "INSERT INTO orders (id,user_id,status,subtotal,delivery_fee,total,address,phone,instructions,latitude,longitude,delivery_zone,idempotency_key,reserved_until) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            orderId,
            u.id,
            "Order Placed",
            subtotal,
            fee,
            subtotal + fee,
            data.address,
            data.phone,
            data.instructions,
            data.latitude,
            data.longitude,
            data.zone,
            data.idempotencyKey,
            Date.now() + 30 * 60000,
          );
          for (const { v, qty } of lines) {
            run("UPDATE variants SET stock=stock-? WHERE id=?", qty, v.id);
            run(
              "INSERT INTO order_items (id,order_id,variant_id,product_id,name,image,label,unit,qty,price) VALUES (?,?,?,?,?,?,?,?,?,?)",
              id(),
              orderId,
              v.id,
              v.product_id,
              v.name,
              JSON.parse(v.images)[0],
              v.label,
              v.unit,
              qty,
              v.price,
            );
            run(
              "INSERT INTO inventory_transactions (id,variant_id,order_id,actor_id,delta,reason) VALUES (?,?,?,?,?,?)",
              id(),
              v.id,
              orderId,
              u.id,
              -qty,
              "Checkout reservation",
            );
            if (v.stock - qty <= v.low_stock)
              admins(`Low stock: ${v.name}, ${v.label}: ${v.stock - qty} remaining.`);
          }
          const order = get("SELECT * FROM orders WHERE id=?", orderId);
          event(order, "Order Placed", u);
          run(
            "INSERT INTO payments (reference,order_id,amount) VALUES (?,?,?)",
            `pay_${id().replaceAll("-", "")}`,
            orderId,
            order.total,
          );
          return order;
        });
        changed();
        return json(res, 201, orderDetails(o, u));
      }
      if (path === "/api/payments/webhook" && method === "POST") {
        if (!paystackKey) fail(503, "Payments unavailable.");
        const raw = await rawBody(req, 1000000);
        const signature = req.headers["x-paystack-signature"];
        const expected = createHmac("sha512", paystackKey).update(raw).digest();
        if (
          typeof signature !== "string" ||
          !/^[a-f0-9]{128}$/.test(signature) ||
          !timingSafeEqual(expected, Buffer.from(signature, "hex"))
        )
          fail(401, "Invalid webhook signature.");
        const payload = JSON.parse(raw.toString());
        if (payload.event === "charge.success") await verifyPayment(payload.data.reference);
        return json(res, 200, { ok: true });
      }
      if (parts[1] === "payments" && parts[2]) {
        const u = requireUser(req, ["CUSTOMER", "ADMIN"]);
        const p = get("SELECT * FROM payments WHERE reference=?", parts[2]);
        if (!p) fail(404, "Payment not found.");
        const o = ownedOrder(p.order_id, u);
        if (parts[3] === "verify" && method === "POST") {
          const result = await verifyPayment(p.reference);
          return json(res, 200, { status: result.status, orderId: o.id });
        }
        if (parts[3] === "initialize" && method === "POST") {
          if (o.stock_released || o.reserved_until < Date.now() || o.payment_status !== "pending")
            fail(409, "Payment window closed. Please review your order.");
          if (p.authorization_url) return json(res, 200, { url: p.authorization_url });
          const data = await paystack("/transaction/initialize", {
            method: "POST",
            body: JSON.stringify({
              email: get('SELECT email FROM users WHERE id=?', o.user_id).email,
              amount: p.amount,
              currency: "NGN",
              reference: p.reference,
              callback_url: `${origin}/orders?reference=${p.reference}`,
            }),
          });
          if (!String(data.authorization_url).startsWith("https://checkout.paystack.com/"))
            fail(502, "Unexpected payment URL.");
          run(
            "UPDATE payments SET authorization_url=? WHERE reference=?",
            data.authorization_url,
            p.reference,
          );
          return json(res, 200, { url: data.authorization_url });
        }
      }
      if (parts[1] === "orders") {
        const u = requireUser(req);
        const orderId = parts[2];
        if (method === "GET") {
          if (orderId) return json(res, 200, orderDetails(ownedOrder(orderId, u), u));
          const rows =
            u.role === "ADMIN"
              ? all("SELECT * FROM orders ORDER BY rowid DESC")
              : u.role === "RIDER"
                ? all(
                    "SELECT o.* FROM orders o JOIN delivery_assignments a ON a.order_id=o.id WHERE a.rider_id=? ORDER BY o.rowid DESC",
                    u.id,
                  )
                : all("SELECT * FROM orders WHERE user_id=? ORDER BY rowid DESC", u.id);
          return json(
            res,
            200,
            rows.map((o) => orderDetails(o, u)),
          );
        }
        const o = ownedOrder(orderId, u);
        const action = parts[3];
        const data = await b();
        if (action === "cancel" && method === "POST") {
          if (u.role !== "ADMIN" && u.id !== o.user_id) fail(403, "Not permitted.");
          if (!["Order Placed", "Payment Confirmed"].includes(o.status))
            fail(409, "This order can no longer be cancelled.");
          transaction(db, () => {
            restore(o, u, "Order cancelled");
            event(o, "Cancelled", u);
            if (o.payment_status === "paid") {
              run("UPDATE orders SET payment_status='refund_required' WHERE id=?", o.id);
              run("UPDATE payments SET status='refund_required' WHERE order_id=?", o.id);
              admins(`Refund required for ${o.id}`, o.id);
            }
          });
        } else if (action === "confirm" && method === "POST") {
          if (u.id !== o.user_id || o.status !== "Rider Marked Delivered")
            fail(409, "Delivery is not awaiting your confirmation.");
          transaction(db, () => {
            run(
              "INSERT INTO delivery_confirmations (order_id,user_id,kind) VALUES (?,?,?)",
              o.id,
              u.id,
              "CUSTOMER",
            );
            event(o, "Customer Confirmed Received", u);
            event(o, "Completed", u);
          });
        } else if (action === "dispute" && method === "POST") {
          if (
            u.id !== o.user_id ||
            !["Rider Marked Delivered", "Completed", "Delivery Failed"].includes(o.status)
          )
            fail(409, "This order cannot be disputed at this stage.");
          const { reason } = z.object({ reason: z.string().trim().min(10).max(3000) }).parse(data);
          transaction(db, () => {
            run(
              "INSERT INTO disputes (id,order_id,user_id,reason) VALUES (?,?,?,?)",
              id(),
              o.id,
              u.id,
              reason,
            );
            event(o, "Disputed", u);
          });
        } else if (action === "review" && method === "POST") {
          if (
            u.id !== o.user_id ||
            o.status !== "Completed" ||
            !get("SELECT 1 FROM delivery_confirmations WHERE order_id=? AND kind='CUSTOMER'", o.id)
          )
            fail(409, "Confirm delivery before leaving a review.");
          const rating = z.number().int().min(1).max(5);
          const r = z
            .object({
              speed: rating,
              professionalism: rating,
              freshness: rating,
              quality: rating,
              overall: rating,
              comment: z.string().max(3000).default(""),
            })
            .parse(data);
          run(
            "INSERT INTO reviews VALUES (?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)",
            o.id,
            u.id,
            r.speed,
            r.professionalism,
            r.freshness,
            r.quality,
            r.overall,
            r.comment,
          );
        } else if (action === "status" && method === "POST") {
          if (u.role !== "ADMIN") fail(403, "Administrator required.");
          const { status, note } = z
            .object({ status: text, note: z.string().max(1000).default("") })
            .parse(data);
          const next = {
            "Payment Confirmed": ["Order Confirmed"],
            "Order Confirmed": ["Preparing Your Order"],
            "Preparing Your Order": ["Ready for Dispatch"],
            "Out for Delivery": ["Delivery Failed"],
            "Arriving Soon": ["Delivery Failed"],
            Completed: ["Returned"],
          };
          if (!(next[o.status] || []).includes(status) || o.payment_status !== "paid")
            fail(409, "Invalid order status transition.");
          transaction(db, () => {
            event(o, status, u, note);
            audit(u, "order.status", o.id);
          });
        } else if (action === "assign" && method === "POST") {
          if (u.role !== "ADMIN" || o.status !== "Ready for Dispatch")
            fail(409, "Order must be ready for dispatch.");
          const { riderId } = z.object({ riderId: z.string().uuid() }).parse(data);
          if (!get("SELECT 1 FROM users WHERE id=? AND role='RIDER'", riderId))
            fail(400, "Select a rider.");
          transaction(db, () => {
            run(
              "INSERT INTO delivery_assignments (order_id,rider_id) VALUES (?,?) ON CONFLICT(order_id) DO UPDATE SET rider_id=excluded.rider_id,status='assigned'",
              o.id,
              riderId,
            );
            event(o, "Rider Assigned", u);
            notify(riderId, `New delivery assignment: ${o.id}`, o.id);
            audit(u, "delivery.assign", o.id);
          });
        } else if (action === "rider" && method === "POST") {
          if (u.role !== "RIDER") fail(403, "Rider required.");
          const {
            action: riderAction,
            notes,
            photo,
            latitude,
            longitude,
          } = z
            .object({
              action: z.enum(["accept", "reject", "pickup", "start", "arriving", "deliver"]),
              notes: z.string().max(2000).default(""),
              photo: image.optional(),
              latitude: coords.latitude.optional(),
              longitude: coords.longitude.optional(),
            })
            .parse(data);
          const assignment = get(
            "SELECT * FROM delivery_assignments WHERE order_id=? AND rider_id=?",
            o.id,
            u.id,
          );
          if (!assignment) fail(404, "Assignment not found.");
          transaction(db, () => {
            if (["accept", "reject"].includes(riderAction)) {
              if (o.status !== "Rider Assigned" || assignment.status !== "assigned")
                fail(409, "Assignment already answered.");
              run(
                "UPDATE delivery_assignments SET status=? WHERE order_id=?",
                riderAction === "accept" ? "accepted" : "rejected",
                o.id,
              );
              if (riderAction === "reject") {
                run("DELETE FROM delivery_assignments WHERE order_id=?", o.id);
                event(o, "Ready for Dispatch", u, "Rider declined assignment");
              }
            } else if (riderAction === "pickup") {
              if (o.status !== "Rider Assigned" || assignment.status !== "accepted")
                fail(409, "Accept the assignment first.");
              run("UPDATE delivery_assignments SET status='picked_up' WHERE order_id=?", o.id);
              notify(o.user_id, `Your rider has picked up ${o.id}.`, o.id);
              admins(`Rider picked up ${o.id}`, o.id);
            } else if (riderAction === "start") {
              if (o.status !== "Rider Assigned" || assignment.status !== "picked_up")
                fail(409, "Confirm pickup first.");
              event(o, "Out for Delivery", u);
            } else if (riderAction === "arriving") {
              if (o.status !== "Out for Delivery") fail(409, "Delivery is not active.");
              event(o, "Arriving Soon", u);
            } else {
              if (!liveStatuses.includes(o.status)) fail(409, "Delivery is not active.");
              if (!photo && notes.trim().length < 10)
                fail(400, "Provide delivery evidence notes or a consented photo.");
              if (
                photo &&
                !get(
                  "SELECT 1 FROM uploads WHERE id=? AND owner_id=? AND private=1",
                  photo.split("/").at(-1),
                  u.id,
                )
              )
                fail(400, "Invalid delivery photo.");
              run(
                "INSERT INTO delivery_evidence (id,order_id,rider_id,image,notes,latitude,longitude) VALUES (?,?,?,?,?,?,?)",
                id(),
                o.id,
                u.id,
                photo || null,
                notes,
                latitude ?? null,
                longitude ?? null,
              );
              run(
                "INSERT INTO delivery_confirmations (order_id,user_id,kind) VALUES (?,?,?)",
                o.id,
                u.id,
                "RIDER",
              );
              event(o, "Rider Marked Delivered", u);
              notify(o.user_id, `Has order ${o.id} been delivered? Please confirm receipt.`, o.id);
            }
          });
        } else if (action === "location" && method === "POST") {
          if (u.role !== "RIDER" || !liveStatuses.includes(o.status))
            fail(403, "Location sharing is unavailable.");
          const loc = z.object({ ...coords, accuracy: z.number().min(0).max(100000) }).parse(data);
          run(
            "INSERT INTO delivery_locations (id,order_id,rider_id,latitude,longitude,accuracy) VALUES (?,?,?,?,?,?)",
            id(),
            o.id,
            u.id,
            loc.latitude,
            loc.longitude,
            loc.accuracy,
          );
          push(o.user_id);
          all("SELECT id FROM users WHERE role='ADMIN'").forEach((a) => push(a.id));
        } else if (action === "resolve" && method === "POST") {
          if (u.role !== "ADMIN" || o.status !== "Disputed")
            fail(403, "An administrator must resolve this dispute.");
          const d = z
            .object({
              resolution: z.string().trim().min(20).max(3000),
              outcome: z.enum(["Completed", "Returned"]),
            })
            .parse(data);
          transaction(db, () => {
            run(
              "UPDATE disputes SET status='resolved',resolution=?,resolved_by=? WHERE order_id=?",
              d.resolution,
              u.id,
              o.id,
            );
            run(
              "INSERT INTO delivery_confirmations (order_id,user_id,kind) VALUES (?,?,?)",
              o.id,
              u.id,
              "ADMIN_RESOLUTION",
            );
            event(o, d.outcome, u, d.resolution);
            audit(u, "dispute.resolve", o.id);
          });
        } else fail(404, "Action not found.");
        changed();
        return json(res, 200, orderDetails(get("SELECT * FROM orders WHERE id=?", o.id), u));
      }
      if (parts[1] === "admin") {
        const u = requireUser(req, ["ADMIN"]);
        const section = parts[2];
        const entityId = parts[3];
        if (section === "overview" && method === "GET") {
          const statuses = all("SELECT status,COUNT(*) AS count FROM orders GROUP BY status");
          const lowStock = all(
            "SELECT v.*,p.name FROM variants v JOIN products p ON p.id=v.product_id WHERE v.stock<=v.low_stock AND v.active=1",
          );
          return json(res, 200, {
            products: get("SELECT COUNT(*) n FROM products").n,
            customers: get("SELECT COUNT(*) n FROM users WHERE role='CUSTOMER'").n,
            orders: get("SELECT COUNT(*) n FROM orders").n,
            revenue:
              get("SELECT COALESCE(SUM(total),0) n FROM orders WHERE payment_status='paid'").n /
              100,
            todaySales:
              get(
                "SELECT COALESCE(SUM(total),0) n FROM orders WHERE payment_status='paid' AND date(created_at,'+1 hour')=date('now','+1 hour')",
              ).n / 100,
            statuses,
            lowStock,
            sales: all(
              "SELECT date(verified_at,'+1 hour') day,SUM(amount)/100.0 total FROM payments WHERE status='paid' GROUP BY day ORDER BY day DESC LIMIT 30",
            ).reverse(),
            recentOrders: all("SELECT * FROM orders ORDER BY rowid DESC LIMIT 10").map((o) =>
              orderDetails(o, u),
            ),
          });
        }
        if (section === "products") {
          if (method === "GET")
            return json(
              res,
              200,
              all("SELECT * FROM products ORDER BY created_at DESC").map((p) => product(p, true)),
            );
          if (method === "DELETE" && entityId) {
            run("UPDATE products SET available=0 WHERE id=?", entityId);
            audit(u, "product.archive", entityId);
            changed();
            return json(res, 200, { ok: true });
          }
          if (method === "POST" || method === "PUT") {
            const data = productSchema.parse(await b());
            const productId = entityId || id();
            if (method === "PUT" && !get("SELECT 1 FROM products WHERE id=?", productId))
              fail(404, "Product not found.");
            if (!get("SELECT 1 FROM categories WHERE slug=?", data.categorySlug))
              fail(400, "Category not found.");
            for (const src of data.images)
              if (!get("SELECT 1 FROM uploads WHERE id=? AND private=0", src.split("/").at(-1)))
                fail(400, "Upload product images first.");
            if (new Set(data.options.map((o) => o.label)).size !== data.options.length)
              fail(400, "Variation labels must be unique.");
            if (
              new Set(data.options.filter((o) => o.id).map((o) => o.id)).size !==
              data.options.filter((o) => o.id).length
            )
              fail(400, "Duplicate variations.");
            transaction(db, () => {
              run(
                "INSERT INTO products (id,name,slug,category_slug,description,images,tags,available,featured) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,slug=excluded.slug,category_slug=excluded.category_slug,description=excluded.description,images=excluded.images,tags=excluded.tags,available=excluded.available,featured=excluded.featured",
                productId,
                data.name,
                data.slug,
                data.categorySlug,
                data.description,
                JSON.stringify(data.images),
                JSON.stringify(data.tags),
                +data.available,
                +data.featured,
              );
              run("UPDATE variants SET active=0 WHERE product_id=?", productId);
              for (const v of data.options) {
                const old = v.id ? get("SELECT * FROM variants WHERE id=?", v.id) : null;
                if (v.id && (!old || old.product_id !== productId)) fail(400, "Invalid variation.");
                const variantId = v.id || id();
                run(
                  "INSERT INTO variants (id,product_id,unit,label,price,original_price,stock,low_stock,active) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET unit=excluded.unit,label=excluded.label,price=excluded.price,original_price=excluded.original_price,stock=excluded.stock,low_stock=excluded.low_stock,active=excluded.active",
                  variantId,
                  productId,
                  v.unit,
                  v.label,
                  Math.round(v.price * 100),
                  v.originalPrice ? Math.round(v.originalPrice * 100) : null,
                  v.stock,
                  v.lowStock,
                  +v.active,
                );
                if (v.stock !== (old?.stock || 0))
                  run(
                    "INSERT INTO inventory_transactions (id,variant_id,actor_id,delta,reason) VALUES (?,?,?,?,?)",
                    id(),
                    variantId,
                    u.id,
                    v.stock - (old?.stock || 0),
                    "Admin stock adjustment",
                  );
              }
              audit(u, "product.save", productId);
            });
            changed();
            return json(
              res,
              200,
              product(get("SELECT * FROM products WHERE id=?", productId), true),
            );
          }
        }
        if (section === "categories") {
          if (method === "POST" || method === "PUT") {
            const c = categorySchema.parse(await b());
            if (entityId && entityId !== c.slug) fail(400, "Category slug cannot be changed.");
            if (c.parentSlug === c.slug) fail(400, "A category cannot be its own parent.");
            run(
              "INSERT INTO categories (slug,name,image,blurb,parent_slug) VALUES (?,?,?,?,?) ON CONFLICT(slug) DO UPDATE SET name=excluded.name,image=excluded.image,blurb=excluded.blurb,parent_slug=excluded.parent_slug",
              c.slug,
              c.name,
              c.image,
              c.blurb,
              c.parentSlug,
            );
            audit(u, "category.save", c.slug);
            changed();
            return json(res, 200, c);
          }
          if (method === "DELETE") {
            run("DELETE FROM categories WHERE slug=?", entityId);
            audit(u, "category.delete", entityId);
            changed();
            return json(res, 200, { ok: true });
          }
        }
        if (section === "recipes") {
          if (method === "GET")
            return json(res, 200, all("SELECT * FROM recipes ORDER BY name").map(recipe));
          if (method === "DELETE") {
            run("UPDATE recipes SET published=0 WHERE slug=?", entityId);
            audit(u, "recipe.unpublish", entityId);
            changed();
            return json(res, 200, { ok: true });
          }
          if (method === "POST" || method === "PUT") {
            const r = recipeSchema.parse(await b());
            if (entityId && entityId !== r.slug) fail(400, "Recipe slug cannot be changed.");
            transaction(db, () => {
              run(
                "INSERT INTO recipes (slug,name,image,description,prep_time,cooking_time,serves,difficulty,category,video,steps,published) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(slug) DO UPDATE SET name=excluded.name,image=excluded.image,description=excluded.description,prep_time=excluded.prep_time,cooking_time=excluded.cooking_time,serves=excluded.serves,difficulty=excluded.difficulty,category=excluded.category,video=excluded.video,steps=excluded.steps,published=excluded.published",
                r.slug,
                r.name,
                r.image,
                r.description,
                r.prepTime,
                r.cookingTime,
                r.serves,
                r.difficulty,
                r.category,
                r.video,
                JSON.stringify(r.steps),
                +r.published,
              );
              run("DELETE FROM recipe_ingredients WHERE recipe_slug=?", r.slug);
              for (const i of r.ingredients)
                run(
                  "INSERT INTO recipe_ingredients (id,recipe_slug,variant_id,qty,note) VALUES (?,?,?,?,?)",
                  id(),
                  r.slug,
                  i.variantId,
                  i.qty,
                  i.note,
                );
              audit(u, "recipe.save", r.slug);
            });
            changed();
            return json(res, 200, recipe(get("SELECT * FROM recipes WHERE slug=?", r.slug)));
          }
        }
        if (section === "customers" && method === "GET")
          return json(
            res,
            200,
            all("SELECT * FROM users ORDER BY created_at DESC").map(publicUser),
          );
        if (section === "riders" && method === "POST") {
          const d = z
            .object({
              email: z.string().email(),
              name: text,
              phone: z.string().regex(/^(?:0\d{10}|\+234\d{10})$/),
              password: z.string().min(12).max(128),
            })
            .parse(await b());
          const userId = id();
          run(
            "INSERT INTO users (id,email,name,phone,password_hash,role) VALUES (?,?,?,?,?,?)",
            userId,
            d.email.toLowerCase(),
            d.name,
            d.phone,
            await hashPassword(d.password),
            "RIDER",
          );
          audit(u, "rider.create", userId);
          return json(res, 201, publicUser(get("SELECT * FROM users WHERE id=?", userId)));
        }
        if (section === "payments" && method === "GET")
          return json(
            res,
            200,
            all("SELECT * FROM payments ORDER BY rowid DESC").map((p) => ({
              ...p,
              amount: p.amount / 100,
            })),
          );
        if (section === "inventory" && method === "GET")
          return json(
            res,
            200,
            all(
              "SELECT t.*,v.label,p.name FROM inventory_transactions t JOIN variants v ON v.id=t.variant_id JOIN products p ON p.id=v.product_id ORDER BY t.rowid DESC LIMIT 500",
            ),
          );
        if (section === "reviews" && method === "GET")
          return json(res, 200, all("SELECT * FROM reviews ORDER BY rowid DESC"));
        if (section === "settings") {
          if (method === "GET")
            return json(
              res,
              200,
              Object.fromEntries(
                all("SELECT * FROM settings").map((s) => [s.key, JSON.parse(s.value)]),
              ),
            );
          if (method === "PUT") {
            const s = z
              .object({
                zones: z
                  .array(z.object({ name: text, fee: z.number().min(0).max(1000000) }))
                  .max(100),
                supportPhone: z.string().max(30),
                pickup: z.object({ ...coords, address: text }).nullable(),
              })
              .parse(await b());
            transaction(db, () => {
              for (const [key, value] of Object.entries(s))
                run(
                  "INSERT INTO settings VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
                  key,
                  JSON.stringify(value),
                );
              audit(u, "settings.save", "website");
            });
            return json(res, 200, s);
          }
        }
      }
      fail(404, "Endpoint not found.");
    } catch (error) {
      if (res.headersSent) {
        res.end();
        return;
      }
      if (error instanceof z.ZodError)
        return json(res, 400, {
          error: error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
        });
      if (error.code?.startsWith("ERR_SQLITE") || error.message?.includes("constraint failed"))
        return json(res, 409, {
          error: "This change conflicts with an existing or linked record.",
        });
      if (!error.status) console.error(error);
      return json(res, error.status || 500, {
        error: error.status ? error.message : "Something went wrong. Please retry.",
      });
    }
  }
  const server = createServer(handler);
  const housekeeping = setInterval(() => {
    try {
      expireReservations();
      run("DELETE FROM sessions WHERE expires_at<?", Date.now());
      run(
        "DELETE FROM delivery_locations WHERE created_at<datetime('now','-7 days') AND order_id IN (SELECT id FROM orders WHERE status IN ('Completed','Cancelled','Returned'))",
      );
      for (const [key, value] of attempts) if (value.until < Date.now()) attempts.delete(key);
    } catch (e) {
      console.error(e);
    }
  }, 60000);
  housekeeping.unref();
  server.on("close", () => {
    clearInterval(housekeeping);
    for (const set of streams.values()) for (const res of set) res.end();
  });
  return { server, db, handler };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { server } = createMarketplace();
  server.listen(Number(process.env.API_PORT || 3001), "127.0.0.1", () =>
    console.log(`Marketplace API listening on http://127.0.0.1:${process.env.API_PORT || 3001}`),
  );
}
