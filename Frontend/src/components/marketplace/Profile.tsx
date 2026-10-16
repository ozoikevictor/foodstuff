import { useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/hooks/use-marketplace";
import { request } from "@/services/api";
import { Field, fieldClass, commandClass, ErrorState } from "./shared";
export function Profile() {
  const { data: user } = useSession();
  const client = useQueryClient();
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  if (!user) return null;
  return (
    <form
      className="max-w-lg space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        setBusy(true);
        setError(undefined);
        try {
          await request("/profile", "PATCH", {
            name: data.get("name"),
            phone: data.get("phone"),
            contactConsent: data.get("consent") === "on",
          });
          await client.invalidateQueries({ queryKey: ["session"] });
          toast.success("Your profile has been updated.");
        } catch (e) {
          setError(e);
        } finally {
          setBusy(false);
        }
      }}
    >
      <Field label="Full name">
        <input name="name" required minLength={2} maxLength={150} autoComplete="name" defaultValue={user.name} className={fieldClass} />
      </Field>
      <Field label="Email address">
        <input type="email" value={user.email} readOnly className={`${fieldClass} bg-muted text-muted-foreground`} />
      </Field>
      <Field label="Phone">
        <input name="phone" type="tel" required pattern="(0[0-9]{10}|\+234[0-9]{10})" autoComplete="tel" title="Use 08012345678 or +2348012345678" defaultValue={user.phone} className={fieldClass} />
      </Field>
      {user.role === "RIDER" && (
        <label className="flex items-start gap-2 text-sm">
          <input name="consent" type="checkbox" defaultChecked={user.contactConsent} />
          Share my phone number with customers during assigned deliveries.
        </label>
      )}
      {!!error && <ErrorState error={error} />}
      <button className={commandClass} disabled={busy}>
        {busy ? "Saving..." : "Save profile"}
      </button>
    </form>
  );
}
