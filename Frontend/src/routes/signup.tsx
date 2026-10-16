import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Mail, Lock, Phone, UserRound, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/shop/AppShell";
import { AuthLayout } from "@/components/shop/AuthLayout";
import { Button } from "@/components/ui/button";
import { request } from "@/services/api";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Create account — NaijaFresh" },
      { name: "description", content: "Sign up to order fresh Nigerian foodstuff." },
      { property: "og:title", content: "Create account — NaijaFresh" },
      { property: "og:description", content: "Sign up to order fresh Nigerian foodstuff." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Signup,
});

const inputCls =
  "w-full rounded-xl border border-input bg-background py-2.5 pl-10 pr-10 text-sm shadow-sm outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring";

function Signup() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const name = String(data.get("name") ?? "").trim();
    const email = String(data.get("email") ?? "").trim();
    const phone = String(data.get("phone") ?? "").trim();
    const password = String(data.get("password") ?? "");

    const next: Record<string, string> = {};
    if (name.length < 2) next["name"] = "Please enter your full name.";
    if (!/^\S+@\S+\.\S+$/.test(email)) next["email"] = "Enter a valid email address.";
    if (!/^0\d{10}$/.test(phone.replace(/\s/g, "")))
      next["phone"] = "Enter a Nigerian number, e.g. 0803 123 4567.";
    if (password.length < 12) next["password"] = "Password must be at least 12 characters.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setBusy(true);
    try {
      await request("/auth/register", "POST", {
        name,
        email,
        phone: phone.replace(/\s/g, ""),
        password,
      });
      window.location.assign("/account");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Registration failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <AuthLayout
        title="Create your account"
        subtitle="Order fresh foodstuff from trusted Nigerian markets."
        footer={
          <>
            Already have an account?{" "}
            <Link to="/login" className="font-semibold text-primary hover:underline">
              Log in
            </Link>
          </>
        }
      >
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div>
            <label htmlFor="name" className="mb-1.5 block text-sm font-medium">
              Full name
            </label>
            <div className="relative">
              <UserRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                placeholder="Chibuike Okafor"
                className={inputCls}
              />
            </div>
            {errors["name"] && (
              <p className="mt-1 text-xs font-medium text-destructive">{errors["name"]}</p>
            )}
          </div>

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
            <label htmlFor="phone" className="mb-1.5 block text-sm font-medium">
              Phone number
            </label>
            <div className="relative">
              <Phone className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                id="phone"
                name="phone"
                type="tel"
                autoComplete="tel"
                placeholder="0803 123 4567"
                className={inputCls}
              />
            </div>
            {errors["phone"] && (
              <p className="mt-1 text-xs font-medium text-destructive">{errors["phone"]}</p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium">
              Password
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="At least 12 characters"
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
            {busy ? "Creating account..." : "Create account"}
          </Button>
        </form>
      </AuthLayout>
    </AppShell>
  );
}
