import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ShoppingBasket, Truck, ShieldCheck, Leaf } from "lucide-react";
import { heroImage } from "@/services/api";

const perks = [
  { icon: Leaf, text: "Farm-fresh foodstuff, sourced daily" },
  { icon: Truck, text: "Same-day delivery across your city" },
  { icon: ShieldCheck, text: "Trusted sellers, quality guaranteed" },
];

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="relative min-h-[calc(100dvh-8rem)] overflow-hidden rounded-3xl bg-cream-fade pattern-dots">
      {/* soft glow blobs */}
      <div className="pointer-events-none absolute -left-24 -top-24 size-72 rounded-full bg-primary/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 size-72 rounded-full bg-hot/15 blur-3xl" />

      <div className="relative grid lg:min-h-[calc(100dvh-8rem)] lg:grid-cols-2">
        {/* Brand / photo panel */}
        <aside className="relative hidden overflow-hidden lg:block">
          <img
            src={heroImage}
            alt="Fresh Nigerian foodstuff at the market"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-primary-deep/95 via-primary-deep/60 to-primary-deep/30" />
          <div className="relative flex h-full flex-col justify-between p-10">
            <Link to="/" className="flex items-center gap-2">
              <span className="grid size-10 place-items-center rounded-xl bg-cream shadow-soft">
                <ShoppingBasket className="size-5 text-primary" />
              </span>
              <span className="font-display text-xl font-extrabold tracking-tight text-cream">
                NaijaFresh
              </span>
            </Link>

            <div>
              <h2 className="font-display text-4xl font-extrabold leading-tight tracking-tight text-cream">
                Fresh from the market,
                <br />
                straight to your kitchen.
              </h2>
              <ul className="mt-8 space-y-4">
                {perks.map(({ icon: Icon, text }) => (
                  <li key={text} className="flex items-center gap-3 text-cream/90">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-cream/15 backdrop-blur">
                      <Icon className="size-4" />
                    </span>
                    <span className="text-sm font-medium">{text}</span>
                  </li>
                ))}
              </ul>
            </div>

            <p className="text-xs text-cream/60">
              Loved by home cooks and caterers across Nigeria.
            </p>
          </div>
        </aside>

        {/* Form panel */}
        <div className="flex items-center justify-center px-4 py-10 sm:px-8">
          <div className="w-full max-w-md">
            <div className="flex flex-col items-center text-center">
              <div className="grid size-14 place-items-center rounded-2xl bg-primary shadow-soft lg:hidden">
                <ShoppingBasket className="size-7 text-primary-foreground" />
              </div>
              <h1 className="mt-4 font-display text-3xl font-extrabold tracking-tight text-primary-deep lg:mt-0">
                {title}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
            </div>

            <div className="mt-8 rounded-3xl border border-border/60 bg-card/90 p-6 shadow-soft backdrop-blur sm:p-8">
              {children}
            </div>

            <p className="mt-6 text-center text-sm text-muted-foreground">{footer}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
