import { BellRing, MessageCircle, ScrollText } from "lucide-react";

// Adapted from Tailark Mist features-2 (MIT, github.com/tailark/blocks).
const STEPS = [
  {
    icon: ScrollText,
    title: "Add your menu",
    text: "Items and prices in shillings, with Luganda names and the words your customers use. Or start from a sample Kampala menu and edit it.",
    detail: "Chicken Luwombo · Luwombo w'enkoko · UGX 25,000",
  },
  {
    icon: MessageCircle,
    title: "Connect WhatsApp",
    text: "Link a WhatsApp Business number for your restaurant. Customers message it like any other chat, with nothing to download.",
    detail: "+256 7•• ••• 214 · connected",
  },
  {
    icon: BellRing,
    title: "Orders arrive",
    text: "The assistant shows the customer their order and total to confirm, then it appears on your board with a chime.",
    detail: "EM-7F3K2 · new order · UGX 17,000",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-20 bg-muted/50 py-20 md:py-24">
      <div className="mx-auto max-w-5xl px-6">
        <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">Set up in an afternoon</h2>
        <p className="mt-4 max-w-2xl text-lg text-pretty text-muted-foreground">
          No new hardware and no training for your staff. If you can use WhatsApp, you can run this.
        </p>

        <ol className="mt-12 grid gap-8 sm:grid-cols-2 md:grid-cols-3">
          {STEPS.map(({ icon: Icon, title, text, detail }, i) => (
            <li key={title} className="space-y-4">
              <div className="flex aspect-video flex-col justify-between overflow-hidden rounded-xl bg-foreground/5 p-5">
                <div className="flex items-center justify-between">
                  <span className="flex size-9 items-center justify-center rounded-full bg-background ring-1 ring-foreground/10">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <span className="font-mono text-sm text-muted-foreground tabular-nums">0{i + 1}</span>
                </div>
                <p className="truncate rounded-lg bg-background px-3 py-2 font-mono text-xs ring-1 ring-foreground/10">{detail}</p>
              </div>
              <div>
                <h3 className="text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-pretty text-muted-foreground">{text}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
