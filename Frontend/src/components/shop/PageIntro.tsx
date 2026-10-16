import type { ReactNode } from "react";
import { Leaf } from "lucide-react";

export function PageIntro({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <header className="relative mb-7 overflow-hidden rounded-3xl bg-[#064b2e] px-6 py-8 text-white md:px-9 md:py-10">
      <Leaf
        aria-hidden="true"
        className="pointer-events-none absolute -right-8 -top-10 size-60 rotate-12 text-white/5"
      />
      <div className="relative max-w-2xl">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-green-200">
          {eyebrow}
        </p>
        <h1 className="font-display text-3xl font-bold md:text-4xl">{title}</h1>
        <p className="mt-3 max-w-lg text-sm leading-relaxed text-green-100 md:text-base">
          {description}
        </p>
        {children}
      </div>
    </header>
  );
}

export function ShoppingEmpty({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-3xl border border-dashed border-primary/20 bg-card px-6 py-14 text-center md:py-20">
      <div className="mb-5 grid size-20 place-items-center rounded-full bg-accent text-primary">
        {icon}
      </div>
      <h2 className="font-display text-2xl font-bold">{title}</h2>
      <p className="mb-6 mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
      {children}
    </div>
  );
}
