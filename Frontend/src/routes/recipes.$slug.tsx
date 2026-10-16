import { createFileRoute, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/shop/AppShell";
import { Button } from "@/components/ui/button";
import { q } from "@/services/api";
import { naira } from "@/lib/format";
import { useAddToCart } from "@/hooks/use-hydrated-store";

export const Route = createFileRoute("/recipes/$slug")({
  loader: async ({ context, params }) => {
    const r = await context.queryClient.ensureQueryData(q.recipe(params.slug));
    if (!r) throw notFound();
    return { name: r.name, description: r.description };
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.name} recipe & ingredients — NaijaFresh` },
          { name: "description", content: loaderData.description },
          { property: "og:title", content: `${loaderData.name} — NaijaFresh` },
          { property: "og:description", content: loaderData.description },
          { property: "og:type", content: "article" },
          { name: "twitter:card", content: "summary_large_image" },
        ]
      : [{ title: "Recipe unavailable — NaijaFresh" }, { name: "robots", content: "noindex" }],
  }),
  notFoundComponent: () => (
    <AppShell>
      <p className="py-20 text-center">Recipe not found.</p>
    </AppShell>
  ),
  component: RecipePage,
});

function RecipePage() {
  const { slug } = Route.useParams();
  const r = useSuspenseQuery(q.recipe(slug)).data!;
  const add = useAddToCart();
  const products = useSuspenseQuery(q.products()).data;
  const missing = r.ingredients.filter(
    (ing) =>
      !products.some(
        (p) =>
          p.id === ing.productId &&
          p.options.some((o) => o.id === ing.variantId && (o.stock ?? 0) >= ing.qty),
      ),
  );
  const lines = r.ingredients.flatMap((ing) => {
    const p = products.find((p) => p.id === ing.productId);
    if (!p) return [];
    const opt = p.options.find((o) => o.id === ing.variantId);
    if (!opt) return [];
    return [{ ing, p, opt }];
  });
  const available = lines.filter((l) => (l.opt.stock ?? 0) >= l.ing.qty);
  const total = available.reduce((n, l) => n + l.opt.price * l.ing.qty, 0);
  const addAll = () => {
    const added = available.filter((l) => add(l.p, l.opt, l.ing.qty, true));
    if (added.length) toast.success(`${added.length} ingredients added`);
  };
  return (
    <AppShell>
      <img src={r.image} alt={r.name} className="aspect-[21/9] w-full rounded-3xl object-cover" />
      <h1 className="mt-6 font-display text-3xl font-bold">{r.name}</h1>
      <p className="text-muted-foreground">
        Prep {r.prepTime} · Cook {r.cookingTime} · serves {r.serves} · {r.difficulty}
      </p>
      <p className="mt-3 max-w-2xl">{r.description}</p>
      <div className="mt-8 grid gap-8 md:grid-cols-2">
        <section className="rounded-2xl bg-card p-5 shadow-card">
          <h2 className="font-display text-xl font-bold">Ingredients</h2>
          <ul className="mt-3 space-y-2">
            {r.ingredientNotes?.map((ingredient, i) => <li key={i}>{ingredient}</li>)}
          </ul>
          {missing.length > 0 && (
            <p role="status" className="mt-3 text-sm text-destructive">
              {missing.length} ingredient(s) unavailable in the required quantity. Only available
              ingredients will be added.
            </p>
          )}
          <ul className="mt-3 divide-y divide-border">
            {lines.map(({ ing, p, opt }) => (
              <li key={p.id} className="flex items-center gap-3 py-2">
                <img src={p.images[0]} alt="" className="size-10 rounded-lg object-cover" />
                <div className="flex-1 text-sm">
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {ing.qty} × {opt.label}
                    {ing.note ? ` · ${ing.note}` : ""}
                  </div>
                </div>
                <span className="text-sm font-semibold">{naira(opt.price * ing.qty)}</span>
                <Button
                  size="sm"
                  disabled={(opt.stock ?? 0) < ing.qty}
                  onClick={() => add(p, opt, ing.qty)}
                >
                  {(opt.stock ?? 0) < ing.qty ? "Unavailable" : "Add"}
                </Button>
              </li>
            ))}
          </ul>
          {lines.length > 0 && <Button
            variant="hot"
            size="lg"
            className="mt-4 w-full"
            disabled={!available.length}
            onClick={addAll}
          >
            Shop all available ingredients · {naira(total)}
          </Button>}
        </section>
        <section>
          <h2 className="font-display text-xl font-bold">Method</h2>
          <ol className="mt-3 space-y-3">
            {r.steps.map((s, i) => (
              <li key={i} className="flex gap-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                  {i + 1}
                </span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
          {r.video && <a href={r.video} target="_blank" rel="noopener noreferrer" className="mt-6 inline-block font-semibold text-primary underline">Watch cooking video</a>}
          {!!r.sources?.length && <div className="mt-6 border-t border-border pt-4">
            <h3 className="font-semibold">Recipe references</h3>
            {r.sources.map(source => <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer" className="mt-2 block text-sm text-primary underline">{source.title}</a>)}
          </div>}
        </section>
      </div>
    </AppShell>
  );
}
