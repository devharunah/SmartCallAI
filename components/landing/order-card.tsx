import { BellRing } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";
import { SUMMARY, TOTAL } from "./chat-preview";

const STEPS = ["New", "Accepted", "Preparing", "On the way"] as const;

/** The same order as the hero chat, as it lands on the restaurant's board. */
export function OrderCard({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-3xl bg-card p-5 shadow-[0_4px_16px_rgba(0,0,0,0.04)] ring-1 ring-border sm:p-6", className)}>
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-medium">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full rounded-full bg-success opacity-60 motion-safe:animate-ping" />
            <span className="relative inline-flex size-2 rounded-full bg-success" />
          </span>
          New order
        </p>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <BellRing className="size-3.5" aria-hidden /> 12:42
        </span>
      </div>

      <p className="mt-4 font-heading text-3xl tabular-nums">{TOTAL}</p>
      <p className="mt-1 text-sm text-muted-foreground">
        <span className="font-mono text-xs text-foreground">{BRAND.orderPrefix}-7F3K2</span> · Delivery to Ntinda · pay on arrival
      </p>

      <ul className="mt-5 space-y-2 border-t border-border pt-4 text-sm">
        {SUMMARY.slice(0, 2).map(([item, price]) => (
          <li key={item} className="flex justify-between gap-4">
            <span>{item}</span>
            <span className="text-muted-foreground tabular-nums">{price}</span>
          </li>
        ))}
      </ul>

      <ol aria-label="Order status" className="mt-5 flex flex-wrap gap-1.5">
        {STEPS.map((step, i) => (
          <li
            key={step}
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-medium",
              i === 0 ? "bg-primary text-primary-foreground" : "bg-surface-strong text-muted-foreground"
            )}
          >
            {step}
          </li>
        ))}
      </ol>
      <p className="mt-3 text-xs text-pretty text-muted-foreground">Each status change is sent to the customer on WhatsApp.</p>
    </div>
  );
}
