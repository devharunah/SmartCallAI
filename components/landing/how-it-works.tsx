import { AudioLines, BrainCircuit, PhoneIncoming } from "lucide-react";

// Adapted from Tailark Mist features-2 (MIT, github.com/tailark/blocks).
const STEPS = [
  {
    icon: PhoneIncoming,
    title: "The caller just talks",
    text: "They dial your local number and describe the problem however they like. No keypad, no menu tree.",
    detail: "“I was charged twice this month.”",
  },
  {
    icon: BrainCircuit,
    title: "The AI understands and acts",
    text: "Each reply is transcribed, then an AI agent built on the Vercel AI SDK checks your help content and decides what to do.",
    detail: "searchHelp → openServiceRequest",
  },
  {
    icon: AudioLines,
    title: "Solved, or handed off",
    text: "The caller hears the answer or their reference number. If a person is needed, the call goes to the right agent.",
    detail: "Resolved · SC-FQ34C",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-20 bg-muted/50 py-20 md:py-24">
      <div className="mx-auto max-w-5xl px-6">
        <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">How a call works</h2>
        <p className="mt-4 max-w-2xl text-lg text-pretty text-muted-foreground">
          Every turn of the conversation is a normal web request to the app, so it runs entirely on Next.js with no separate voice server.
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
