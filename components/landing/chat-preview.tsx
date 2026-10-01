import { Mic } from "lucide-react";
import { cn } from "@/lib/utils";

// The hero visual is the product: a customer ordering by voice note in
// Luganda and the assistant confirming with prices from the menu. Wording
// matches what the bot actually sends.

type Line =
  | { who: "customer"; voice?: string; text: string; at: string }
  | { who: "bot"; text: string; at: string; summary?: boolean };

const LINES: Line[] = [
  { who: "customer", voice: "0:06", text: "Oli otya, njagala rolex bbiri ne juice", at: "12:41" },
  { who: "bot", text: "Kale! Nkusseeko Classic Rolex bbiri ne passion juice emu. Ojja kukima oba tukuleetere?", at: "12:41" },
  { who: "customer", text: "Mundeetere e Ntinda, okumpi ne Capital Shoppers", at: "12:42" },
  { who: "bot", text: "", at: "12:42", summary: true },
];

export const SUMMARY = [
  ["2 × Classic Rolex", "UGX 10,000"],
  ["1 × Fresh passion juice", "UGX 4,000"],
  ["Okutuusa e Ntinda", "UGX 3,000"],
] as const;

export const TOTAL = "UGX 17,000";

// Static bar heights for the voice-note glyph; deterministic so server and client agree.
const WAVE = [5, 9, 14, 8, 12, 16, 10, 6, 11, 15, 9, 5, 8, 12, 7, 4];

function VoiceNote({ length }: { length: string }) {
  return (
    <span className="mb-1.5 flex items-center gap-2 text-muted-foreground">
      <span className="grid size-6 place-items-center rounded-full bg-card">
        <Mic className="size-3.5 text-foreground" aria-hidden />
      </span>
      <span aria-hidden className="flex h-4 items-center gap-0.5">
        {WAVE.map((h, i) => (
          <span key={i} className="w-0.5 rounded-full bg-foreground/45" style={{ height: h }} />
        ))}
      </span>
      <span className="text-xs tabular-nums">{length}</span>
      <span className="sr-only">Voice note</span>
    </span>
  );
}

export function ChatPreview({ className }: { className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-3xl bg-card shadow-[0_4px_16px_rgba(0,0,0,0.04)] ring-1 ring-border", className)}>
      <div className="flex items-center gap-3 border-b border-border px-5 py-3.5">
        <span aria-hidden className="grid size-9 place-items-center rounded-full bg-surface-strong font-heading text-lg">
          M
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Mama Rose Kitchen</p>
          <p className="text-xs text-muted-foreground">WhatsApp · replies instantly</p>
        </div>
      </div>

      <ol className="space-y-3 bg-canvas-soft px-4 py-5 text-sm sm:px-5">
        {LINES.map((line, i) =>
          line.who === "customer" ? (
            <li key={i} className="flex justify-end">
              <div className="max-w-[82%] rounded-2xl rounded-br-md bg-accent/45 px-3.5 py-2.5">
                {line.voice && <VoiceNote length={line.voice} />}
                <span className="text-pretty">{line.voice ? `“${line.text}”` : line.text}</span>
                <span className="float-right mt-1.5 ml-2 text-[11px] text-muted-foreground tabular-nums">{line.at}</span>
              </div>
            </li>
          ) : line.summary ? (
            <li key={i} className="flex flex-col items-start gap-2">
              <div className="w-full max-w-[86%] rounded-2xl rounded-bl-md bg-card px-3.5 py-3 ring-1 ring-border">
                <p className="font-medium">Kakasa order yo:</p>
                <dl className="mt-2 space-y-1">
                  {SUMMARY.map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">{k}</dt>
                      <dd className="whitespace-nowrap tabular-nums">{v}</dd>
                    </div>
                  ))}
                  <div className="flex justify-between gap-4 border-t border-border pt-1.5 font-medium">
                    <dt>Omugatte</dt>
                    <dd className="whitespace-nowrap tabular-nums">{TOTAL}</dd>
                  </div>
                </dl>
              </div>
              <div className="flex gap-1.5" aria-hidden>
                <span className="rounded-full bg-card px-3 py-1 text-xs font-medium ring-1 ring-input">Yee, kakasa</span>
                <span className="rounded-full bg-card px-3 py-1 text-xs font-medium ring-1 ring-input">Kyusa</span>
              </div>
            </li>
          ) : (
            <li key={i} className="flex">
              <div className="max-w-[86%] rounded-2xl rounded-bl-md bg-card px-3.5 py-2.5 ring-1 ring-border">
                <span className="text-pretty">{line.text}</span>
                <span className="float-right mt-1.5 ml-2 text-[11px] text-muted-foreground tabular-nums">{line.at}</span>
              </div>
            </li>
          )
        )}
      </ol>
    </div>
  );
}
