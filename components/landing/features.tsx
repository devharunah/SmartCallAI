import { Check, Play, X } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";

const FACTS = [
  { value: "0%", label: "Commission on your orders" },
  { value: "Seconds", label: "To answer every message, day and night" },
  { value: "Text or voice", label: "Customers order however they like" },
];

/** Three plain facts under the hero, separated by hairlines rather than boxed. */
export function Facts() {
  return (
    <section aria-label="At a glance" className="border-y border-border">
      <dl className="mx-auto grid max-w-300 divide-y divide-border px-4 sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:px-6">
        {FACTS.map((f) => (
          <div key={f.label} className="py-8 sm:px-8 sm:first:pl-0 sm:last:pr-0">
            <dt className="text-sm text-muted-foreground">{f.label}</dt>
            <dd className="mt-1 font-heading text-4xl">{f.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

const BEFORE = [
  "Messages missed during the lunch rush",
  "Orders copied into a notebook by hand",
  "“Menu please?” answered forty times a day",
  "Commission on every delivery-app order",
];

const AFTER = [
  "Every message answered straight away",
  "Orders typed out for you, with the right prices",
  "The menu sent as a picture in seconds",
  "Your customers, your number, no middleman",
];

export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase", className)}>{children}</p>;
}

export function BeforeAfter() {
  return (
    <section className="py-16 md:py-24">
      <div className="mx-auto max-w-300 px-4 sm:px-6">
        <div className="max-w-2xl">
          <Eyebrow>The problem</Eyebrow>
          <h2 className="mt-4 font-heading text-4xl leading-[1.1] text-balance md:text-5xl">
            Your customers already order on WhatsApp. Someone has to answer.
          </h2>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl p-6 ring-1 ring-border md:p-8">
            <p className="text-sm font-medium text-muted-foreground">Today</p>
            <ul className="mt-5 space-y-3.5">
              {BEFORE.map((item) => (
                <li key={item} className="flex items-start gap-3 text-body">
                  <X className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="relative overflow-hidden rounded-2xl bg-card p-6 ring-1 ring-border md:p-8">
            <div aria-hidden className="orb -top-24 -right-20 size-64 bg-orb-mint opacity-60" />
            <p className="relative text-sm font-medium text-muted-foreground">With {BRAND.name}</p>
            <ul className="relative mt-5 space-y-3.5">
              {AFTER.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <Check className="mt-1 size-4 shrink-0 text-success" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

// Static bar heights for the waveform glyph; deterministic so server and client agree.
const WAVE = [6, 10, 18, 12, 24, 30, 20, 14, 26, 34, 22, 12, 18, 28, 16, 10, 20, 26, 14, 8, 12, 18, 10, 6];

function Waveform() {
  return (
    <div className="mt-auto flex items-center gap-3 rounded-full bg-surface-strong p-2 pr-4">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
        <Play className="ml-0.5 size-4 fill-current" aria-hidden />
      </span>
      <span aria-hidden className="flex h-9 flex-1 items-center gap-0.75 overflow-hidden">
        {WAVE.map((h, i) => (
          <span key={i} className={cn("w-0.75 shrink-0 rounded-full", i < 9 ? "bg-foreground" : "bg-foreground/25")} style={{ height: h }} />
        ))}
      </span>
      <span className="text-xs text-muted-foreground tabular-nums">0:06</span>
    </div>
  );
}

function MiniBoard() {
  const cols = [
    { label: "New", items: 2 },
    { label: "Preparing", items: 1 },
    { label: "On the way", items: 1 },
  ];
  return (
    <div aria-hidden className="mt-auto grid grid-cols-3 gap-2">
      {cols.map((c) => (
        <div key={c.label} className="rounded-xl bg-surface-strong p-2">
          <p className="truncate text-[11px] font-medium text-muted-foreground">{c.label}</p>
          <div className="mt-2 space-y-1.5">
            {Array.from({ length: c.items }, (_, i) => (
              <div key={i} className="h-7 rounded-md bg-card ring-1 ring-border" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function MiniFlow() {
  const nodes = ["Greeting", "Send menu", "Take order", "Confirm"];
  return (
    <ol aria-hidden className="mt-auto flex flex-col items-start gap-1.5">
      {nodes.map((n, i) => (
        <li key={n} className="flex items-center gap-2 text-xs">
          <span className={cn("rounded-full px-3 py-1.5 font-medium ring-1", i === 2 ? "bg-primary text-primary-foreground ring-primary" : "bg-card ring-border")}>
            {n}
          </span>
          {i === 2 && <span className="text-muted-foreground">editing…</span>}
        </li>
      ))}
    </ol>
  );
}

const FEATURES = [
  {
    title: "Reads texts and voice notes",
    text: "Customers order the way they'd message a friend. It understands what they want, asks about anything missing, and replies in their language.",
    visual: <Waveform />,
  },
  {
    title: "Orders land on a live board",
    text: "Each new order chimes with the items, total and delivery area. Accept it, cook it, send it, and the customer gets an update.",
    visual: <MiniBoard />,
  },
  {
    title: "You decide how it behaves",
    text: "See your assistant as a diagram. Change what it says, when it hands over to your staff, or add a step. No code.",
    visual: <MiniFlow />,
  },
];

export function Features() {
  return (
    <section id="features" className="scroll-mt-20 py-16 md:py-24">
      <div className="mx-auto max-w-300 px-4 sm:px-6">
        <div className="max-w-2xl">
          <Eyebrow>What it does</Eyebrow>
          <h2 className="mt-4 font-heading text-4xl leading-[1.1] text-balance md:text-5xl">Orders come in by themselves</h2>
          <p className="mt-5 text-lg text-pretty text-body">
            {BRAND.name} answers every customer straight away, and the order is on your board before anyone picks up a phone.
          </p>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ title, text, visual }) => (
            <article key={title} className="flex min-h-88 flex-col gap-6 rounded-2xl bg-card p-6 ring-1 ring-border transition-shadow duration-200 hover:shadow-[0_4px_16px_rgba(0,0,0,0.04)]">
              <div>
                <h3 className="text-xl font-medium">{title}</h3>
                <p className="mt-3 text-pretty text-body">{text}</p>
              </div>
              {visual}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
