import { BookOpenCheck, ClipboardList, Headset, X } from "lucide-react";

// Adapted from Tailark Mist features-8 (MIT, github.com/tailark/blocks).
const MENU = ["Press 1 for billing", "Press 2 for internet", "Press 3 for cards", "Press 9 to repeat"];

const FEATURES = [
  {
    icon: BookOpenCheck,
    title: "Solves it from your help content",
    text: "Walks the caller through the fix, like restarting a router or explaining a pending charge. It only says what your knowledge base says.",
  },
  {
    icon: ClipboardList,
    title: "Opens the follow-up for them",
    text: "Refunds, technician visits, callbacks and card unblocks are logged during the call, and the caller hears the reference number.",
  },
  {
    icon: Headset,
    title: "Hands off with context",
    text: "When someone asks for a person, or the issue needs one, it dials the right available agent and passes along a one-line summary.",
  },
];

export function Features() {
  return (
    <section id="features" className="scroll-mt-20 py-20 md:py-24">
      <div className="mx-auto w-full max-w-5xl px-6">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-semibold tracking-tight text-balance md:text-4xl">
            It fixes the problem instead of routing it
          </h2>
          <p className="mt-4 text-lg text-pretty text-muted-foreground">
            Menus make callers do the sorting. SmartCall listens once and does the work.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="col-span-full grid gap-6 overflow-hidden rounded-xl bg-foreground/5 p-6 md:grid-cols-2 md:p-8">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Before</p>
              <ul className="mt-3 space-y-2">
                {MENU.map((item) => (
                  <li key={item} className="flex items-center gap-2 text-muted-foreground line-through decoration-foreground/20">
                    <X className="size-4 shrink-0 text-destructive" aria-hidden />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-lg bg-background p-5 ring-1 ring-foreground/10">
              <p className="text-sm font-medium text-muted-foreground">With SmartCall</p>
              <p className="mt-3 text-lg font-medium text-pretty">
                &ldquo;My internet keeps dropping every evening.&rdquo;
              </p>
              <p className="mt-2 text-pretty text-muted-foreground">
                The AI asks one question, walks through a restart, and books a technician if the line light stays red.
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
