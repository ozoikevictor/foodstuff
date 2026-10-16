import { z } from "zod";
export const text = z.string().trim().min(1).max(500);
export const identifier = z
  .string()
  .min(1)
  .max(150)
  .regex(/^[a-zA-Z0-9_-]+$/);
export const image = z.string().regex(/^\/api\/images\/[a-f0-9-]+$/);
export const coords = {
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
};
const money = z
  .number()
  .finite()
  .positive()
  .max(100000000)
  .refine(
    (v) => Math.abs(v * 100 - Math.round(v * 100)) < 0.00001,
    "Use at most two decimal places.",
  );
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
const slug = z
  .string()
  .max(150)
  .regex(/^[a-z0-9-]+$/);
export const variant = z.object({
  id: z.string().uuid().optional(),
  unit,
  label: text,
  price: money,
  originalPrice: money.nullable().optional(),
  stock: z.number().int().min(0).max(1000000),
  lowStock: z.number().int().min(0).default(5),
  active: z.boolean().default(true),
});
export const product = z.object({
  perishable: z.boolean().default(false),
  orderStart: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).default("08:00"),
  orderCutoff: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).default("14:00"),
  name: text,
  slug,
  categorySlug: slug,
  description: z.string().trim().min(1).max(10000),
  images: z.array(image).min(1).max(8),
  available: z.boolean().default(true),
  featured: z.boolean().default(false),
  tags: z
    .array(z.enum(["deal", "popular", "recommended", "wholesale", "essential"]))
    .default([]),
  options: z.array(variant).min(1).max(30),
}).refine(p => !p.perishable || p.orderStart < p.orderCutoff, "Ordering cutoff must be after the opening time.");
export const category = z.object({
  slug,
  name: text,
  image,
  blurb: z.string().max(500).default(""),
  parentSlug: slug.nullable().default(null),
});
export const recipe = z.object({
  slug,
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
  ingredientNotes: z.array(text).max(100).default([]),
  sources: z.array(z.object({ title: text, url: z.string().url().refine(v => v.startsWith("https://")) })).max(10).default([]),
  ingredients: z
    .array(
      z.object({
        variantId: z.string().uuid(),
        qty: z.number().int().min(1).max(1000),
        note: z.string().max(500).default(""),
      }),
    )
    .max(100),
}).refine(r => r.ingredients.length > 0 || r.ingredientNotes.length > 0, "Add measured ingredients or product variations.");
export const cart = z
  .array(
    z.object({
      variantId: z.string().uuid(),
      qty: z.number().int().min(1).max(1000),
    }),
  )
  .max(100);
export const checkout = z.object({
  deliveryPreference: z.enum(["standard", "within-1-hour", "within-2-hours"]).default("standard"),
  items: cart.refine((v) => v.length > 0, "Your basket is empty."),
  address: z.string().trim().min(10).max(1000),
  phone: z.string().regex(/^(?:0\d{10}|\+234\d{10})$/),
  zone: text,
  instructions: z.string().max(1000).default(""),
  idempotencyKey: z.string().uuid(),
  ...coords,
});
export const settings = z.object({
  zones: z
    .array(
      z.object({
        name: text,
        fee: z
          .number()
          .min(0)
          .max(1000000)
          .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 0.00001),
      }),
    )
    .max(100),
  supportPhone: z.string().max(30),
  pickup: z.object({ ...coords, address: text }).nullable(),
});
export const rating = z.object({
  speed: z.number().int().min(1).max(5),
  professionalism: z.number().int().min(1).max(5),
  freshness: z.number().int().min(1).max(5),
  quality: z.number().int().min(1).max(5),
  overall: z.number().int().min(1).max(5),
  comment: z.string().max(3000).default(""),
});
export { z };
