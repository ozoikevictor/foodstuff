import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/shop/AppShell";
import { q } from "@/services/api";
import { useState } from "react";
import { ChefHat, Clock, Users, Search, ArrowRight } from "lucide-react";
import { PageIntro, ShoppingEmpty } from "@/components/shop/PageIntro";

export const Route = createFileRoute("/recipes/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(q.recipes()),
  head: () => ({
    meta: [
      { title: "Nigerian recipes — NaijaFresh" },
      {
        name: "description",
        content: "Jollof, egusi, ogbono and more — add every ingredient to your cart in one tap.",
      },
      { property: "og:title", content: "Nigerian recipes — NaijaFresh" },
      {
        property: "og:description",
        content: "Shop full ingredient lists for classic Nigerian dishes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Recipes,
});

function Recipes() {
  const { data } = useSuspenseQuery(q.recipes());
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const categories = [...new Set(data.map((r) => r.category).filter((value): value is string => !!value))];
  const recipes = data.filter(
    (r) =>
      (!category || r.category === category) &&
      r.name.toLowerCase().includes(search.trim().toLowerCase()),
  );
  return (
    <AppShell>
      <PageIntro
        eyebrow="From market to table"
        title="What are we cooking today?"
        description="Discover familiar Nigerian favourites and new kitchen inspiration. Choose a dish, follow the steps, and shop its ingredients."
      >
        <div className="mt-5 flex items-center gap-2 text-xs text-green-100">
          <ChefHat className="size-4" />
          Made for your everyday kitchen
        </div>
      </PageIntro>
      <section aria-label="Find recipes" className="mb-7 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-xl font-bold">Find your next favourite</h2>
          <div className="relative w-full sm:w-80">
            <Search className="pointer-events-none absolute left-4 top-3.5 size-4 text-muted-foreground" />
            <input
              aria-label="Search recipes"
              placeholder="Search jollof, soups and more…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="min-h-11 w-full rounded-xl border border-input bg-card pl-11 pr-4 text-sm outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2" aria-label="Recipe categories">
          {["", ...categories].map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={category === c}
              onClick={() => setCategory(c)}
              className={`rounded-full border px-4 py-2 text-sm font-medium transition ${category === c ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-accent"}`}
            >
              {c || "All recipes"}
            </button>
          ))}
        </div>
      </section>
      <p role="status" className="mb-4 text-sm text-muted-foreground">
        {recipes.length} {recipes.length === 1 ? "recipe" : "recipes"} to inspire you
      </p>
      {recipes.length ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {recipes.map((r) => (
            <Link
              key={r.slug}
              to="/recipes/$slug"
              params={{ slug: r.slug }}
              className="group overflow-hidden rounded-2xl border border-border bg-card transition hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="relative aspect-[16/10] overflow-hidden bg-accent">
                <img
                  src={r.image}
                  alt={r.name}
                  loading="lazy"
                  className="size-full object-cover transition duration-500 group-hover:scale-105"
                />
                <span className="absolute left-4 top-4 rounded-full bg-card/95 px-3 py-1.5 text-xs font-semibold text-primary">
                  {r.category || "Kitchen favourite"}
                </span>
              </div>
              <div className="p-5">
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-primary">
                  <ChefHat className="size-3.5" />
                  {r.difficulty}
                </div>
                <h3 className="font-display text-xl font-bold">{r.name}</h3>
                <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                  {r.description}
                </p>
                <div className="mt-4 flex flex-wrap gap-4 border-t border-border pt-4 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="size-4" />
                    {r.prepTime}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Users className="size-4" />
                    Serves {r.serves}
                  </span>
                </div>
                <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary">
                  Let's cook <ArrowRight className="size-4 transition group-hover:translate-x-1" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <ShoppingEmpty
          icon={<ChefHat className="size-9" />}
          title={data.length ? "No recipes match just yet" : "Something delicious is on the way"}
          description={
            data.length
              ? "Try another dish name or explore all our recipe categories."
              : "New recipes will appear here once they are published. Explore fresh ingredients while you wait."
          }
        >
          {data.length ? (
            <button
              className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
              onClick={() => {
                setSearch("");
                setCategory("");
              }}
            >
              Show all recipes
            </button>
          ) : (
            <Link
              to="/shop"
              className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
            >
              Shop fresh ingredients
            </Link>
          )}
        </ShoppingEmpty>
      )}
    </AppShell>
  );
}
