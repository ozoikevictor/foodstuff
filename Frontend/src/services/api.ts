import { queryOptions } from "@tanstack/react-query";
import { tabHeaders } from "@/lib/test-tab-session";
import type { Category, Product, ProductFilters, Recipe, Store } from "@/types";
import heroImage from "@/assets/hero.jpg";
export { heroImage };
export const DELIVERY_FEE = 0;
export async function request<T = any>(path: string, method = "GET", data?: unknown): Promise<T> {
  const base =
    typeof window === "undefined" ? process.env["API_ORIGIN"] || "http://127.0.0.1:3003" : "";
  const response = await fetch(`${base}/api${path}`, {
    method,
    credentials: "same-origin",
    headers: {
      ...tabHeaders(),
      ...(data === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
  if (!response.headers.get("content-type")?.includes("application/json"))
    throw new Error("The backend connection is unavailable. Please try again shortly.");
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Request failed. Please retry.");
  return result as T;
}
export const basePrice = (p: Product) => p.options[0]?.price ?? 0;
export const api = {
  getCategories: () => request<Category[]>("/categories"),
  getCategory: async (slug: string) =>
    (await api.getCategories()).find((c) => c.slug === slug) ?? null,
  getProducts: async (f: ProductFilters = {}) => {
    const cats = f.q ? await api.getCategories() : [];
    const search = f.q?.trim().toLowerCase();
    const products = (await request<Product[]>("/products")).filter(
      (p) =>
        (!search ||
          p.name.toLowerCase().includes(search) ||
          cats
            .find((c) => c.slug === p.categorySlug)
            ?.name.toLowerCase()
            .includes(search)) &&
        (!f.category || p.categorySlug === f.category) &&
        (f.min == null || basePrice(p) >= f.min) &&
        (f.max == null || basePrice(p) <= f.max) &&
        (!f.inStock || p.stock > 0),
    );
    if (f.sort === "price-asc") products.sort((a, b) => basePrice(a) - basePrice(b));
    if (f.sort === "price-desc") products.sort((a, b) => basePrice(b) - basePrice(a));
    return products;
  },
  getProduct: (id: string) => request<Product | null>(`/products/${encodeURIComponent(id)}`),
  getStores: async (): Promise<Store[]> => [],
  getStore: async (_slug: string): Promise<Store | null> => null,
  getRecipes: () => request<Recipe[]>("/recipes"),
  getRecipe: (slug: string) => request<Recipe | null>(`/recipes/${encodeURIComponent(slug)}`),
};
export const q = {
  categories: () =>
    queryOptions({
      queryKey: ["categories"],
      queryFn: api.getCategories,
      staleTime: 300000,
      retry: false,
    }),
  category: (slug: string) =>
    queryOptions({ queryKey: ["category", slug], queryFn: () => api.getCategory(slug) }),
  products: (f: ProductFilters = {}) =>
    queryOptions({
      queryKey: ["products", f],
      queryFn: () => api.getProducts(f),
      staleTime: 300000,
      retry: false,
    }),
  product: (id: string) =>
    queryOptions({
      queryKey: ["product", id],
      queryFn: () => api.getProduct(id),
      staleTime: 300000,
      retry: false,
    }),
  stores: () => queryOptions({ queryKey: ["stores"], queryFn: api.getStores }),
  store: (slug: string) =>
    queryOptions({ queryKey: ["store", slug], queryFn: () => api.getStore(slug) }),
  recipes: () =>
    queryOptions({
      queryKey: ["recipes"],
      queryFn: api.getRecipes,
      staleTime: 300000,
      retry: false,
    }),
  recipe: (slug: string) =>
    queryOptions({
      queryKey: ["recipe", slug],
      queryFn: () => api.getRecipe(slug),
      staleTime: 300000,
      retry: false,
    }),
};
