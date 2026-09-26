import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

// A real exchange from the phone agent (scripts/voice-sim.mjs), trimmed. Shown as
// the hero visual because the product *is* the conversation.
const LINES = [
  { who: "ai", at: "0:00", text: "Hi, you've reached SmartCall. What can I help you with?" },
  { who: "caller", at: "0:04", text: "I was charged twice on my bill this month. Both have posted." },
  { who: "ai", at: "0:11", text: "Sorry about that. I've requested a refund for the duplicate charge. Your reference is SC-FQ34C." },
  { who: "caller", at: "0:19", text: "Great, that's all. Thanks." },
] as const;

export function CallTranscript({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-2xl bg-background text-left shadow-lg ring-1 shadow-black/5 ring-foreground/10",
        className
      )}
    >
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full rounded-full bg-accent opacity-60 motion-safe:animate-ping" />
            <span className="relative inline-flex size-2 rounded-full bg-accent" />
          </span>
          Incoming call · +254 7•• ••• 111
        </div>
        <span className="font-mono text-xs text-muted-foreground tabular-nums">0:21</span>
      </div>

      <ol className="space-y-4 px-5 py-5">
        {LINES.map((line) => (
          <li key={line.at} className="flex gap-3">
            <span className="w-9 shrink-0 pt-0.5 font-mono text-xs text-muted-foreground tabular-nums">{line.at}</span>
            <div className="min-w-0">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {line.who === "ai" ? "SmartCall AI" : "Caller"}
              </p>
              <p className={cn("mt-0.5 text-sm text-pretty", line.who === "ai" ? "text-foreground" : "text-muted-foreground")}>
                {line.text}
              </p>
            </div>
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border px-5 py-3 text-sm">
        <span className="flex items-center gap-1.5 font-medium">
          <CheckCircle2 className="size-4 text-accent" aria-hidden />
          Resolved by AI
        </span>
        <span className="text-muted-foreground">Refund request SC-FQ34C · no transfer</span>
      </div>
    </div>
  );
}
