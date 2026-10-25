import { Link } from "@tanstack/react-router";
import {
  Home,
  Store,
  ChefHat,
  ShoppingBasket,
  User,
  Heart,
  Bell,
  Menu,
  Package,
  ChevronRight,
  ChevronDown,
  LoaderCircle,
} from "lucide-react";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetTitle,
  SheetDescription,
  SheetClose,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import type { Category } from "@/types";
import { useApi, useSession } from "@/hooks/use-marketplace";
import type { ReactNode } from "react";
import { useCartSummary } from "@/hooks/use-hydrated-store";

const nav = [
  { to: "/", label: "Home", icon: Home },
  { to: "/shop", label: "Shop", icon: Store },
  { to: "/recipes", label: "Recipes", icon: ChefHat },
  { to: "/cart", label: "Cart", icon: ShoppingBasket },
  { to: "/account", label: "Account", icon: User },
] as const;

export function AppShell({
  children,
  showFooter = true,
}: {
  children: ReactNode;
  showFooter?: boolean;
}) {
  const { count } = useCartSummary();
  const session = useSession();
  const user = session.data;
  const isGuest = !session.isPending && !session.isError && !user;
  const guestNav = [
    ...nav.slice(0, 3),
    { to: "/login" as const, label: "Log in", icon: User },
    { to: "/signup" as const, label: "Sign up", icon: User },
  ];
  const visibleNav = user ? nav : isGuest ? guestNav : nav.slice(0, 3);
  const menuNav = user
    ? [
        ...nav,
        { to: "/orders" as const, label: "My orders", icon: Package },
        { to: "/wishlist" as const, label: "Wishlist", icon: Heart },
      ]
    : isGuest
      ? guestNav
      : nav.slice(0, 3);
  const categories = useApi<Category[]>("/categories");
  const { data: notifications = [] } = useApi<any[]>("/notifications", !!user);
  return (
    <div className="flex min-h-dvh flex-col bg-background pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0">
      <header className="sticky top-0 z-40 w-full border-b border-border bg-card/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex min-h-24 w-full max-w-[1600px] flex-wrap items-center gap-3 px-4 py-4 md:gap-5 md:px-6 xl:flex-nowrap xl:px-10">
          <Sheet>
            <SheetTrigger asChild>
              <button
                type="button"
                aria-label="Open menu"
                title="Open menu"
                className="grid size-9 shrink-0 place-items-center rounded-md hover:bg-accent"
              >
                <Menu className="size-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="flex w-[min(22rem,90vw)] flex-col p-0 sm:max-w-sm">
              <div className="border-b border-border px-5 py-5 pr-12">
                <SheetTitle className="font-display text-xl text-primary-deep">
                  Naija<span className="text-hot">Fresh</span>
                </SheetTitle>
                <SheetDescription className="sr-only">
                  Navigation and food categories
                </SheetDescription>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
                <nav aria-label="Menu navigation" className="space-y-1 border-b border-border py-3">
                  {menuNav.map(({ to, label, icon: Icon }) => (
                    <SheetClose asChild key={to}>
                      <Link
                        to={to}
                        activeOptions={{ exact: true }}
                        activeProps={{ className: "bg-accent text-primary" }}
                        className="flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium hover:bg-accent"
                      >
                        <Icon className="size-5" />
                        {label}
                      </Link>
                    </SheetClose>
                  ))}
                </nav>
                <h2 className="px-3 pb-2 pt-5 text-sm font-semibold">Shop by category</h2>
                {categories.isError ? (
                  <p role="status" className="px-3 text-sm text-muted-foreground">
                    Categories are unavailable. Please try again.
                  </p>
                ) : !categories.data ? (
                  <p role="status" className="px-3 text-sm text-muted-foreground">
                    Loading categories...
                  </p>
                ) : !categories.data.length ? (
                  <p className="px-3 text-sm text-muted-foreground">No categories yet.</p>
                ) : (
                  <nav aria-label="Food categories" className="space-y-1">
                    {categories.data.map((category) => (
                      <SheetClose asChild key={category.slug}>
                        <Link
                          to="/shop"
                          search={{ category: category.slug }}
                          className="flex min-h-16 items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-accent"
                        >
                          <img
                            src={category.image}
                            alt=""
                            className="size-12 shrink-0 rounded-md object-cover"
                            loading="lazy"
                          />
                          <span className="min-w-0 flex-1 break-words">{category.name}</span>
                          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                        </Link>
                      </SheetClose>
                    ))}
                  </nav>
                )}
              </div>
            </SheetContent>
          </Sheet>
          <Link
            to="/"
            aria-label="NaijaFresh home"
            className="shrink-0 font-display text-2xl font-extrabold text-primary-deep md:text-3xl"
          >
            Naija<span className="text-hot">Fresh</span>
          </Link>
          <nav
            aria-label="Main navigation"
            className="ml-2 hidden shrink-0 items-center gap-6 xl:flex"
          >
            {nav.slice(0, 3).map((n) => (
              <Link
                key={n.to}
                to={n.to}
                activeOptions={{ exact: n.to === "/" }}
                className="border-b-2 border-transparent py-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-primary"
                activeProps={{ className: "border-primary text-primary" }}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <form
            action="/shop"
            role="search"
            className="order-last flex min-w-0 basis-full items-center gap-2 rounded-2xl border border-border bg-background px-4 xl:order-none xl:ml-auto xl:max-w-xl xl:flex-1 xl:basis-auto"
          >
            <input
              name="q"
              aria-label="Search products"
              placeholder="Search fresh foodstuff"
              className="h-12 w-full min-w-0 bg-transparent text-sm outline-none"
            />
            <button
              type="submit"
              aria-label="Search products"
              title="Search products"
              className="shrink-0 rounded-md px-2 py-1 text-sm font-semibold text-primary hover:bg-accent"
            >
              Search
            </button>
          </form>
          <div className="ml-auto flex items-center gap-0 md:gap-2">
            {user ? (
              <>
                <Link
                  to="/orders"
                  aria-label="My orders"
                  title="My orders"
                  className="flex shrink-0 items-center gap-1.5 rounded-md p-2 text-sm font-semibold hover:bg-accent"
                >
                  <Package className="size-5" />
                  <span className="hidden xl:inline">My orders</span>
                </Link>
                {user && (
                  <Link
                    to="/notifications"
                    preload="intent"
                    aria-label={`Notifications, ${notifications.filter((n) => !n.read_at).length} unread`}
                    title="Notifications"
                    className="relative rounded-lg p-2 hover:bg-accent"
                  >
                    <Bell className="size-5" />
                    {notifications.some((n) => !n.read_at) && (
                      <span className="absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-hot px-1 text-[9px] font-bold text-white">
                        {notifications.filter((n) => !n.read_at).length}
                      </span>
                    )}
                  </Link>
                )}
                <Link
                  to="/wishlist"
                  preload="intent"
                  aria-label="Wishlist"
                  title="Wishlist"
                  className="hidden rounded-lg p-2 hover:bg-accent sm:block"
                >
                  <Heart className="size-5" />
                </Link>
                <Link
                  to="/cart"
                  aria-label={`Cart, ${count} items`}
                  title="Your basket"
                  className="relative block rounded-lg bg-accent p-2.5 text-primary"
                >
                  <ShoppingBasket className="size-5" />
                  {count > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 grid size-5 place-items-center rounded-full bg-hot text-[10px] font-bold text-hot-foreground">
                      {count}
                    </span>
                  )}
                </Link>
              </>
            ) : null}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Open account menu"
                  className="ml-2 inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-primary/15 bg-accent/60 px-3 text-primary outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {session.isPending ? (
                    <LoaderCircle aria-hidden="true" className="size-5 animate-spin" />
                  ) : (
                    <User aria-hidden="true" className="size-5" />
                  )}
                  <ChevronDown aria-hidden="true" className="size-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={10} className="w-60 rounded-2xl p-2">
                <DropdownMenuLabel className="px-3 py-3">
                  {user ? user.name || "Your account" : "Welcome to NaijaFresh"}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {user ? (
                  <>
                    <DropdownMenuItem asChild>
                      <Link to="/account" className="min-h-11 rounded-xl">
                        <User />
                        My account
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/orders" className="min-h-11 rounded-xl">
                        <Package />
                        My orders
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/wishlist" preload="intent" className="min-h-11 rounded-xl">
                        <Heart />
                        Wishlist
                      </Link>
                    </DropdownMenuItem>
                  </>
                ) : (
                  <>
                    {session.isPending && (
                      <p role="status" className="px-3 py-2 text-xs text-muted-foreground">
                        Checking your account…
                      </p>
                    )}
                    {session.isError && (
                      <p role="status" className="px-3 py-2 text-xs text-muted-foreground">
                        We couldn't check your account. You can still open the sign-in page.
                      </p>
                    )}
                    <DropdownMenuItem asChild>
                      <Link to="/login" className="min-h-11 rounded-xl">
                        Log in
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/signup" className="min-h-11 rounded-xl">
                        Create an account
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <nav
          aria-label="Tablet navigation"
          className="mx-auto hidden max-w-[1600px] gap-6 border-t border-border px-6 md:flex xl:hidden"
        >
          {nav.slice(0, 3).map((n) => (
            <Link
              key={n.to}
              to={n.to}
              activeOptions={{ exact: n.to === "/" }}
              className="border-b-2 border-transparent py-3 text-sm font-semibold text-muted-foreground"
              activeProps={{ className: "border-primary text-primary" }}
            >
              {n.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
      {showFooter && (
        <footer
          aria-label="Site footer"
          className="mt-12 border-t border-border bg-primary-deep text-primary-foreground"
        >
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1.3fr]">
            <div>
              <Link to="/" className="font-display text-2xl font-extrabold">
                Naija<span className="text-hot">Fresh</span>
              </Link>
              <p className="mt-4 max-w-xs text-sm leading-7 text-primary-foreground/75">
                Fresh Nigerian foodstuff, from trusted market sellers to your kitchen.
              </p>
            </div>
            <div>
              <h2 className="text-sm font-bold">Explore</h2>
              <div className="mt-4 flex flex-col items-start gap-3 text-sm text-primary-foreground/75">
                <Link to="/shop" className="hover:text-white">
                  Shop all products
                </Link>
                <Link to="/recipes" className="hover:text-white">
                  Recipes
                </Link>
                {user && (
                  <Link to="/wishlist" preload="intent" className="hover:text-white">
                    Your wishlist
                  </Link>
                )}
              </div>
            </div>
            <div>
              <h2 className="text-sm font-bold">Your account</h2>
              <div className="mt-4 flex flex-col items-start gap-3 text-sm text-primary-foreground/75">
                {user && (
                  <>
                    <Link to="/account" className="hover:text-white">
                      My account
                    </Link>
                    <Link to="/orders" className="hover:text-white">
                      My orders
                    </Link>
                    <Link to="/cart" className="hover:text-white">
                      Your basket
                    </Link>
                  </>
                )}
                {!session.isPending && !session.isError && !user && (
                  <Link to="/login" className="hover:text-white">
                    Log in
                  </Link>
                )}
                {!session.isPending && !session.isError && !user && (
                  <Link to="/signup" className="hover:text-white">
                    Create an account
                  </Link>
                )}
              </div>
            </div>
            <div>
              <h2 className="text-sm font-bold">Fresh, every day</h2>
              <p className="mt-4 text-sm leading-7 text-primary-foreground/75">
                Serving Lagos, Abuja &amp; Port Harcourt.
              </p>
              <div className="mt-4 flex items-center gap-2 text-sm">
                <ShoppingBasket className="size-5 text-hot" /> From our markets to your table.
              </div>
            </div>
          </div>
          <div className="border-t border-white/15">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-5 text-xs text-primary-foreground/65">
              <span>&copy; {new Date().getFullYear()} NaijaFresh. All rights reserved.</span>
              <span>Good food. Local roots.</span>
            </div>
          </div>
        </footer>
      )}
      <nav
        aria-label="Mobile navigation"
        className={`fixed inset-x-0 bottom-0 z-40 grid ${visibleNav.length === 3 ? "grid-cols-3" : "grid-cols-5"} border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden`}
      >
        {visibleNav.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            activeOptions={{ exact: to === "/" }}
            className="relative flex flex-col items-center gap-0.5 py-2 text-[11px] text-muted-foreground"
            activeProps={{ className: "text-primary font-semibold" }}
          >
            <Icon className="size-5" />
            {label}
            {to === "/cart" && count > 0 && (
              <span className="absolute right-[28%] top-1 grid size-4 place-items-center rounded-full bg-hot text-[9px] font-bold text-hot-foreground">
                {count}
              </span>
            )}
          </Link>
        ))}
      </nav>
    </div>
  );
}
