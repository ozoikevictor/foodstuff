import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { ShoppingBasket, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { heroImage } from "@/services/api";

export const Route = createFileRoute("/loading")({
  head: () => ({
    meta: [
      { title: "Loading — NaijaFresh" },
      { name: "description", content: "Fresh Nigerian foodstuff, loading…" },
      { property: "og:title", content: "Loading — NaijaFresh" },
      { property: "og:description", content: "Fresh Nigerian foodstuff, loading…" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Loading,
});

const steps = ["Waking the market", "Picking fresh produce", "Packing your basket"];

function Loading() {
  const navigate = useNavigate();

  useEffect(() => {
    const t = setTimeout(() => void navigate({ to: "/" }), 3200);
    return () => clearTimeout(t);
  }, [navigate]);

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-primary-deep px-6 text-primary-foreground">
      <img
        src={heroImage}
        alt=""
        className="pointer-events-none absolute inset-0 size-full object-cover opacity-15"
      />
      <div className="absolute inset-0 bg-scrim" aria-hidden />

      <div className="relative z-10 flex w-full max-w-sm flex-col items-center text-center">
        <motion.div
          initial={{ scale: 0.7, opacity: 0, rotate: -8 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 14 }}
          className="grid size-24 place-items-center rounded-3xl bg-hot shadow-glow"
        >
          <ShoppingBasket className="size-12 text-hot-foreground" />
        </motion.div>

        <motion.h1
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="mt-6 font-display text-4xl font-extrabold tracking-tight"
        >
          Naija<span className="text-hot">Fresh</span>
        </motion.h1>
        <p className="mt-2 text-sm text-primary-foreground/80">
          Fresh Nigerian foodstuff, delivered to your door.
        </p>

        <div className="mt-10 w-full space-y-2 text-left" aria-live="polite">
          {steps.map((step, i) => (
            <motion.div
              key={step}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 + i * 0.7 }}
              className="flex items-center gap-2 text-sm"
            >
              <span className="relative flex size-4 items-center justify-center">
                <motion.span
                  className="absolute inline-flex size-full rounded-full bg-hot"
                  animate={{ scale: [1, 1.4, 1], opacity: [0.7, 0, 0.7] }}
                  transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.7 }}
                />
                <span className="relative inline-flex size-2 rounded-full bg-hot" />
              </span>
              {step}
            </motion.div>
          ))}
        </div>

        <div className="mt-8 h-1.5 w-full overflow-hidden rounded-full bg-white/15">
          <motion.div
            className="h-full rounded-full bg-hot"
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: 3, ease: "easeInOut" }}
          />
        </div>

        <Button
          variant="cream"
          size="sm"
          className="mt-8"
          onClick={() => void navigate({ to: "/" })}
        >
          Skip to shop <ArrowRight />
        </Button>
      </div>
    </div>
  );
}
