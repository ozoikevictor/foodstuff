import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Archive, Trash2 } from "lucide-react";
import { useApi } from "@/hooks/use-marketplace";
import { request } from "@/services/api";
import { naira } from "@/lib/format";
import {
  Field,
  fieldClass,
  commandClass,
  ErrorState,
  ImageUpload,
  Action,
  Loading,
} from "./shared";
const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
const blankVariant = () => ({
  unit: "kg",
  label: "1 kg",
  price: 0,
  originalPrice: null,
  stock: 0,
  lowStock: 5,
  active: true,
});
const blankProduct = () => ({
  name: "",
  slug: "",
  categorySlug: "",
  description: "",
  images: [] as string[],
  available: true,
  featured: false,
  tags: [] as string[],
  options: [blankVariant()],
  perishable: false,
  orderStart: "08:00",
  orderCutoff: "14:00",
});
export function CatalogManager({ kind }: { kind: "products" | "categories" | "recipes" }) {
  const client = useQueryClient();
  const result = useApi<any[]>(kind === "categories" ? "/categories" : `/admin/${kind}`);
  const { data: categories = [] } = useApi<any[]>("/categories");
  const { data: products = [] } = useApi<any[]>("/admin/products");
  const [draft, setDraft] = useState<any>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const change = (key: string, value: any) => setDraft((d: any) => ({ ...d, [key]: value }));
  function open(item?: any) {
    setError(undefined);
    setEditing(item ? (kind === "products" ? item.id : item.slug) : null);
    setDraft(
      item
        ? structuredClone(item)
        : kind === "products"
          ? blankProduct()
          : kind === "categories"
            ? { name: "", slug: "", image: "", blurb: "", parentSlug: null }
            : {
                name: "",
                slug: "",
                image: "",
                description: "",
                prepTime: "",
                cookingTime: "",
                serves: 4,
                difficulty: "Easy",
                category: "",
                video: "",
                steps: [""],
                ingredients: [],
                ingredientNotes: [],
                sources: [],
                published: false,
              },
    );
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      await request(
        `/admin/${kind}${editing ? `/${editing}` : ""}`,
        editing ? "PUT" : "POST",
        kind === "recipes" ? { ...draft, ingredientNotes: (draft.ingredientNotes || []).map((line: string) => line.trim()).filter(Boolean) } : draft,
      );
      await client.invalidateQueries();
      setDraft(null);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  if (result.isError) return <ErrorState error={result.error} />;
  if (!result.data) return <Loading />;
  return (
    <section>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold capitalize">{kind}</h1>
        <button className={commandClass} onClick={() => open()}>
          <Plus className="size-4" />
          Add {kind.slice(0, -1).replace("categorie", "category")}
        </button>
      </div>
      <input
        aria-label={`Search ${kind}`}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={`Search ${kind}`}
        className={`${fieldClass} mb-4 max-w-md`}
      />
      {!result.data.length && (
        <p className="py-12 text-center text-muted-foreground">No {kind} yet.</p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-xs uppercase text-muted-foreground">
            <tr>
              <th className="py-3">Name</th>
              <th>Status / stock</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {result.data
              .filter((item) => item.name.toLowerCase().includes(search.toLowerCase()))
              .map((item) => (
                <tr key={item.id || item.slug}>
                  <td className="py-3">
                    <div className="flex min-w-44 items-center gap-3">
                      <img
                        src={item.images?.[0] || item.image}
                        alt=""
                        className="size-12 rounded-md object-cover"
                      />
                      <div className="font-semibold">
                        {item.name}
                        {kind === "products" && (
                          <div className="mt-1 text-xs font-normal text-muted-foreground">
                            From {naira(item.options[0]?.price || 0)}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-3">
                    {kind === "products"
                      ? `${item.available ? "Available" : "Archived"} · ${item.stock} units`
                      : kind === "recipes"
                        ? item.published
                          ? "Published"
                          : "Draft"
                        : "Active"}
                  </td>
                  <td>
                    <div className="flex justify-end gap-2">
                      <button
                        title={`Edit ${item.name}`}
                        aria-label={`Edit ${item.name}`}
                        className="rounded-md p-2 hover:bg-accent"
                        onClick={() => open(item)}
                      >
                        <Pencil className="size-4" />
                      </button>
                      <Action
                        label={
                          kind === "categories"
                            ? "Delete"
                            : kind === "recipes"
                              ? "Unpublish"
                              : "Archive"
                        }
                        icon={<Archive className="size-4" />}
                        onClick={() => request(`/admin/${kind}/${item.id || item.slug}`, "DELETE")}
                      />
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {draft && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-black/40 p-3 sm:p-8"
          role="dialog"
          aria-modal="true"
          aria-label={`${editing ? "Edit" : "Add"} ${kind}`}
        >
          <div className="mx-auto max-w-3xl rounded-lg bg-card p-5 shadow-xl">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-bold">
                {editing ? "Edit" : "Add"} {kind}
              </h2>
              <button
                type="button"
                className="text-sm text-muted-foreground"
                onClick={() => setDraft(null)}
              >
                Close
              </button>
            </div>
            <form onSubmit={save} className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Name">
                  <input
                    required
                    value={draft.name}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        name: e.target.value,
                        ...(!editing ? { slug: slugify(e.target.value) } : {}),
                      })
                    }
                    className={fieldClass}
                  />
                </Field>
                <Field label="Slug">
                  <input
                    required
                    disabled={!!editing && kind !== "products"}
                    value={draft.slug}
                    onChange={(e) => change("slug", e.target.value)}
                    pattern="[a-z0-9-]+"
                    className={fieldClass}
                  />
                </Field>
              </div>
              {kind === "products" ? (
                <>
                  <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={!!draft.perishable} onChange={e => change("perishable", e.target.checked)} />Perishable goods</label>
                  {draft.perishable && <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Ordering opens (Lagos time)"><input type="time" required value={draft.orderStart || "08:00"} onChange={e => change("orderStart",e.target.value)} className={fieldClass} /></Field>
                    <Field label="Ordering cutoff (Lagos time)"><input type="time" required value={draft.orderCutoff || "14:00"} onChange={e => change("orderCutoff",e.target.value)} className={fieldClass} /></Field>
                  </div>}
                  <Field label="Category">
                    <select
                      required
                      value={draft.categorySlug}
                      onChange={(e) => change("categorySlug", e.target.value)}
                      className={fieldClass}
                    >
                      <option value="">Select category</option>
                      {categories.map((c) => (
                        <option key={c.slug} value={c.slug}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Description">
                    <textarea
                      required
                      rows={3}
                      value={draft.description}
                      onChange={(e) => change("description", e.target.value)}
                      className={fieldClass}
                    />
                  </Field>
                  <div>
                    <div className="mb-3 flex flex-wrap gap-3">
                      {draft.images.map((src: string, i: number) => (
                        <div key={src} className="relative">
                          <img
                            src={src}
                            alt={`Product ${i + 1}`}
                            className="size-20 rounded-md object-cover"
                          />
                          <button
                            type="button"
                            title="Remove image"
                            aria-label="Remove image"
                            className="absolute right-0 top-0 bg-white p-1"
                            onClick={() =>
                              change(
                                "images",
                                draft.images.filter((_: string, n: number) => n !== i),
                              )
                            }
                          >
                            <Trash2 className="size-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                    {draft.images.length < 8 && (
                      <ImageUpload onUploaded={(url) => change("images", [...draft.images, url])} />
                    )}
                  </div>
                  <h3 className="font-semibold">Variations</h3>
                  {draft.options.map((v: any, i: number) => (
                    <fieldset key={v.id || i} className="border-b border-border pb-4">
                      <legend className="mb-2 text-xs font-semibold text-muted-foreground">
                        Variation {i + 1}
                      </legend>
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        {[
                          ["label", "Quantity label", "text"],
                          ["price", "Selling price (NGN)", "number"],
                          ["originalPrice", "Original price (optional)", "number"],
                          ["stock", "Available units", "number"],
                          ["lowStock", "Low stock threshold", "number"],
                        ].map(([key, label, type]) => (
                          <Field key={key} label={label!}>
                            <input
                              required={key !== "originalPrice"}
                              type={type}
                              min={0}
                              step={key?.includes("rice") ? "0.01" : "1"}
                              value={v[key!] ?? ""}
                              onChange={(e) =>
                                change(
                                  "options",
                                  draft.options.map((o: any, n: number) =>
                                    n === i
                                      ? {
                                          ...o,
                                          [key!]:
                                            type === "number"
                                              ? e.target.value === ""
                                                ? null
                                                : Number(e.target.value)
                                              : e.target.value,
                                        }
                                      : o,
                                  ),
                                )
                              }
                              className={fieldClass}
                            />
                          </Field>
                        ))}
                        <Field label="Measurement unit">
                          <select
                            value={v.unit}
                            className={fieldClass}
                            onChange={(e) =>
                              change(
                                "options",
                                draft.options.map((o: any, n: number) =>
                                  n === i ? { ...o, unit: e.target.value } : o,
                                ),
                              )
                            }
                          >
                            {[
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
                            ].map((u) => (
                              <option key={u}>{u}</option>
                            ))}
                          </select>
                        </Field>
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={v.active}
                            onChange={(e) =>
                              change(
                                "options",
                                draft.options.map((o: any, n: number) =>
                                  n === i ? { ...o, active: e.target.checked } : o,
                                ),
                              )
                            }
                          />
                          Available
                        </label>
                        {!v.id && draft.options.length > 1 && (
                          <button
                            type="button"
                            className="text-sm text-destructive"
                            onClick={() =>
                              change(
                                "options",
                                draft.options.filter((_: any, n: number) => n !== i),
                              )
                            }
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </fieldset>
                  ))}
                  <button
                    type="button"
                    className="flex items-center gap-2 text-sm font-semibold text-primary"
                    onClick={() => change("options", [...draft.options, blankVariant()])}
                  >
                    <Plus className="size-4" />
                    Add variation
                  </button>
                  <div className="flex flex-wrap gap-5">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={draft.available}
                        onChange={(e) => change("available", e.target.checked)}
                      />
                      Product available
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={draft.featured}
                        onChange={(e) => change("featured", e.target.checked)}
                      />
                      Featured product
                    </label>
                  </div>
                  <Field label="Collection">
                    <select
                      className={fieldClass}
                      value={draft.tags[0] || ""}
                      onChange={(e) => change("tags", e.target.value ? [e.target.value] : [])}
                    >
                      <option value="">None</option>
                      {["deal", "popular", "recommended", "wholesale", "essential"].map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </Field>
                </>
              ) : kind === "categories" ? (
                <>
                  <Field label="Description">
                    <textarea
                      value={draft.blurb}
                      onChange={(e) => change("blurb", e.target.value)}
                      className={fieldClass}
                    />
                  </Field>
                  <Field label="Parent category">
                    <select
                      value={draft.parentSlug || ""}
                      onChange={(e) => change("parentSlug", e.target.value || null)}
                      className={fieldClass}
                    >
                      <option value="">Top-level category</option>
                      {categories
                        .filter((c) => c.slug !== draft.slug)
                        .map((c) => (
                          <option key={c.slug} value={c.slug}>
                            {c.name}
                          </option>
                        ))}
                    </select>
                  </Field>
                  {draft.image && (
                    <img
                      src={draft.image}
                      alt="Category"
                      className="size-24 rounded-md object-cover"
                    />
                  )}
                  <ImageUpload onUploaded={(url) => change("image", url)} />
                </>
              ) : (
                <>
                  <Field label="Description">
                    <textarea
                      required
                      value={draft.description}
                      onChange={(e) => change("description", e.target.value)}
                      className={fieldClass}
                    />
                  </Field>
                  {draft.image && (
                    <img
                      src={draft.image}
                      alt="Recipe"
                      className="h-36 w-52 rounded-md object-cover"
                    />
                  )}
                  <ImageUpload onUploaded={(url) => change("image", url)} />
                  <div className="grid gap-3 sm:grid-cols-2">
                    {[
                      ["prepTime", "Preparation time"],
                      ["cookingTime", "Cooking time"],
                      ["category", "Recipe category"],
                      ["video", "Video URL (optional)"],
                    ].map(([key, label]) => (
                      <Field key={key} label={label!}>
                        <input
                          required={key !== "video"}
                          value={draft[key!]}
                          onChange={(e) => change(key!, e.target.value)}
                          className={fieldClass}
                        />
                      </Field>
                    ))}
                    <Field label="Servings">
                      <input
                        type="number"
                        min={1}
                        max={1000}
                        required
                        value={draft.serves}
                        onChange={(e) => change("serves", Number(e.target.value))}
                        className={fieldClass}
                      />
                    </Field>
                    <Field label="Difficulty">
                      <select
                        value={draft.difficulty}
                        onChange={(e) => change("difficulty", e.target.value)}
                        className={fieldClass}
                      >
                        {["Easy", "Medium", "Hard"].map((d) => (
                          <option key={d}>{d}</option>
                        ))}
                      </select>
                    </Field>
                  </div>
                  <h3 className="font-semibold">Ingredients</h3>
                  <Field label="Measured ingredients (one per line)">
                    <textarea className={fieldClass} rows={6} value={(draft.ingredientNotes || []).join("\n")} onChange={e => change("ingredientNotes", e.target.value.split("\n"))} />
                  </Field>
                  {draft.ingredients.map((ing: any, i: number) => (
                    <div key={i} className="grid grid-cols-[1fr_70px_36px] items-end gap-2">
                      <Field label="Product variation">
                        <select
                          required
                          value={ing.variantId}
                          onChange={(e) =>
                            change(
                              "ingredients",
                              draft.ingredients.map((v: any, n: number) =>
                                n === i ? { ...v, variantId: e.target.value } : v,
                              ),
                            )
                          }
                          className={fieldClass}
                        >
                          <option value="">Select product</option>
                          {products.flatMap((p) =>
                            p.options.map((v: any) => (
                              <option key={v.id} value={v.id}>
                                {p.name} - {v.label}
                              </option>
                            )),
                          )}
                        </select>
                      </Field>
                      <Field label="Units">
                        <input
                          type="number"
                          min={1}
                          required
                          value={ing.qty}
                          onChange={(e) =>
                            change(
                              "ingredients",
                              draft.ingredients.map((v: any, n: number) =>
                                n === i ? { ...v, qty: Number(e.target.value) } : v,
                              ),
                            )
                          }
                          className={fieldClass}
                        />
                      </Field>
                      <button
                        type="button"
                        title="Remove ingredient"
                        aria-label="Remove ingredient"
                        className="p-2"
                        onClick={() =>
                          change(
                            "ingredients",
                            draft.ingredients.filter((_: any, n: number) => n !== i),
                          )
                        }
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="text-sm font-semibold text-primary"
                    onClick={() =>
                      change("ingredients", [
                        ...draft.ingredients,
                        { variantId: "", qty: 1, note: "" },
                      ])
                    }
                  >
                    Add ingredient
                  </button>
                  <h3 className="font-semibold">Cooking instructions</h3>
                  {draft.steps.map((s: string, i: number) => (
                    <Field key={i} label={`Step ${i + 1}`}>
                      <textarea
                        required
                        value={s}
                        onChange={(e) =>
                          change(
                            "steps",
                            draft.steps.map((v: string, n: number) =>
                              n === i ? e.target.value : v,
                            ),
                          )
                        }
                        className={fieldClass}
                      />
                    </Field>
                  ))}
                  <button
                    type="button"
                    className="text-sm font-semibold text-primary"
                    onClick={() => change("steps", [...draft.steps, ""])}
                  >
                    Add step
                  </button>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={draft.published}
                      onChange={(e) => change("published", e.target.checked)}
                    />
                    Published
                  </label>
                </>
              )}
              {!!error && <ErrorState error={error} />}
              <div className="flex justify-end gap-3 border-t border-border pt-4">
                <button type="button" onClick={() => setDraft(null)} className="px-4 text-sm">
                  Cancel
                </button>
                <button disabled={busy} className={commandClass}>
                  {busy ? "Saving..." : "Save changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
