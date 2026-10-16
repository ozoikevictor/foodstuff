import { useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Navigate } from "@tanstack/react-router";
import { LoaderCircle, LogOut, Upload } from "lucide-react";
import { toast } from "sonner";
import { request } from "@/services/api";
import { useSession } from "@/hooks/use-marketplace";
import { useCart } from "@/stores/cart";
import {tabStorage, tabHeaders} from "@/lib/test-tab-session";
export const fieldClass =
  "w-full min-w-0 rounded-md border border-input bg-card px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary";
export const commandClass =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50 hover:bg-primary-deep";
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5 text-sm font-medium">
      {label}
      {children}
    </label>
  );
}
export function Status({ value }: { value: string }) {
  return (
    <span
      className={`inline-flex rounded px-2 py-1 text-xs font-semibold ${["Completed", "paid"].includes(value) ? "bg-accent text-primary" : ["Cancelled", "Disputed", "refund_required"].includes(value) ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800"}`}
    >
      {value.replaceAll("_", " ")}
    </span>
  );
}
export function Loading() {
  return (
    <div role="status" className="py-8 text-muted-foreground">
      <span className="flex items-center gap-2 text-sm">
        <LoaderCircle className="size-5 animate-spin" />
        Loading...
      </span>
      <div aria-hidden="true" className="mt-5 space-y-3 animate-pulse">
        <div className="h-16 rounded-md bg-muted" />
        <div className="h-16 rounded-md bg-muted" />
        <div className="h-16 rounded-md bg-muted" />
      </div>
    </div>
  );
}
export function ErrorState({ error }: { error: unknown }) {
  return (
    <p
      role="alert"
      className="my-4 rounded-md border border-destructive/20 bg-red-50 p-4 text-sm text-destructive"
    >
      {error instanceof Error ? error.message : "Unable to load this page."}
    </p>
  );
}
export function Access({ role, children }: { role?: string; children: ReactNode }) {
  const session = useSession();
  if (session.isError) return <ErrorState error={session.error} />;
  if (session.isPending) return <Loading />;
  if (!session.data) return <Navigate to="/login" replace />;
  if (role && session.data.role !== role)
    return <ErrorState error={new Error("You do not have permission to access this page.")} />;
  return <>{children}</>;
}
export function Logout() {
  const client = useQueryClient();
  return (
    <Action
      label="Log out"
      icon={<LogOut className="size-4" />}
      onClick={async () => {
        await request("/auth/logout", "POST", {});
        useCart.getState().clear();
        tabStorage().removeItem("naijafresh-cart-owner");
        client.clear();
        window.location.assign("/login");
      }}
    />
  );
}
export function Action({
  label,
  onClick,
  icon,
  disabled = false,
}: {
  label: string;
  onClick: () => Promise<unknown>;
  icon?: ReactNode;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const client = useQueryClient();
  return (
    <button
      disabled={busy || disabled}
      className={commandClass}
      onClick={async () => {
        setBusy(true);
        try {
          await onClick();
          await client.invalidateQueries();
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Request failed.");
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? <LoaderCircle className="size-4 animate-spin" /> : icon}
      {label}
    </button>
  );
}
export function ImageUpload({ onUploaded }: { onUploaded: (url: string) => void }) {
  const [busy, setBusy] = useState(false);
  const { data: user } = useSession();
  const [library, setLibrary] = useState<{url: string; name: string}[] | null>(null);
  return (
    <div className="space-y-3">
      {user?.role === "ADMIN" && <button type="button" className={commandClass} onClick={async () => {
        if (library) { setLibrary(null); return; }
        try { setLibrary(await request("/admin/media")); }
        catch (error) { toast.error(error instanceof Error ? error.message : "Images unavailable."); }
      }}>Choose saved image</button>}
      {library && <div className="grid max-h-64 grid-cols-3 gap-2 overflow-auto sm:grid-cols-4">
        {library.map(image => <button type="button" key={image.url} title={image.name} aria-label={`Use ${image.name}`} className="overflow-hidden rounded-md border border-border" onClick={() => { onUploaded(image.url); setLibrary(null); }}>
          <img src={image.url} alt={image.name} className="aspect-square w-full object-cover" loading="lazy" />
          <span className="block truncate p-1 text-xs">{image.name}</span>
        </button>)}
        {!library.length && <p>No saved images.</p>}
      </div>}
    <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
      <Upload className="size-4" />
      {busy ? "Uploading..." : "Upload image"}
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp"
        disabled={busy}
        className="sr-only"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setBusy(true);
          try {
            if (file.size > 5000000) throw new Error("Choose an image under 5 MB.");
            const res = await fetch("/api/images", {
              method: "POST",
              headers: { ...tabHeaders(), "Content-Type": file.type },
              body: file,
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            onUploaded(data.url);
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Upload failed.");
          } finally {
            setBusy(false);
            e.target.value = "";
          }
        }}
      />
    </label>
    </div>
  );
}
