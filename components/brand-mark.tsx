import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";

/** Path data shared with app/icon.tsx and app/apple-icon.tsx: a chat bubble holding an order list. */
export const MARK_BUBBLE = "M12 3.5c-4.7 0-8.5 3.3-8.5 7.4 0 2.2 1.1 4.2 2.9 5.6L5.6 20l4-1.9c.8.2 1.6.3 2.4.3 4.7 0 8.5-3.3 8.5-7.4S16.7 3.5 12 3.5Z";
export const MARK_LINES = ["M8.5 9h7", "M8.5 11.5h7", "M8.5 14h4"];

export function BrandMark({ className }: { className?: string }) {
  return (
    <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground", className)}>
      <svg viewBox="0 0 24 24" fill="none" aria-hidden className="size-[62%]">
        <path d={MARK_BUBBLE} fill="currentColor" />
        {MARK_LINES.map((d) => (
          <path key={d} d={d} stroke="var(--primary)" strokeWidth="1.5" strokeLinecap="round" />
        ))}
      </svg>
    </span>
  );
}

/** Mark + wordmark. The wordmark is the display serif, like the headlines. */
export function BrandLogo({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <BrandMark />
      <span className="font-heading text-[22px] leading-none tracking-tight">{BRAND.name}</span>
    </span>
  );
}
