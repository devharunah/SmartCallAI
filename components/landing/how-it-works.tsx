import { Eyebrow } from "./features";

const STEPS = [
  {
    title: "Add your menu",
    text: "Items and prices in shillings, with Luganda names and the words your customers use. Or start from a sample Kampala menu and edit it.",
    detail: "Chicken Luwombo · Luwombo w'enkoko · UGX 25,000",
  },
  {
    title: "Connect WhatsApp",
    text: "Link a WhatsApp Business number for your restaurant. Customers message it like any other chat, with nothing to download.",
    detail: "+256 7•• ••• 214 · connected",
  },
  {
    title: "Orders arrive",
    text: "The assistant shows the customer their order and total to confirm, then it appears on your board with a chime.",
    detail: "new order · UGX 17,000",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-20 bg-canvas-soft py-16 md:py-24">
      <div className="mx-auto max-w-300 px-4 sm:px-6">
        <div className="max-w-2xl">
          <Eyebrow>How it works</Eyebrow>
          <h2 className="mt-4 font-heading text-4xl leading-[1.1] text-balance md:text-5xl">Set up in an afternoon</h2>
          <p className="mt-5 text-lg text-pretty text-body">
            No new hardware and no training for your staff. If you can use WhatsApp, you can run this.
          </p>
        </div>

        <ol className="mt-14 grid gap-10 md:grid-cols-3 md:gap-8">
          {STEPS.map(({ title, text, detail }, i) => (
            <li key={title} className="min-w-0 border-t border-foreground/15 pt-6">
              <span className="font-heading text-5xl text-muted-foreground tabular-nums">0{i + 1}</span>
              <h3 className="mt-6 text-xl font-medium">{title}</h3>
              <p className="mt-3 text-pretty text-body">{text}</p>
              <p className="mt-5 truncate rounded-full bg-card px-4 py-2 font-mono text-xs text-muted-foreground ring-1 ring-border">{detail}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
