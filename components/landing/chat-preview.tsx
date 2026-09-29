import { CheckCircle2, Mic } from "lucide-react";
import { cn } from "@/lib/utils";

// The hero visual is the product: a customer ordering by voice note in
// Luganda, the assistant confirming with prices from the menu, and the order
// landing on the kitchen board. Wording matches what the bot actually sends.

type Line =
  | { who: "customer"; voice?: string; text: string; at: string }
  | { who: "bot"; text: string; at: string; summary?: boolean };

const LINES: Line[] = [
  { who: "customer", voice: "0:06", text: "Oli otya, njagala rolex bbiri ne juice", at: "12:41" },
  { who: "bot", text: "Kale! Nkusseeko Classic Rolex bbiri ne passion juice emu. Ojja kukima oba tukuleetere?", at: "12:41" },
  { who: "customer", text: "Mundeetere e Ntinda, okumpi ne Capital Shoppers", at: "12:42" },
  { who: "bot", text: "", at: "12:42", summary: true },
];

const SUMMARY = [
  ["2 × Classic Rolex", "UGX 10,000"],
  ["1 × Fresh passion juice", "UGX 4,000"],
  ["Okutuusa e Ntinda", "UGX 3,000"],
] as const;

export function ChatPreview({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-2xl bg-background text-left shadow-lg ring-1 shadow-black/5 ring-foreground/10", className)}>
      <div className="flex items-center gap-3 border-b border-border px-5 py-3">
        <span aria-hidden className="grid size-8 place-items-center rounded-full bg-accent/20 text-sm font-semibold">M</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Mama Rose Kitchen</p>
          <p className="text-xs text-muted-foreground">WhatsApp · AI assistant</p>
        </div>
      </div>

      <ol className="space-y-3 bg-muted/50 px-4 py-5 sm:px-5">
        {LINES.map((line, i) =>
          line.who === "customer" ? (
            <li key={i} className="flex justify-end">
              <div className="max-w-[80%] rounded-2xl rounded-br-md bg-accent/25 px-3 py-2 text-sm">
                {line.voice && (
                  <span className="mb-0.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Mic className="size-3.5" aria-hidden /> Voice note · <span className="tabular-nums">{line.voice}</span>
                  </span>
                )}
                <span className="text-pretty">{line.voice ? `“${line.text}”` : line.text}</span>
                <span className="float-right mt-1 ml-2 text-[11px] text-muted-foreground tabular-nums">{line.at}</span>
              </div>
            </li>
          ) : line.summary ? (
            <li key={i} className="flex flex-col items-start gap-1.5">
              <div className="w-full max-w-[85%] rounded-2xl rounded-bl-md bg-background px-3 py-2.5 text-sm shadow-xs ring-1 ring-foreground/5">
                <p className="font-medium">Kakasa order yo:</p>
                <dl className="mt-1.5 space-y-0.5">
                  {SUMMARY.map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">{k}</dt>
                      <dd className="tabular-nums">{v}</dd>
                    </div>
                  ))}
                  <div className="flex justify-between gap-4 border-t pt-1 font-semibold">
                    <dt>Omugatte</dt>
                    <dd className="tabular-nums">UGX 17,000</dd>
                  </div>
                </dl>
              </div>
              <div className="flex gap-1.5" aria-hidden>
                <span className="rounded-full border bg-background px-3 py-1 text-xs font-medium">Yee, kakasa</span>
                <span className="rounded-full border bg-background px-3 py-1 text-xs font-medium">Kyusa</span>
              </div>
            </li>
          ) : (
            <li key={i} className="flex">
              <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-background px-3 py-2 text-sm shadow-xs ring-1 ring-foreground/5">
                <span className="text-pretty">{line.text}</span>
                <span className="float-right mt-1 ml-2 text-[11px] text-muted-foreground tabular-nums">{line.at}</span>
              </div>
            </li>
          )
        )}
      </ol>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border px-5 py-3 text-sm">
        <span className="flex items-center gap-1.5 font-medium">
          <CheckCircle2 className="size-4 text-accent" aria-hidden />
          On the kitchen board
        </span>
        <span className="text-muted-foreground">Order EM-7F3K2 · delivery · pay on arrival</span>
      </div>
    </div>
  );
}
