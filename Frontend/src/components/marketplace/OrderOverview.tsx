import { Check, Clock3, CreditCard, Package, Truck, MapPin } from "lucide-react";

export function orderDate(value?: string) {
  if (!value) return "Date unavailable";
  const date = new Date(
    /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value) ? value.replace(" ", "T") + "Z" : value,
  );
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("en-NG", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(date)
    : "Date unavailable";
}
const stages = [
  { label: "Placed", statuses: ["Order Placed", "Payment Confirmed"], icon: CreditCard },
  {
    label: "Preparing",
    statuses: ["Order Confirmed", "Preparing Your Order", "Ready for Dispatch", "Rider Assigned"],
    icon: Package,
  },
  { label: "On the way", statuses: ["Out for Delivery", "Arriving Soon"], icon: Truck },
  {
    label: "Delivered",
    statuses: ["Rider Marked Delivered", "Customer Confirmed Received", "Completed"],
    icon: MapPin,
  },
];
export function OrderOverview({ order }: { order: any }) {
  const stage = stages.findIndex((step) => step.statuses.includes(order.status));
  const messages: Record<string, string> = {
    "Order Placed": "Your order is saved. Complete payment to continue.",
    "Payment Confirmed": "Payment received. Waiting for the store to confirm your order.",
    "Order Confirmed": "The store has confirmed your order.",
    "Preparing Your Order": "Your foodstuff is being prepared for dispatch.",
    "Ready for Dispatch": "Your order is packed and waiting for dispatch.",
    "Rider Assigned": "A rider has been assigned. Delivery has not started yet.",
    "Out for Delivery": "Your rider is on the way to your delivery address.",
    "Arriving Soon": "Your rider is nearby. Please keep your phone available.",
    "Rider Marked Delivered":
      "The rider has marked this delivery complete. Please confirm receipt below.",
    "Customer Confirmed Received": "You have confirmed receipt of your order.",
    Completed: "Your order is complete. Thank you for shopping with NaijaFresh.",
    Cancelled: "This order was cancelled. Check the payment status and contact support if needed.",
    "Delivery Failed": "Delivery could not be completed. Contact support to discuss the next step.",
    Disputed: "A delivery problem has been reported. Follow the updates below.",
    Returned: "This order has been returned. Check the latest order updates below.",
  };
  const paid = order.payment_status === "paid";
  return (
    <section
      aria-label="Order status"
      className="mb-6 overflow-hidden rounded-2xl border border-primary/15 bg-accent/40"
    >
      <div className="flex items-start gap-3 p-5">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-card text-primary">
          <Package className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Delivery status
          </p>
          <h3 className="mt-1 text-lg font-bold">{order.status}</h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {messages[order.status] || "Check the latest order activity below."}
          </p>
        </div>
      </div>
      {stage >= 0 && (
        <ol
          aria-label="Delivery stages"
          className="grid grid-cols-2 gap-4 border-t border-primary/10 px-5 py-5 sm:grid-cols-4"
        >
          {stages.map(({ label, icon: Icon }, index) => (
            <li
              key={label}
              aria-current={index === stage ? "step" : undefined}
              className="flex items-center gap-2"
            >
              <span
                className={`grid size-8 shrink-0 place-items-center rounded-full ${index <= stage ? "bg-primary text-primary-foreground" : "border border-border bg-card text-muted-foreground"}`}
              >
                {index < stage ? <Check className="size-4" /> : <Icon className="size-4" />}
              </span>
              <span
                className={`text-xs ${index <= stage ? "font-bold text-primary" : "text-muted-foreground"}`}
              >
                {label}
              </span>
            </li>
          ))}
        </ol>
      )}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-primary/10 bg-card/60 px-5 py-3 text-xs">
        <span className="flex items-center gap-2">
          <CreditCard className="size-4 text-primary" />
          Payment:{" "}
          <strong className={paid ? "text-primary" : "text-foreground"}>
            {paid ? "Paid" : (order.payment_status || "Unavailable").replaceAll("_", " ")}
          </strong>
        </span>
        <span className="flex items-center gap-2 text-muted-foreground">
          <Clock3 className="size-3.5" />
          Placed {orderDate(order.created_at)}
        </span>
      </div>
    </section>
  );
}
