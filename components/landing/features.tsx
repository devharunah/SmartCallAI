import { LayoutDashboard, Mic, Workflow, X } from "lucide-react";
import { BRAND } from "@/lib/brand";

// Adapted from Tailark Mist features-8 (MIT, github.com/tailark/blocks).
const BEFORE = [
  "Messages missed during the lunch rush",
  "Orders copied into a notebook by hand",
  "“Mpa menu” answered forty times a day",
  "Commission on every delivery-app order",
];

const FEATURES = [
  {
    icon: Mic,
    title: "Understands Luganda voice notes",
    text: "Customers order the way they'd message a friend. Voice notes and texts in Luganda or English are understood, and it replies in the same language.",
  },
  {
    icon: LayoutDashboard,
    title: "Orders land on a live board",
    text: "Each new order chimes on your phone or laptop with the items, total and delivery area. Accept it, cook it, send it, and the customer gets an update.",
  },
  {
    icon: Workflow,
    title: "You decide how it behaves",
    text: "See your assistant as a diagram. Change what it says, when it hands over to your staff, or add a step. No code.",
  },
];

export function Features() {
  return (
    <section id="features" className="scroll-mt-20 py-20 md:py-24">
      <div className="mx-auto w-full max-w-5xl px-6">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-semibold tracking-tight text-balance md:text-4xl">Orders come in by themselves</h2>
          <p className="mt-4 text-lg text-pretty text-muted-foreground">
            Your customers already message you on WhatsApp. {BRAND.name} answers every one of them, straight away.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="col-span-full grid gap-6 overflow-hidden rounded-xl bg-foreground/5 p-6 md:grid-cols-2 md:p-8">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Before</p>
              <ul className="mt-3 space-y-2">
                {BEFORE.map((item) => (
                  <li key={item} className="flex items-center gap-2 text-muted-foreground line-through decoration-foreground/20">
                    <X className="size-4 shrink-0 text-destructive" aria-hidden />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-lg bg-background p-5 ring-1 ring-foreground/10">
              <p className="text-sm font-medium text-muted-foreground">With {BRAND.name}</p>
              <p className="mt-3 text-lg font-medium text-pretty">&ldquo;Mpa menu&rdquo;</p>
              <p className="mt-2 text-pretty text-muted-foreground">
                The menu arrives as a picture in seconds. The customer picks, confirms the total, and the order is on your board. Nobody had to pick
                up a phone.
              </p>
            </div>
          </div>

          {FEATURES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-xl bg-foreground/5 p-6">
              <Icon className="size-5 text-foreground" aria-hidden />
              <h3 className="mt-5 text-lg font-semibold">{title}</h3>
              <p className="mt-3 text-pretty text-muted-foreground">{text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
