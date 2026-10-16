import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Truck,
  ShieldCheck,
  Clock,
  Search,
  Star,
  ArrowRight,
  ShoppingBasket,
  Leaf,
  Flame,
} from "lucide-react";
import { AppShell } from "@/components/shop/AppShell";
import { ProductGrid } from "@/components/shop/ProductCard";
import { Button } from "@/components/ui/button";
import { q, heroImage } from "@/services/api";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NaijaFresh — Fresh Nigerian foodstuff delivered" },
      {
        name: "description",
        content:
          "Shop rice, beans, meat, fish, yam, palm oil and more from trusted Nigerian market sellers, delivered to your door.",
      },
      { property: "og:title", content: "NaijaFresh — Fresh Nigerian foodstuff delivered" },
      {
        property: "og:description",
        content: "Market-fresh foodstuff by the kg, derica, paint or bag.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) =>
    Promise.allSettled([
      context.queryClient.ensureQueryData(q.categories()),
      context.queryClient.ensureQueryData(q.products()),
      context.queryClient.ensureQueryData(q.recipes()),
    ]),
  component: Index,
});

function Index() {
  const categoryQuery = useQuery(q.categories());
  const productQuery = useQuery(q.products());
  const recipeQuery = useQuery(q.recipes());
  const cats = categoryQuery.data || [];
  const products = productQuery.data || [];
  const recipes = recipeQuery.data || [];
  const dataUnavailable = categoryQuery.isError || productQuery.isError || recipeQuery.isError;
  const deals = products.filter((p) => p.tags.includes("deal")).slice(0, 8);
  const popular = products.filter((p) => p.tags.includes("popular")).slice(0, 8);

  return (
    <AppShell showFooter>
      {dataUnavailable && <p role="alert" className="mb-5 rounded-md border border-border p-4 text-sm">The catalogue is temporarily unavailable. Your account and saved data have not been deleted. Please try again later.</p>}
      {/* Hero */}
      <section className="relative -mx-4 overflow-hidden md:rounded-[2rem] md:mx-0">
        <img
          src={heroImage}
          alt="Fresh Nigerian market produce"
          className="absolute inset-0 size-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-primary-deep/95 via-primary-deep/80 to-primary-deep/30" />
        <div className="relative px-6 py-14 md:px-12 md:py-24">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-primary-foreground/15 px-4 py-1.5 text-xs font-semibold text-primary-foreground backdrop-blur">
              <Flame className="size-3.5 text-hot" /> Same-day delivery in Lagos, Abuja &amp; PH
            </span>
            <h1 className="mt-5 font-display text-4xl font-extrabold leading-[1.1] text-primary-foreground md:text-6xl">
              Market-fresh foodstuff, <span className="text-hot">delivered today.</span>
            </h1>
            <p className="mt-4 max-w-lg text-base text-primary-foreground/85 md:text-lg">
              Buy by the kg, derica, paint or 50kg bag — straight from trusted sellers at Mile 12,
              Daleko and more.
            </p>

            {/* Search bar */}
            <form
              action="/shop"
              className="mt-7 flex max-w-lg items-center gap-2 rounded-2xl bg-primary-foreground p-2 shadow-2xl"
            >
              <Search className="ml-2 size-5 shrink-0 text-muted-foreground" />
              <input
                name="q"
                placeholder="Search rice, palm oil, stockfish…"
                className="h-11 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
              <Button type="submit" variant="hot" className="shrink-0">
                Search
              </Button>
            </form>

            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild variant="hot" size="lg">
                <Link to="/shop">
                  Start shopping <ArrowRight className="ml-1 size-4" />
                </Link>
              </Button>
              <Button asChild variant="cream" size="lg">
                <Link to="/recipes">Shop by recipe</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Trust row */}
      <div className="mt-6 grid grid-cols-3 gap-3 text-xs md:text-sm">
        {[
          { i: Truck, t: "Same-day delivery", s: "Order by 2pm" },
          { i: ShieldCheck, t: "Quality checked", s: "Every single item" },
          { i: Leaf, t: "Farm fresh", s: "Sourced daily" },
        ].map(({ i: I, t, s }) => (
          <div key={t} className="flex items-center gap-3 rounded-2xl bg-card p-4 shadow-soft">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <I className="size-5" />
            </span>
            <div className="min-w-0">
              <div className="truncate font-semibold">{t}</div>
              <div className="hidden truncate text-xs text-muted-foreground sm:block">{s}</div>
            </div>
          </div>
        ))}
      </div>

      <Section title="Shop by category" to="/shop" sub="Everything from grains to fresh pepper">
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {cats.map((c) => (
            <Link
              key={c.slug}
              to="/shop"
              search={{ category: c.slug }}
              className="group overflow-hidden rounded-2xl bg-card shadow-soft transition hover:-translate-y-1 hover:shadow-card"
            >
              <div className="overflow-hidden">
                <img
                  src={c.image}
                  alt={c.name}
                  loading="lazy"
                  className="aspect-square w-full object-cover transition duration-300 group-hover:scale-105"
                />
              </div>
              <div className="p-2.5 text-center text-xs font-semibold">{c.name}</div>
            </Link>
          ))}
        </div>
      </Section>

      <Section title="Today's deals" to="/shop" sub="Prices dropped — while stock lasts">
        <ProductGrid items={deals} />
      </Section>

      {/* Recipe banner */}
      <section className="relative mt-12 overflow-hidden rounded-[2rem] bg-primary-deep px-6 py-10 md:px-12">
        <div className="absolute inset-0 pattern-dots opacity-20" />
        <div className="relative flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div className="max-w-md">
            <span className="inline-flex items-center gap-2 rounded-full bg-primary-foreground/15 px-3 py-1 text-xs font-semibold text-primary-foreground">
              <ShoppingBasket className="size-3.5 text-hot" /> One-tap recipe shopping
            </span>
            <h2 className="mt-3 font-display text-2xl font-extrabold text-primary-foreground md:text-3xl">
              Cook something tonight
            </h2>
            <p className="mt-2 text-sm text-primary-foreground/80">
              Pick a recipe and add every ingredient to your basket in one tap.
            </p>
          </div>
          <Button asChild variant="hot" size="lg">
            <Link to="/recipes">
              Browse recipes <ArrowRight className="ml-1 size-4" />
            </Link>
          </Button>
        </div>
        <div className="relative mt-8 flex gap-4 overflow-x-auto pb-2 no-scrollbar">
          {recipes.map((r) => (
            <Link
              key={r.slug}
              to="/recipes/$slug"
              params={{ slug: r.slug }}
              className="group w-52 shrink-0 overflow-hidden rounded-2xl bg-card shadow-card transition hover:-translate-y-1"
            >
              <div className="overflow-hidden">
                <img
                  src={r.image}
                  alt={r.name}
                  loading="lazy"
                  className="aspect-[4/3] w-full object-cover transition duration-300 group-hover:scale-105"
                />
              </div>
              <div className="p-3">
                <div className="font-semibold">{r.name}</div>
                <div className="text-xs text-muted-foreground">
                  {r.prepTime} · serves {r.serves}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <Section title="Popular this week" to="/shop" sub="What everyone is adding to their basket">
        <ProductGrid items={popular} />
      </Section>
    </AppShell>
  );
}

function Section({
  title,
  sub,
  to,
  children,
}: {
  title: string;
  sub?: string;
  to: "/shop" | "/recipes";
  children: React.ReactNode;
}) {
  return (
    <section className="mt-12">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold md:text-3xl">{title}</h2>
          {sub && <p className="mt-1 text-sm text-muted-foreground">{sub}</p>}
        </div>
        <Link
          to={to}
          className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-primary hover:underline"
        >
          See all <ArrowRight className="size-4" />
        </Link>
      </div>
      {children}
    </section>
  );
}
