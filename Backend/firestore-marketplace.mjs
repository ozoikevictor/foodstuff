import { randomUUID, randomBytes, createHash } from "node:crypto";
import { authError } from "./firebase-auth.mjs";
import * as schema from "./firestore-schemas.mjs";
import {orderingStatus} from "./perishable.mjs";

const id = () => randomUUID();
const hash = (value) => createHash("sha256").update(value).digest("hex");
const fail = (status, message) => {
  throw authError(status, message);
};
export const liveStatuses = ["Out for Delivery", "Arriving Soon"];
const finalStatuses = [
  "Completed",
  "Cancelled",
  "Returned",
  "Delivery Failed",
  "Disputed",
];
const statusTransitions = {
  "Payment Confirmed": ["Order Confirmed"],
  "Order Confirmed": ["Preparing Your Order"],
  "Preparing Your Order": ["Ready for Dispatch"],
  "Out for Delivery": ["Delivery Failed"],
  "Arriving Soon": ["Delivery Failed"],
  Completed: ["Returned"],
};

export class FirestoreMarketplace {
  constructor({ db, root = db, clock = () => Date.now(), payments = null }) {
    this.db = db;
    this.root = root;
    this.clock = clock;
    this.payments = payments;
  }
  ref(collection, key) {
    schema.identifier.parse(key);
    return this.root.collection(collection).doc(key);
  }
  now() {
    return new Date(this.clock()).toISOString();
  }
  async get(collection, key, tx) {
    const ref = this.ref(collection, key);
    const doc = await (tx ? tx.get(ref) : ref.get());
    return doc.exists ? doc.data() : null;
  }
  async list(collection, conditions = [], tx) {
    let query = this.root.collection(collection);
    for (const [field, operator, value] of conditions)
      query = query.where(field, operator, value);
    const snapshot = await (tx ? tx.get(query) : query.get());
    return snapshot.docs.map((d) => d.data());
  }
  async adminIds(tx) {
    return (await this.list("users", [["role", "==", "ADMIN"]], tx)).map(
      (u) => u.id,
    );
  }
  audit(tx, user, action, entity) {
    const key = id();
    tx.create(this.ref("audit_log", key), {
      id: key,
      actor_id: user.id,
      action,
      entity_id: entity,
      created_at: this.now(),
    });
  }
  notify(tx, userId, message, orderId = null) {
    const key = id();
    tx.create(this.ref("notifications", key), {
      id: key,
      user_id: userId,
      order_id: orderId,
      message,
      read_at: null,
      created_at: this.now(),
    });
  }
  notifyAdmins(tx, admins, message, orderId = null) {
    admins.forEach((uid) => this.notify(tx, uid, message, orderId));
  }
  track(tx, order, status, user, admins, note = "") {
    order.status = status;
    order.events.push({
      id: id(),
      status,
      actor_id: user.id,
      note,
      created_at: this.now(),
    });
    this.notify(
      tx,
      order.user_id,
      `Your order ${order.id}: ${status}.`,
      order.id,
    );
    this.notifyAdmins(tx, admins, `${order.id}: ${status}`, order.id);
  }
  inventory(tx, v, delta, reason, user, orderId = null) {
    const key = id();
    tx.create(this.ref("inventory_transactions", key), {
      id: key,
      variant_id: v.id,
      name: v.productName,
      label: v.label,
      actor_id: user.id,
      order_id: orderId,
      delta,
      reason,
      created_at: this.now(),
    });
  }
  async config() {
    return (
      (await this.get("settings", "website")) || {
        zones: [],
        supportPhone: "",
        pickup: null,
      }
    );
  }
  async saveSettings(user, input) {
    const data = schema.settings.parse(input);
    if (new Set(data.zones.map((z) => z.name)).size !== data.zones.length)
      fail(400, "Delivery zone names must be unique.");
    await this.db.runTransaction(async (tx) => {
      tx.set(this.ref("settings", "website"), data);
      this.audit(tx, user, "settings.save", "website");
    });
    return data;
  }
  async saveCategory(user, input, key) {
    const c = schema.category.parse(input);
    if (key && key !== c.slug) fail(400, "Category slug cannot be changed.");
    if (c.parentSlug === c.slug)
      fail(400, "Category cannot be its own parent.");
    await this.db.runTransaction(async (tx) => {
      const upload = await this.get("uploads", c.image.split("/").at(-1), tx);
      if (!upload || upload.private)
        fail(400, "Upload a public category image first.");
      const seen = new Set([c.slug]);
      let parent = c.parentSlug;
      while (parent) {
        if (seen.has(parent))
          fail(400, "Category hierarchy would contain a cycle.");
        seen.add(parent);
        const row = await this.get("categories", parent, tx);
        if (!row) fail(400, "Parent category not found.");
        parent = row.parentSlug;
      }
      tx.set(this.ref("categories", c.slug), { ...c, tint: "bg-leaf" });
      this.audit(tx, user, "category.save", c.slug);
    });
    return { ...c, tint: "bg-leaf" };
  }
  async deleteCategory(user, key) {
    await this.db.runTransaction(async (tx) => {
      const products = await this.list(
        "products",
        [["categorySlug", "==", key]],
        tx,
      );
      const children = await this.list(
        "categories",
        [["parentSlug", "==", key]],
        tx,
      );
      if (products.length || children.length)
        fail(409, "This category still has products or subcategories.");
      tx.delete(this.ref("categories", key));
      this.audit(tx, user, "category.delete", key);
    });
  }
  async saveProduct(user, input, key) {
    const p = schema.product.parse(input);
    const productId = key || id();
    if (new Set(p.options.map((v) => v.label)).size !== p.options.length)
      fail(400, "Variation labels must be unique.");
    const ids = p.options.filter((v) => v.id).map((v) => v.id);
    if (new Set(ids).size !== ids.length) fail(400, "Duplicate variations.");
    const options = p.options.map((v) => ({ ...v, id: v.id || id() }));
    await this.db.runTransaction(async (tx) => {
      const existing = await this.get("products", productId, tx);
      if (key && !existing) fail(404, "Product not found.");
      const category = await this.get("categories", p.categorySlug, tx);
      if (!category) fail(400, "Category not found.");
      const slugOwner = await this.get("product_slugs", p.slug, tx);
      if (slugOwner && slugOwner.productId !== productId)
        fail(409, "Product slug already exists.");
      for (const path of p.images) {
        const upload = await this.get("uploads", path.split("/").at(-1), tx);
        if (!upload || upload.private)
          fail(400, "Upload public product images first.");
      }
      const oldVariants = await this.list(
        "variants",
        [["productId", "==", productId]],
        tx,
      );
      for (const v of options) {
        if (
          v.id &&
          ids.includes(v.id) &&
          !oldVariants.some((old) => old.id === v.id)
        )
          fail(400, "Invalid variation identity.");
      }
      const { options: ignored, ...fields } = p;
      for (const old of oldVariants)
        if (!options.some((v) => v.id === old.id))
          tx.update(this.ref("variants", old.id), { active: false });
      for (const v of options) {
        const old = oldVariants.find((o) => o.id === v.id);
        const stored = {
          ...v,
          productId,
          productName: p.name,
          price: Math.round(v.price * 100),
          originalPrice: v.originalPrice
            ? Math.round(v.originalPrice * 100)
            : null,
        };
        tx.set(this.ref("variants", v.id), stored);
        if (v.stock !== (old?.stock || 0))
          this.inventory(
            tx,
            stored,
            v.stock - (old?.stock || 0),
            "Admin stock adjustment",
            user,
          );
      }
      tx.set(this.ref("products", productId), {
        ...fields,
        id: productId,
        created_at: existing?.created_at || this.now(),
        variantIds: options.map((v) => v.id),
      });
      tx.set(this.ref("product_slugs", p.slug), { productId });
      if (existing && existing.slug !== p.slug)
        tx.delete(this.ref("product_slugs", existing.slug));
      this.audit(tx, user, "product.save", productId);
    });
    return this.product(productId, true);
  }
  async product(key, admin = false) {
    const p = await this.get("products", key);
    if (!p || (!admin && !p.available)) return null;
    const variants = await Promise.all(
      p.variantIds.map((v) => this.get("variants", v)),
    );
    const options = variants
      .filter((v) => v && (admin || v.active))
      .map((v) => ({
        ...v,
        price: v.price / 100,
        originalPrice: v.originalPrice ? v.originalPrice / 100 : null,
      }));
    if (!admin && !options.length) return null;
    return {
      ...p,
      options,
      ordering: orderingStatus(p, this.clock()),
      storeSlug: "",
      stock: p.available ? options.reduce((n, v) => n + v.stock, 0) : 0,
      rating: 0,
      oldPrice: options[0]?.originalPrice || null,
    };
  }
  async products(admin = false) {
    const list = await this.list("products");
    const values = await Promise.all(
      list.map((p) => this.product(p.id, admin)),
    );
    return values
      .filter(Boolean)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  async archive(user, collection, key) {
    await this.db.runTransaction(async (tx) => {
      if (!(await this.get(collection, key, tx)))
        fail(404, "Record not found.");
      tx.update(
        this.ref(collection, key),
        collection === "products" ? { available: false } : { published: false },
      );
      this.audit(tx, user, `${collection}.archive`, key);
    });
  }
  async saveRecipe(user, input, key) {
    const r = schema.recipe.parse(input);
    if (key && key !== r.slug) fail(400, "Recipe slug cannot be changed.");
    const ingredients = await this.db.runTransaction(async (tx) => {
      const upload = await this.get("uploads", r.image.split("/").at(-1), tx);
      if (!upload || upload.private)
        fail(400, "Upload a public recipe image first.");
      const old = await this.get("recipes", r.slug, tx);
      if (!key && old) fail(409, "Recipe slug already exists.");
      const lines = [];
      for (const i of r.ingredients) {
        const v = await this.get("variants", i.variantId, tx);
        if (!v) fail(400, "Ingredient variation not found.");
        lines.push({ ...i, productId: v.productId, unit: v.unit });
      }
      tx.set(this.ref("recipes", r.slug), { ...r, ingredients: lines });
      this.audit(tx, user, "recipe.save", r.slug);
      return lines;
    });
    return { ...r, ingredients };
  }
  async recipes(admin = false) {
    return (await this.list("recipes"))
      .filter((r) => admin || r.published)
      .sort((a, b) => a.name.localeCompare(b.name));
  }
  async ownedOrder(key, user, tx) {
    const o = await this.get("orders", key, tx);
    if (!o) fail(404, "Order not found.");
    if (
      user.role !== "ADMIN" &&
      o.user_id !== user.id &&
      !(user.role === "RIDER" && o.assignment?.rider_id === user.id)
    )
      fail(404, "Order not found.");
    return o;
  }
  async orderDetails(key, user) {
    const o = await this.ownedOrder(key, user);
    const rider = o.assignment
      ? await this.get("users", o.assignment.rider_id)
      : null;
    const active = liveStatuses.includes(o.status);
    const payment = await this.get("payments", o.paymentReference);
    const { location, evidence, assignment, ...rest } = o;
    return {
      ...rest,
      subtotal: o.subtotal / 100,
      delivery_fee: o.delivery_fee / 100,
      total: o.total / 100,
      items: o.items.map((i) => ({ ...i, price: i.price / 100 })),
      rider: rider
        ? {
            id: rider.id,
            name: rider.name,
            phone:
              rider.contactConsent && !finalStatuses.includes(o.status)
                ? rider.phone
                : null,
            assignmentStatus: assignment.status,
          }
        : null,
      location: active ? location : null,
      evidence: ["ADMIN", "RIDER"].includes(user.role) ? evidence : null,
      payment: payment
        ? {
            reference: payment.reference,
            status: payment.status,
            verified_at: payment.verified_at,
          }
        : null,
    };
  }
  async orders(user) {
    const conditions =
      user.role === "ADMIN"
        ? []
        : user.role === "RIDER"
          ? [["assignment.rider_id", "==", user.id]]
          : [["user_id", "==", user.id]];
    const list = await this.list("orders", conditions);
    const sorted = list.sort((a, b) =>
      b.created_at.localeCompare(a.created_at),
    );
    return Promise.all(sorted.map((o) => this.orderDetails(o.id, user)));
  }
  async checkout(user, input) {
    if (!this.payments)
      fail(
        503,
        "Online payments are not configured. Your basket has been kept.",
      );
    const data = schema.checkout.parse(input);
    const orderId = `CRB-${randomBytes(6).toString("hex").toUpperCase()}`;
    const paymentReference = `pay_${id().replaceAll("-", "")}`;
    const key = hash(`${user.id}:${data.idempotencyKey}`);
    const result = await this.db.runTransaction(async (tx) => {
      const duplicate = await this.get("checkout_keys", key, tx);
      if (duplicate) return duplicate.orderId;
      const config = await this.get("settings", "website", tx);
      const zone = config?.zones.find((z) => z.name === data.zone);
      if (!zone) fail(400, "Select an available delivery location.");
      const admins = await this.adminIds(tx);
      const quantities = new Map();
      data.items.forEach((i) =>
        quantities.set(i.variantId, (quantities.get(i.variantId) || 0) + i.qty),
      );
      const items = [];
      const variants = [];
      for (const [variantId, qty] of quantities) {
        const v = await this.get("variants", variantId, tx);
        const p = v ? await this.get("products", v.productId, tx) : null;
        if (!v || !p || !v.active || !p.available || v.stock < qty)
          fail(409, `${p?.name || "Product"} is unavailable in that quantity.`);
        const window=orderingStatus(p, this.clock());
        if (!window.open) fail(409, `${p.name} can only be ordered from ${window.start} to ${window.cutoff} Lagos time.`);
        if (p.perishable && data.deliveryPreference === "standard") fail(400, "Select a delivery preference for perishable items.");
        variants.push({ v, qty });
        items.push({
          id: id(),
          variant_id: v.id,
          product_id: p.id,
          name: p.name,
          image: p.images[0],
          label: v.label,
          unit: v.unit,
          qty,
          price: v.price,
          perishable: !!p.perishable,
        });
      }
      const subtotal = items.reduce((n, i) => n + i.price * i.qty, 0);
      const fee = Math.round(zone.fee * 100);
      if (
        !Number.isSafeInteger(subtotal + fee) ||
        subtotal + fee > 100000000000
      )
        fail(400, "Order total exceeds the supported limit.");
      const order = {
        id: orderId,
        user_id: user.id,
        status: "Order Placed",
        payment_status: "pending",
        subtotal,
        delivery_fee: fee,
        total: subtotal + fee,
        address: data.address,
        phone: data.phone,
        instructions: data.instructions,
        latitude: data.latitude,
        longitude: data.longitude,
        delivery_zone: data.zone,
        delivery_preference: data.deliveryPreference,
        created_at: this.now(),
        reserved_until: this.clock() + 30 * 60000,
        stock_released: false,
        paymentReference,
        items,
        events: [],
        assignment: null,
        location: null,
        evidence: null,
        confirmations: [],
        dispute: null,
        review: null,
      };
      for (const { v, qty } of variants) {
        tx.update(this.ref("variants", v.id), { stock: v.stock - qty });
        this.inventory(tx, v, -qty, "Checkout reservation", user, orderId);
        if (v.stock - qty <= v.lowStock)
          this.notifyAdmins(
            tx,
            admins,
            `Low stock: ${v.productName}, ${v.label}: ${v.stock - qty} remaining.`,
          );
      }
      this.track(tx, order, "Order Placed", user, admins);
      tx.create(this.ref("orders", orderId), order);
      tx.create(this.ref("payments", paymentReference), {
        reference: paymentReference,
        order_id: orderId,
        status: "pending",
        amount: order.total,
        authorization_url: null,
        verified_at: null,
        provider_id: null,
      });
      tx.create(this.ref("checkout_keys", key), { orderId, userId: user.id });
      return orderId;
    });
    return this.orderDetails(result, user);
  }
  async payment(user, reference) {
    const p = await this.get("payments", reference);
    if (!p) fail(404, "Payment not found.");
    const o = await this.ownedOrder(p.order_id, user);
    return { p, o };
  }
  async initializePayment(user, reference) {
    if (!this.payments) fail(503, "Payments are not configured.");
    const { p, o } = await this.payment(user, reference);
    if (
      o.stock_released ||
      o.reserved_until < this.clock() ||
      p.status !== "pending"
    )
      fail(409, "Payment window closed.");
    if (p.authorization_url) return { url: p.authorization_url };
    const owner = await this.get("users", o.user_id);
    const response = await this.payments.initialize({
      email: owner.email,
      amount: p.amount,
      reference,
    });
    await this.db.runTransaction(async (tx) => {
      const current = await this.get("payments", reference, tx);
      if (current.status !== "pending") fail(409, "Payment already processed.");
      tx.update(this.ref("payments", reference), {
        authorization_url: response.url,
      });
    });
    return response;
  }
  async verifyPayment(reference) {
    if (!this.payments) fail(503, "Payments are not configured.");
    const before = await this.get("payments", reference);
    if (!before) fail(404, "Payment not found.");
    if (["paid", "refund_required"].includes(before.status)) return before;
    const verified = await this.payments.verify(reference);
    if (
      verified.reference !== reference ||
      verified.currency !== "NGN" ||
      verified.amount !== before.amount
    )
      fail(409, "Payment details do not match the order.");
    if (verified.status === "success" && !verified.id)
      fail(502, "Verified payment is missing its provider identity.");
    return this.db.runTransaction(async (tx) => {
      const p = await this.get("payments", reference, tx);
      if (["paid", "refund_required"].includes(p.status)) return p;
      const o = await this.get("orders", p.order_id, tx);
      const admins = await this.adminIds(tx);
      const providerKey = verified.id ? hash(String(verified.id)) : null;
      const provider = providerKey
        ? await this.get("payment_provider_ids", providerKey, tx)
        : null;
      if (provider && provider.reference !== reference)
        fail(409, "Payment was already applied to another order.");
      const failed = ["failed", "abandoned"].includes(verified.status);
      const success = verified.status === "success";
      const expired = o.reserved_until < this.clock();
      const restore = !o.stock_released && ((success && expired) || failed);
      const variants = restore
        ? await Promise.all(
            o.items.map((i) => this.get("variants", i.variant_id, tx)),
          )
        : [];
      if (!success && !failed) return { ...p, status: verified.status };
      if (restore)
        this.restore(
          tx,
          o,
          variants,
          { id: o.user_id },
          success
            ? "Late payment reservation expired"
            : "Verified payment failure",
        );
      if (success) {
        p.status = o.stock_released ? "refund_required" : "paid";
        p.provider_id = String(verified.id);
        p.verified_at = this.now();
        o.payment_status = p.status;
        if (p.status === "paid")
          this.track(tx, o, "Payment Confirmed", { id: o.user_id }, admins);
        else {
          if (o.status === "Order Placed")
            this.track(
              tx,
              o,
              "Cancelled",
              { id: o.user_id },
              admins,
              "Reservation expired",
            );
          this.notifyAdmins(tx, admins, `Refund required for ${o.id}`, o.id);
        }
        tx.set(this.ref("payment_provider_ids", providerKey), { reference });
      } else {
        p.status = "failed";
        if (o.payment_status === "pending") {
          o.payment_status = "failed";
          this.track(
            tx,
            o,
            "Cancelled",
            { id: o.user_id },
            admins,
            "Verified payment failure",
          );
        }
      }
      tx.set(this.ref("payments", reference), p);
      tx.set(this.ref("orders", o.id), o);
      return p;
    });
  }
  restore(tx, order, variants, user, reason) {
    if (order.stock_released) return;
    order.items.forEach((i, n) => {
      const v = variants[n];
      if (!v)
        fail(
          409,
          "Reserved variation is missing; administrator review required.",
        );
      tx.update(this.ref("variants", v.id), { stock: v.stock + i.qty });
      this.inventory(tx, v, i.qty, reason, user, order.id);
    });
    order.stock_released = true;
  }
  async expireReservations() {
    const pending = await this.list("orders", [
      ["payment_status", "==", "pending"],
    ]);
    for (const row of pending) {
      if (row.stock_released || row.reserved_until >= this.clock()) continue;
      await this.db.runTransaction(async (tx) => {
        const o = await this.get("orders", row.id, tx);
        if (
          o.payment_status !== "pending" ||
          o.stock_released ||
          o.reserved_until >= this.clock()
        )
          return;
        const admins = await this.adminIds(tx);
        const variants = await Promise.all(
          o.items.map((i) => this.get("variants", i.variant_id, tx)),
        );
        this.restore(tx, o, variants, { id: o.user_id }, "Reservation expired");
        this.track(
          tx,
          o,
          "Cancelled",
          { id: o.user_id },
          admins,
          "Payment window expired",
        );
        tx.set(this.ref("orders", o.id), o);
      });
    }
  }
  async cleanupLocations() {
    const cutoff = new Date(this.clock() - 7 * 86400000).toISOString();
    const rows = await this.list("delivery_locations", [
      ["created_at", "<", cutoff],
    ]);
    let batch = this.db.batch();
    let count = 0;
    for (const row of rows) {
      const order = await this.get("orders", row.order_id);
      if (
        order &&
        ["Completed", "Cancelled", "Returned"].includes(order.status)
      ) {
        batch.delete(this.ref("delivery_locations", row.id));
        count++;
        if (count === 400) {
          await batch.commit();
          batch = this.db.batch();
          count = 0;
        }
      }
    }
    if (count) await batch.commit();
  }
  async orderAction(user, key, action, input = {}) {
    const data = action === "review" ? schema.rating.parse(input) : input;
    await this.db.runTransaction(async (tx) => {
      const o = await this.ownedOrder(key, user, tx);
      const admins = await this.adminIds(tx);
      const restore = action === "cancel" && !o.stock_released;
      const variants = restore
        ? await Promise.all(
            o.items.map((i) => this.get("variants", i.variant_id, tx)),
          )
        : [];
      const payment =
        action === "cancel"
          ? await this.get("payments", o.paymentReference, tx)
          : null;
      const rider =
        action === "assign"
          ? await this.get("users", schema.identifier.parse(data.riderId), tx)
          : null;
      const proof =
        action === "rider" && data.photo
          ? await this.get(
              "uploads",
              schema.image.parse(data.photo).split("/").at(-1),
              tx,
            )
          : null;
      if (action === "cancel") {
        if (
          user.role === "RIDER" ||
          !["Order Placed", "Payment Confirmed"].includes(o.status)
        )
          fail(409, "Order can no longer be cancelled.");
        if (restore) this.restore(tx, o, variants, user, "Order cancelled");
        this.track(tx, o, "Cancelled", user, admins);
        if (o.payment_status === "paid") {
          o.payment_status = "refund_required";
          tx.update(this.ref("payments", payment.reference), {
            status: "refund_required",
          });
          this.notifyAdmins(tx, admins, `Refund required for ${o.id}`, o.id);
        }
      } else if (action === "status") {
        if (user.role !== "ADMIN") fail(403, "Administrator required.");
        if (
          !(statusTransitions[o.status] || []).includes(data.status) ||
          o.payment_status !== "paid"
        )
          fail(409, "Invalid status transition.");
        this.track(
          tx,
          o,
          data.status,
          user,
          admins,
          schema.z
            .string()
            .max(1000)
            .parse(data.note || ""),
        );
        this.audit(tx, user, "order.status", o.id);
      } else if (action === "assign") {
        if (user.role !== "ADMIN") fail(403, "Administrator required.");
        if (o.status !== "Ready for Dispatch" || rider?.role !== "RIDER")
          fail(409, "Order must be ready and rider must be valid.");
        o.assignment = {
          rider_id: rider.id,
          status: "assigned",
          assigned_at: this.now(),
        };
        this.track(tx, o, "Rider Assigned", user, admins);
        this.notify(tx, rider.id, `New delivery assignment: ${o.id}`, o.id);
        this.audit(tx, user, "delivery.assign", o.id);
      } else if (action === "rider") {
        if (user.role !== "RIDER" || o.assignment?.rider_id !== user.id)
          fail(403, "Assigned rider required.");
        const a = schema.z
          .enum(["accept", "reject", "pickup", "start", "arriving", "deliver"])
          .parse(data.action);
        if (["accept", "reject"].includes(a)) {
          if (
            o.status !== "Rider Assigned" ||
            o.assignment.status !== "assigned"
          )
            fail(409, "Assignment already answered.");
          if (a === "accept") o.assignment.status = "accepted";
          else {
            o.assignment = null;
            this.track(
              tx,
              o,
              "Ready for Dispatch",
              user,
              admins,
              "Rider declined",
            );
          }
        } else if (a === "pickup") {
          if (
            o.status !== "Rider Assigned" ||
            o.assignment.status !== "accepted"
          )
            fail(409, "Accept assignment first.");
          o.assignment.status = "picked_up";
          o.events.push({
            id: id(),
            status: "Pickup Confirmed",
            actor_id: user.id,
            note: "",
            created_at: this.now(),
          });
          this.notify(tx, o.user_id, `Your rider has picked up ${o.id}.`, o.id);
          this.notifyAdmins(tx, admins, `Rider pickup: ${o.id}`, o.id);
        } else if (a === "start") {
          if (
            o.status !== "Rider Assigned" ||
            o.assignment.status !== "picked_up"
          )
            fail(409, "Confirm pickup first.");
          this.track(tx, o, "Out for Delivery", user, admins);
        } else if (a === "arriving") {
          if (o.status !== "Out for Delivery")
            fail(409, "Delivery is not active.");
          this.track(tx, o, "Arriving Soon", user, admins);
        } else {
          if (!liveStatuses.includes(o.status))
            fail(409, "Delivery is not active.");
          const notes = schema.z
            .string()
            .max(2000)
            .parse(data.notes || "");
          if (!data.photo && notes.trim().length < 10)
            fail(400, "Provide approved delivery evidence.");
          if (data.photo && (!proof?.private || proof.owner_id !== user.id))
            fail(400, "Invalid proof image.");
          o.evidence = {
            id: id(),
            order_id: o.id,
            rider_id: user.id,
            image: data.photo || null,
            notes,
            latitude:
              data.latitude === undefined
                ? null
                : schema.coords.latitude.parse(data.latitude),
            longitude:
              data.longitude === undefined
                ? null
                : schema.coords.longitude.parse(data.longitude),
            created_at: this.now(),
          };
          o.confirmations.push({
            kind: "RIDER",
            user_id: user.id,
            created_at: this.now(),
          });
          this.track(tx, o, "Rider Marked Delivered", user, admins);
        }
      } else if (action === "location") {
        if (
          user.role !== "RIDER" ||
          o.assignment?.rider_id !== user.id ||
          !liveStatuses.includes(o.status)
        )
          fail(403, "Location sharing unavailable.");
        const loc = schema.z
          .object({
            ...schema.coords,
            accuracy: schema.z.number().min(0).max(100000),
          })
          .parse(data);
        o.location = { ...loc, created_at: this.now() };
        const locationId = id();
        tx.create(this.ref("delivery_locations", locationId), {
          id: locationId,
          order_id: o.id,
          rider_id: user.id,
          ...o.location,
        });
      } else if (action === "confirm") {
        if (o.user_id !== user.id || o.status !== "Rider Marked Delivered")
          fail(409, "Delivery is not awaiting your confirmation.");
        o.confirmations.push({
          kind: "CUSTOMER",
          user_id: user.id,
          created_at: this.now(),
        });
        this.track(tx, o, "Customer Confirmed Received", user, admins);
        this.track(tx, o, "Completed", user, admins);
      } else if (action === "dispute") {
        if (
          o.user_id !== user.id ||
          !["Rider Marked Delivered", "Completed", "Delivery Failed"].includes(
            o.status,
          ) ||
          o.dispute
        )
          fail(409, "A new dispute is not available at this stage.");
        o.dispute = {
          id: id(),
          reason: schema.z.string().trim().min(10).max(3000).parse(data.reason),
          status: "open",
          created_at: this.now(),
        };
        this.track(tx, o, "Disputed", user, admins);
      } else if (action === "resolve") {
        if (user.role !== "ADMIN") fail(403, "Administrator required.");
        if (o.status !== "Disputed" || o.dispute?.status !== "open")
          fail(409, "No open dispute.");
        const resolution = schema.z
          .string()
          .trim()
          .min(20)
          .max(3000)
          .parse(data.resolution);
        const outcome = schema.z
          .enum(["Completed", "Returned"])
          .parse(data.outcome);
        o.dispute = {
          ...o.dispute,
          status: "resolved",
          resolution,
          resolved_by: user.id,
        };
        o.confirmations.push({
          kind: "ADMIN_RESOLUTION",
          user_id: user.id,
          created_at: this.now(),
        });
        this.track(tx, o, outcome, user, admins, resolution);
        this.audit(tx, user, "dispute.resolve", o.id);
      } else if (action === "review") {
        if (
          o.user_id !== user.id ||
          o.status !== "Completed" ||
          !o.confirmations.some((c) => c.kind === "CUSTOMER") ||
          o.review
        )
          fail(409, "Confirm receipt before leaving one review.");
        o.review = {
          ...data,
          order_id: o.id,
          user_id: user.id,
          created_at: this.now(),
        };
        tx.create(this.ref("reviews", o.id), o.review);
      } else fail(404, "Action not found.");
      if (!liveStatuses.includes(o.status)) o.location = null;
      tx.set(this.ref("orders", o.id), o);
    });
    return this.orderDetails(key, user);
  }
  async notifications(user) {
    return (await this.list("notifications", [["user_id", "==", user.id]]))
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 200);
  }
  async readNotification(user, key) {
    await this.db.runTransaction(async (tx) => {
      const n = await this.get("notifications", key, tx);
      if (n?.user_id !== user.id) fail(404, "Notification not found.");
      tx.update(this.ref("notifications", key), { read_at: this.now() });
    });
  }
  async clearNotifications(user) {
    const rows = await this.list("notifications", [["user_id", "==", user.id]]);
    for (let i = 0; i < rows.length; i += 400) {
      const batch = this.db.batch();
      rows
        .slice(i, i + 400)
        .filter((n) => n.read_at)
        .forEach((n) => batch.delete(this.ref("notifications", n.id)));
      await batch.commit();
    }
  }
  async cart(user) {
    return (await this.get("carts", user.id))?.items || [];
  }
  async saveCart(user, input) {
    const items = schema.cart.parse(input);
    await this.ref("carts", user.id).set({
      userId: user.id,
      items,
      updated_at: this.now(),
    });
    return { ok: true };
  }
  async overview(user) {
    const [products, orders, customers, variants, payments] = await Promise.all(
      [
        this.list("products"),
        this.list("orders"),
        this.list("users", [["role", "==", "CUSTOMER"]]),
        this.list("variants"),
        this.list("payments"),
      ],
    );
    const statuses = new Map();
    orders.forEach((o) =>
      statuses.set(o.status, (statuses.get(o.status) || 0) + 1),
    );
    const paid = payments.filter((p) => p.status === "paid");
    const day = (ms) => new Date(ms + 3600000).toISOString().slice(0, 10);
    const today = day(this.clock());
    const sales = new Map();
    paid.forEach((p) => {
      const d = day(Date.parse(p.verified_at));
      sales.set(d, (sales.get(d) || 0) + p.amount / 100);
    });
    return {
      products: products.length,
      customers: customers.length,
      orders: orders.length,
      revenue: paid.reduce((n, p) => n + p.amount / 100, 0),
      todaySales: sales.get(today) || 0,
      statuses: [...statuses].map(([status, count]) => ({ status, count })),
      lowStock: variants
        .filter((v) => v.active && v.stock <= v.lowStock)
        .map((v) => ({ ...v, name: v.productName, low_stock: v.lowStock })),
      sales: [...sales]
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-30)
        .map(([day, total]) => ({ day, total })),
      recentOrders: await Promise.all(
        orders
          .sort((a, b) => b.created_at.localeCompare(a.created_at))
          .slice(0, 10)
          .map((o) => this.orderDetails(o.id, user)),
      ),
    };
  }
}
