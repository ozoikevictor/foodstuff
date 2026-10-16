import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/shop/AppShell";
import { AuthLayout } from "@/components/shop/AuthLayout";
import { Button } from "@/components/ui/button";
import { request } from "@/services/api";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Log in — NaijaFresh" },
      {
        name: "description",
        content: "Log in to your NaijaFresh account to order fresh Nigerian foodstuff.",
      },
      { property: "og:title", content: "Log in — NaijaFresh" },
      {
        property: "og:description",
        content: "Log in to your NaijaFresh account to order fresh Nigerian foodstuff.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Login,
});

const inputCls =
  "w-full rounded-xl border border-input bg-background py-2.5 pl-10 pr-10 text-sm shadow-sm outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring";

function Login() {
  const navigate = useNavigate();
  const client = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");

    const next: Record<string, string> = {};
    if (!/^\S+@\S+\.\S+$/.test(email)) next["email"] = "Enter a valid email address.";
    if (password.length < 1) next["password"] = "Enter your password.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setBusy(true);
    try {
      const user = await request("/auth/login", "POST", { email, password });
      await client.invalidateQueries();
      window.location.assign(
        user.role === "ADMIN" ? "/admin" : user.role === "RIDER" ? "/rider" : "/account",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Login failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <AuthLayout
        title="Welcome back"
        subtitle="Log in to continue your fresh foodstuff orders."
        footer={
          <>
            New to NaijaFresh?{" "}
            <Link to="/signup" className="font-semibold text-primary hover:underline">
              Create an account
            </Link>
          </>
        }
      >
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium">
              Email
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                className={inputCls}
              />
            </div>
            {errors["email"] && (
              <p className="mt-1 text-xs font-medium text-destructive">{errors["email"]}</p>
            )}
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label htmlFor="password" className="block text-sm font-medium">
                Password
              </label>
            </div>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Your password"
                className={inputCls}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            {errors["password"] && (
              <p className="mt-1 text-xs font-medium text-destructive">{errors["password"]}</p>
            )}
          </div>

          <Button type="submit" disabled={busy} variant="hot" size="lg" className="w-full">
            {busy ? "Logging in..." : "Log in"}
          </Button>
        </form>
      </AuthLayout>
    </AppShell>
  );
}
