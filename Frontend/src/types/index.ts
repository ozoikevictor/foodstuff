// Shared domain types. Mirror these on your backend API responses.

export type MeasurementUnit =
  | "kg"
  | "g"
  | "piece"
  | "basket"
  | "cup"
  | "derica"
  | "litre"
  | "carton"
  | "bag"
  | "paint"
  | "tuber"
  | "bottle";

export interface MeasurementOption {
  id?: string;
  stock?: number;
  lowStock?: number;
  active?: boolean;
  originalPrice?: number | null;
  unit: MeasurementUnit;
  label: string; // e.g. "1 kg", "50kg bag"
  price: number; // naira, for one of this unit
}

export interface Category {
  slug: string;
  name: string;
  image: string;
  tint: string; // tailwind bg class from design tokens
  blurb: string;
}

export interface Product {
  perishable?: boolean;
  orderStart?: string;
  orderCutoff?: string;
  ordering?: {open: boolean; start?: string; cutoff?: string; timezone?: string};
  available?: boolean;
  featured?: boolean;
  id: string;
  name: string;
  slug: string;
  categorySlug: string;
  storeSlug: string;
  images: string[];
  description: string;
  options: MeasurementOption[];
  oldPrice?: number | undefined; // price of options[0] before discount
  stock: number;
  rating: number;
  tags: Array<"deal" | "popular" | "recommended" | "wholesale" | "essential">;
}

export interface Store {
  slug: string;
  name: string;
  location: string;
  rating: number;
  reviews: number;
  banner: string;
  initials: string;
  since: number;
  about: string;
}

export interface RecipeIngredient {
  variantId?: string;
  productId: string;
  unit: MeasurementUnit;
  qty: number;
  note: string;
}

export interface Recipe {
  ingredientNotes?: string[];
  sources?: { title: string; url: string }[];
  cookingTime?: string;
  category?: string;
  video?: string;
  published?: boolean;
  slug: string;
  name: string;
  image: string;
  prepTime: string;
  serves: number;
  difficulty: "Easy" | "Medium" | "Hard";
  description: string;
  ingredients: RecipeIngredient[];
  steps: string[];
}

export interface CartItem {
  variantId?: string;
  key: string; // productId:unit
  productId: string;
  name: string;
  image: string;
  unit: MeasurementUnit;
  unitLabel: string;
  price: number;
  qty: number;
}

export type OrderStatus = "Processing" | "Out for delivery" | "Delivered" | "Cancelled";

export interface Order {
  id: string;
  date: string;
  status: OrderStatus;
  total: number;
  items: { name: string; qty: number; unitLabel: string; image: string }[];
}

export interface Address {
  id: string;
  label: string;
  line: string;
  city: string;
  state: string;
  phone: string;
  isDefault?: boolean;
}

export interface User {
  role?: "ADMIN" | "CUSTOMER" | "RIDER";
  contactConsent?: boolean;
  id: string;
  name: string;
  email: string;
  phone: string;
  avatarInitials: string;
  photoUrl?: string;
  memberSince: string;
}

export interface ProductFilters {
  q?: string | undefined;
  category?: string | undefined;
  min?: number | undefined;
  max?: number | undefined;
  inStock?: boolean | undefined;
  sort?: "relevance" | "price-asc" | "price-desc" | "rating" | undefined;
}
