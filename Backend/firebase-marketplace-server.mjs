import { createServer } from "node:http";
import {requestSessionCookie} from "./tab-sessions.mjs";
import { randomUUID, createHmac, timingSafeEqual } from "node:crypto";
import { mkdirSync, writeFileSync, readFileSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { firebaseServices } from "./firebase.mjs";
import {
  createFirebaseAuthService,
  firestoreAuthStore,
  firebaseProjectIdentityProvider,
  authError,
  publicProfile,
} from "./firebase-auth.mjs";
import { createFirebaseAuthApi } from "./firebase-auth-server.mjs";
import { FirestoreMarketplace } from "./firestore-marketplace.mjs";
import * as schema from "./firestore-schemas.mjs";

async function rawBody(req, limit = 1000000) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw authError(413, "Request too large.");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
async function body(req) {
  if (!req.headers["content-type"]?.startsWith("application/json"))
    throw authError(415, "JSON required.");
  try {
    return JSON.parse((await rawBody(req)).toString());
  } catch (error) {
    if (error.status) throw error;
    throw authError(400, "Invalid JSON.");
  }
}
const send = (res, status, data) => {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(JSON.stringify(data));
};
const fail = (status, message) => {
  throw authError(status, message);
};

export function paystackProvider({ key, origin, fetcher = fetch }) {
  if (!key) return null;
  const call = async (path, options = {}) => {
    const res = await fetcher(`https://api.paystack.co${path}`, {
      ...options,
      signal: AbortSignal.timeout(15000),
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
    });
    const result = await res.json();
    if (!res.ok || !result.status)
      fail(502, "Payment provider unavailable. Please retry.");
    return result.data;
  };
  return {
    async initialize(data) {
      const result = await call("/transaction/initialize", {
        method: "POST",
        body: JSON.stringify({
          ...data,
          currency: "NGN",
          callback_url: `${origin}/orders?reference=${data.reference}`,
        }),
      });
      if (
        !result.authorization_url?.startsWith("https://checkout.paystack.com/")
      )
        fail(502, "Unexpected payment URL.");
      return { url: result.authorization_url };
    },
    async verify(reference) {
      return call(`/transaction/verify/${encodeURIComponent(reference)}`);
    },
  };
}

export function createFirebaseMarketplace({
  db,
  root = db,
  authService,
  authAdmin,
  origin = process.env.APP_ORIGIN || "http://localhost:8080",
  paystackKey = process.env.PAYSTACK_SECRET_KEY || "",
  payments = paystackProvider({ key: paystackKey, origin }),
  uploadsDir = process.env.UPLOADS_PATH ||
    fileURLToPath(new URL("./data/uploads", import.meta.url)),
  clock = () => Date.now(),
}) {
  const market = new FirestoreMarketplace({ db, root, payments, clock });
  const authApi = createFirebaseAuthApi({ service: authService, origin });
  const authHandler = authApi.listeners("request")[0];
  const requireUser = async (req, roles) => {
    const user = await authService.session(requestSessionCookie(req,origin));
    if (!user) fail(401, "Please log in.");
    if (roles && !roles.includes(user.role))
      fail(403, "You do not have permission.");
    return user;
  };
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, origin);
      const path = url.pathname;
      const method = req.method;
      const parts = path.split("/").filter(Boolean);
      if (parts[0] !== "api") fail(404, "Endpoint not found.");
      if (path.startsWith("/api/auth/") || path === "/api/profile")
        return authHandler(req, res);
      if (
        !["GET", "HEAD"].includes(method) &&
        path !== "/api/payments/webhook" &&
        req.headers.origin !== origin
      )
        fail(403, "Request origin not allowed.");
      if (path === "/api/health" && method === "GET")
        return send(res, 200, {
          ok: true,
          database: "firestore",
          authentication: "firebase",
          stage: "backend-validation",
        });
      if (path === "/api/config" && method === "GET")
        return send(res, 200, {
          ...(await market.config()),
          paymentsConfigured: !!payments,
        });
      if (path === "/api/categories" && method === "GET")
        return send(
          res,
          200,
          (await market.list("categories")).sort((a, b) =>
            a.name.localeCompare(b.name),
          ),
        );
      if (parts[1] === "products" && method === "GET")
        return send(
          res,
          200,
          parts[2] ? await market.product(parts[2]) : await market.products(),
        );
      if (parts[1] === "recipes" && method === "GET") {
        const list = await market.recipes();
        return send(
          res,
          200,
          parts[2] ? list.find((r) => r.slug === parts[2]) || null : list,
        );
      }
      if (parts[1] === "images" && parts[2] && method === "GET") {
        const upload = await market.get("uploads", parts[2]);
        if (!upload) fail(404, "Image not found.");
        if (upload.private) {
          const user = await requireUser(req, ["ADMIN", "RIDER"]);
          if (user.role !== "ADMIN" && upload.owner_id !== user.id)
            fail(404, "Image not found.");
        }
        let bytes;
        try {
          bytes = readFileSync(resolve(uploadsDir, upload.id));
        } catch {
          fail(404, "Image file not found.");
        }
        res.writeHead(200, {
          "Content-Type": upload.mime,
          "Cache-Control": upload.private
            ? "private, no-store"
            : "public, max-age=86400",
          "X-Content-Type-Options": "nosniff",
        });
        return res.end(bytes);
      }
      if (path === "/api/images" && method === "POST") {
        const user = await requireUser(req, ["ADMIN", "RIDER", "CUSTOMER"]);
        const bytes = await rawBody(req, 5000000);
        const png = bytes
          .subarray(0, 8)
          .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
        const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
        const webp =
          bytes.subarray(0, 4).toString() === "RIFF" &&
          bytes.subarray(8, 12).toString() === "WEBP";
        const mime = png
          ? "image/png"
          : jpeg
            ? "image/jpeg"
            : webp
              ? "image/webp"
              : null;
        if (!mime || req.headers["content-type"] !== mime)
          fail(400, "Upload a JPEG, PNG, or WebP image under 5 MB.");
        const key = randomUUID();
        mkdirSync(resolve(uploadsDir), { recursive: true });
        const target = resolve(uploadsDir, key);
        writeFileSync(target, bytes, { flag: "wx" });
        try {
          await market
            .ref("uploads", key)
            .create({
              id: key,
              owner_id: user.id,
              mime,
              private: user.role !== "ADMIN",
              created_at: market.now(),
            });
        } catch (error) {
          unlinkSync(target);
          throw error;
        }
        return send(res, 201, { url: `/api/images/${key}` });
      }
      if (path === "/api/events" && method === "GET") {
        const user = await requireUser(req);
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
        });
        res.write("event: change\ndata: {}\n\n");
        let closed = false;
        const updates = [];
        const changed = () => {
          if (!closed) res.write("event: change\ndata: {}\n\n");
        };
        const stop = () => {
          if (closed) return;
          closed = true;
          clearInterval(heartbeat);
          updates.forEach((unsubscribe) => unsubscribe());
        };
        let query = root.collection("orders");
        if (user.role === "CUSTOMER")
          query = query.where("user_id", "==", user.id);
        if (user.role === "RIDER")
          query = query.where("assignment.rider_id", "==", user.id);
        for (const q of [
          query,
          root.collection("notifications").where("user_id", "==", user.id),
          root.collection("products"),
          root.collection("recipes"),
          root.collection("categories"),
        ])
          updates.push(q.onSnapshot(changed, () => res.end()));
        let checking = false;
        const heartbeat = setInterval(async () => {
          if (checking || closed) return;
          checking = true;
          try {
            const current = await authService.session(requestSessionCookie(req,origin));
            if (
              !current ||
              current.id !== user.id ||
              current.role !== user.role
            ) {
              stop();
              res.end();
            } else res.write(": heartbeat\n\n");
          } catch {
            stop();
            res.end();
          } finally {
            checking = false;
          }
        }, 25000);
        req.on("close", stop);
        res.on("close", stop);
        return;
      }
      if (parts[1] === "notifications") {
        const user = await requireUser(req);
        if (method === "GET")
          return send(res, 200, await market.notifications(user));
        if (method === "PATCH" && parts[2]) {
          await market.readNotification(user, parts[2]);
          return send(res, 200, { ok: true });
        }
        if (method === "DELETE" && !parts[2]) {
          await market.clearNotifications(user);
          return send(res, 200, { ok: true });
        }
      }
      if (path === "/api/cart") {
        const user = await requireUser(req, ["CUSTOMER"]);
        if (method === "GET") return send(res, 200, await market.cart(user));
        if (method === "PUT")
          return send(res, 200, await market.saveCart(user, await body(req)));
      }
      if (path === "/api/payments/webhook" && method === "POST") {
        if (!paystackKey) fail(503, "Payments not configured.");
        const raw = await rawBody(req);
        const signature = req.headers["x-paystack-signature"];
        if (
          typeof signature !== "string" ||
          !/^[a-f0-9]{128}$/.test(signature) ||
          !timingSafeEqual(
            createHmac("sha512", paystackKey).update(raw).digest(),
            Buffer.from(signature, "hex"),
          )
        )
          fail(401, "Invalid webhook signature.");
        let payload;
        try {
          payload = JSON.parse(raw.toString());
        } catch {
          fail(400, "Invalid webhook payload.");
        }
        if (payload.event === "charge.success")
          await market.verifyPayment(
            schema.identifier.parse(payload.data?.reference),
          );
        return send(res, 200, { ok: true });
      }
      if (parts[1] === "payments" && parts[2]) {
        const user = await requireUser(req, ["CUSTOMER", "ADMIN"]);
        const reference = schema.identifier.parse(parts[2]);
        await market.payment(user, reference);
        if (method === "POST" && parts[3] === "initialize")
          return send(
            res,
            200,
            await market.initializePayment(user, reference),
          );
        if (method === "POST" && parts[3] === "verify") {
          const payment = await market.verifyPayment(reference);
          return send(res, 200, {
            status: payment.status,
            orderId: payment.order_id,
          });
        }
      }
      if (parts[1] === "orders") {
        const user = await requireUser(req);
        if (method === "GET")
          return send(
            res,
            200,
            parts[2]
              ? await market.orderDetails(parts[2], user)
              : await market.orders(user),
          );
        if (method === "POST" && !parts[2]) {
          if (user.role !== "CUSTOMER") fail(403, "Customer required.");
          await market.expireReservations();
          return send(res, 201, await market.checkout(user, await body(req)));
        }
        if (method === "POST" && parts[2] && parts[3])
          return send(
            res,
            200,
            await market.orderAction(user, parts[2], parts[3], await body(req)),
          );
      }
      if (parts[1] === "admin") {
        const user = await requireUser(req, ["ADMIN"]);
        const section = parts[2];
        const key = parts[3];
        if (section === "media" && method === "GET")
          return send(res, 200, (await market.list("uploads")).filter(image => !image.private).map(image => ({url: `/api/images/${image.id}`, name: image.label || "Uploaded image"})));
        if (section === "overview" && method === "GET")
          return send(res, 200, await market.overview(user));
        if (section === "products") {
          if (method === "GET")
            return send(res, 200, await market.products(true));
          if (method === "POST" || method === "PUT")
            return send(
              res,
              200,
              await market.saveProduct(
                user,
                await body(req),
                method === "PUT" ? schema.identifier.parse(key) : undefined,
              ),
            );
          if (method === "DELETE" && key) {
            await market.archive(user, "products", key);
            return send(res, 200, { ok: true });
          }
        }
        if (section === "categories") {
          if (method === "POST" || method === "PUT")
            return send(
              res,
              200,
              await market.saveCategory(
                user,
                await body(req),
                method === "PUT" ? schema.identifier.parse(key) : undefined,
              ),
            );
          if (method === "DELETE" && key) {
            await market.deleteCategory(user, key);
            return send(res, 200, { ok: true });
          }
        }
        if (section === "recipes") {
          if (method === "GET")
            return send(res, 200, await market.recipes(true));
          if (method === "POST" || method === "PUT")
            return send(
              res,
              200,
              await market.saveRecipe(
                user,
                await body(req),
                method === "PUT" ? schema.identifier.parse(key) : undefined,
              ),
            );
          if (method === "DELETE" && key) {
            await market.archive(user, "recipes", key);
            return send(res, 200, { ok: true });
          }
        }
        if (section === "customers" && method === "GET")
          return send(
            res,
            200,
            (await market.list("users")).map((u) => ({
              ...publicProfile(u),
              contactConsent: !!u.contactConsent,
            })),
          );
        if (section === "riders" && method === "POST") {
          if (!authAdmin) fail(503, "Firebase account management unavailable.");
          const data = schema.z
            .object({
              email: schema.z.string().email().max(254),
              password: schema.z.string().min(12).max(128),
              name: schema.text,
              phone: schema.z.string().regex(/^(?:0\d{10}|\+234\d{10})$/),
            })
            .parse(await body(req));
          let created;
          try {
            created = await authAdmin.createUser({
              email: data.email.toLowerCase(),
              password: data.password,
              displayName: data.name,
            });
            const profile = {
              id: created.uid,
              email: data.email.toLowerCase(),
              name: data.name,
              phone: data.phone,
              role: "RIDER",
              contactConsent: false,
              createdAt: market.now(),
            };
            await market.db.runTransaction(async (tx) => {
              tx.create(market.ref("users", created.uid), profile);
              market.audit(tx, user, "rider.create", created.uid);
            });
            return send(res, 201, publicProfile(profile));
          } catch (error) {
            if (created) await authAdmin.deleteUser(created.uid);
            if (error.code === "auth/email-already-exists")
              fail(409, "Email already exists.");
            throw error;
          }
        }
        if (section === "settings") {
          if (method === "GET") return send(res, 200, await market.config());
          if (method === "PUT")
            return send(
              res,
              200,
              await market.saveSettings(user, await body(req)),
            );
        }
        if (
          ["payments", "inventory", "reviews"].includes(section) &&
          method === "GET"
        ) {
          const collection =
            section === "inventory" ? "inventory_transactions" : section;
          let list = await market.list(collection);
          list.sort((a, b) =>
            (b.created_at || b.verified_at || "").localeCompare(
              a.created_at || a.verified_at || "",
            ),
          );
          if (section === "payments")
            list = list.map((p) => ({ ...p, amount: p.amount / 100 }));
          return send(res, 200, list.slice(0, 500));
        }
      }
      fail(404, "Endpoint not found.");
    } catch (error) {
      if (res.headersSent) {
        res.end();
        return;
      }
      if (error instanceof schema.z.ZodError)
        return send(res, 400, {
          error: error.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("; "),
        });
      if ([6, "already-exists"].includes(error.code))
        return send(res, 409, { error: "This record already exists." });
      if ([8,"resource-exhausted"].includes(error.code))
        return send(res, 503, {error:"Firebase's usage quota has been reached. Please try again after the quota resets."});
      if (!error.status) console.error("Firebase request failed", {code: error.code || "unknown", type: error.name || "Error"});
      return send(res, error.status || 503, {
        error: error.status
          ? error.message
          : "The Firebase backend is unavailable. Please retry.",
      });
    }
  });
  let housekeepingBusy = false;
  const housekeeping = setInterval(async () => {
    if (housekeepingBusy) return;
    housekeepingBusy = true;
    try {
      await market.expireReservations();
      await market.cleanupLocations();
    } catch {
      console.error("Firestore housekeeping failed; retrying next cycle.");
    } finally {
      housekeepingBusy = false;
    }
  }, 60000);
  housekeeping.unref();
  server.on("close", () => clearInterval(housekeeping));
  return { server, market };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const { app, db, auth } = firebaseServices();
  let identity;
  try {
    identity = await firebaseProjectIdentityProvider(app);
  } catch (error) {
    console.error(error.status ? error.message : "Firebase setup failed.");
    await db.terminate();
    process.exit(1);
  }
  const authService = createFirebaseAuthService({
    auth,
    store: firestoreAuthStore(db),
    identity,
  });
  const { server } = createFirebaseMarketplace({
    db,
    authService,
    authAdmin: auth,
  });
  const port = Number(process.env.FIREBASE_MARKETPLACE_PORT || 3003);
  server.listen(port, "127.0.0.1", () =>
    console.log(
      `Firestore marketplace validation API: http://127.0.0.1:${port}. Frontend remains on its existing API.`,
    ),
  );
}
