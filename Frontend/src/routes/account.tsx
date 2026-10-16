import { Link, createFileRoute } from "@tanstack/react-router";
import { useState, type ChangeEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Camera, Leaf, Package, Heart, ChefHat, Bell, ChevronRight, ShoppingBasket, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/shop/AppShell";
import { Access, Logout } from "@/components/marketplace/shared";
import { Profile } from "@/components/marketplace/Profile";
import { useSession } from "@/hooks/use-marketplace";
import { request } from "@/services/api";
import { tabHeaders, tabPrivateImage } from "@/lib/test-tab-session";

export const Route = createFileRoute("/account")({
  head: () => ({ meta: [{ title: "My account — NaijaFresh" }] }),
  component: Account,
});

const shortcuts = [
  { to: "/orders", icon: Package, label: "My orders", description: "Track deliveries and view past orders", color: "bg-orange-50 text-orange-600" },
  { to: "/wishlist", icon: Heart, label: "Saved foodstuff", description: "Your favourites, ready for your next shop", color: "bg-rose-50 text-rose-600" },
  { to: "/recipes", icon: ChefHat, label: "Recipe inspiration", description: "Find something delicious to cook", color: "bg-green-50 text-green-700" },
  { to: "/notifications", icon: Bell, label: "Notifications", description: "Keep up with your order updates", color: "bg-blue-50 text-blue-600" },
] as const;

function Account() {
  const { data: user } = useSession();
  const client = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [failedPhoto, setFailedPhoto] = useState<string>();

  async function changePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !user) return;
    setUploading(true);
    try {
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5000000)
        throw new Error("Choose a JPG, PNG or WebP photo under 5 MB.");
      const response = await fetch("/api/images", { method: "POST", headers: { ...tabHeaders(), "Content-Type": file.type }, body: file });
      const image = await response.json();
      if (!response.ok) throw new Error(image.error || "Photo upload failed.");
      await request("/profile", "PATCH", { name: user.name, phone: user.phone, photoUrl: image.url });
      await client.invalidateQueries({ queryKey: ["session"] });
      toast.success("Your profile photo has been updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save your photo.");
    } finally { setUploading(false); }
  }

  return (
    <AppShell>
      <Access>
        {user && <div className="mx-auto max-w-5xl space-y-6 pb-8">
          <div className="flex items-center justify-between gap-3">
            <div><p className="mb-1 text-xs font-semibold uppercase tracking-widest text-primary">Your NaijaFresh</p><h1 className="font-display text-2xl font-bold md:text-3xl">My account</h1></div>
            <Logout />
          </div>
          <section className="relative overflow-hidden rounded-3xl bg-[#064b2e] p-6 text-white md:p-8" aria-label="Your profile">
            <Leaf aria-hidden="true" className="pointer-events-none absolute -right-8 -top-8 size-56 rotate-12 text-white/5" />
            <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
              <div className="relative w-fit shrink-0">
                <div className="grid size-24 place-items-center overflow-hidden rounded-full border-4 border-white/25 bg-[#e6f2e8] text-3xl font-bold text-[#064b2e] md:size-28">
                  {user.photoUrl && failedPhoto !== user.photoUrl ? <img src={tabPrivateImage(user.photoUrl)} alt={`${user.name}'s profile`} className="size-full object-cover" onError={() => setFailedPhoto(user.photoUrl)} /> : user.avatarInitials || user.name.slice(0, 1).toUpperCase()}
                </div>
                <label className={`absolute -bottom-1 -right-1 grid size-9 place-items-center rounded-full border-2 border-[#064b2e] bg-white text-[#064b2e] focus-within:ring-2 focus-within:ring-white ${uploading ? "cursor-wait opacity-60" : "cursor-pointer hover:bg-green-100"}`}>
                  <Camera className="size-4" aria-hidden="true" />
                  <input aria-label="Change profile photo" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={uploading} onChange={changePhoto} />
                </label>
              </div>
              <div className="min-w-0 flex-1">
                <p className="mb-1 text-sm text-green-100">Welcome back,</p>
                <h2 className="break-words font-display text-2xl font-bold md:text-3xl">{user.name}</h2>
                <p className="mt-1 break-all text-sm text-green-100">{user.email}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-white/10 px-3 py-1.5">{user.role === "ADMIN" ? "Administrator" : user.role === "RIDER" ? "Delivery partner" : "Fresh food lover"}</span>{user.memberSince && <span className="rounded-full bg-white/10 px-3 py-1.5">Member since {user.memberSince}</span>}</div>
              </div>
            </div>
            <p role="status" className="relative mt-4 text-xs text-green-100">{uploading ? "Saving your photo…" : "Make it yours. Tap the camera to add a profile photo."}</p>
          </section>
          {user.role === "CUSTOMER" && <nav aria-label="Your shopping" className="grid gap-3 sm:grid-cols-2">
            {shortcuts.map(({ to, icon: Icon, label, description, color }) => <Link key={to} to={to} className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-4 transition hover:border-primary/40 hover:shadow-sm">
              <span className={`grid size-12 shrink-0 place-items-center rounded-2xl ${color}`}><Icon className="size-5" /></span>
              <div className="min-w-0 flex-1"><h2 className="text-sm font-bold">{label}</h2><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p></div>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground group-hover:text-primary" />
            </Link>)}
          </nav>}
          {user.role === "ADMIN" && <Link to="/admin" className="inline-flex items-center gap-2 font-semibold text-primary">Open admin dashboard <ChevronRight className="size-4" /></Link>}
          {user.role === "RIDER" && <Link to="/rider" className="inline-flex items-center gap-2 font-semibold text-primary">Open rider dashboard <ChevronRight className="size-4" /></Link>}
          <div className="grid items-start gap-6 md:grid-cols-[1.3fr_1fr]">
            <section className="rounded-2xl border border-border bg-card p-5 md:p-6">
              <h2 className="text-lg font-bold">Personal details</h2>
              <p className="mb-5 mt-1 text-sm text-muted-foreground">Keep your name and phone number up to date for smooth deliveries.</p>
              <Profile key={user.id} />
            </section>
            <div className="space-y-4">
              <section className="rounded-2xl border border-primary/15 bg-accent/50 p-6">
                <Leaf className="mb-3 size-7 text-primary" />
                <h2 className="text-lg font-bold">Good food starts here</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">From everyday grains to fresh vegetables, fill your kitchen with the foodstuff you love.</p>
                <Link to="/shop" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary-deep"><ShoppingBasket className="size-4" />Shop fresh foodstuff</Link>
              </section>
              <div className="flex items-start gap-3 px-2 text-xs leading-relaxed text-muted-foreground"><ShieldCheck className="size-5 shrink-0 text-primary" /><p>Your photo and contact details are saved to your account to help make shopping easier.</p></div>
            </div>
          </div>
        </div>}
      </Access>
    </AppShell>
  );
}
