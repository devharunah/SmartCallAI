import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

// Adapted from Tailark Mist faqs-2 (MIT, github.com/tailark/blocks).
const FAQS = [
  {
    q: "What happens if the AI can't help?",
    a: "It says so and connects the caller to an available person in the right department, with a short summary so they don't have to repeat themselves. If nobody is free, the caller is told someone will call back.",
  },
  {
    q: "Can it make things up?",
    a: "It's instructed to state facts only from your help content and never to invent balances, account details or promises. Anything outside that goes to a person.",
  },
  {
    q: "Which phone numbers does it work with?",
    a: "Local Kenyan numbers from Africa's Talking, or Twilio numbers (a free Twilio trial can be used for testing, within its limits). Calls reach the app as ordinary web requests, so there's no extra voice server to run.",
  },
  {
    q: "How natural does it sound?",
    a: "It works turn by turn: the caller speaks, pauses, and hears a reply a few seconds later. It's not yet as fluid as talking to a person, and fully streaming voice is the next step.",
  },
  {
    q: "Can I try it without a phone number?",
    a: "Yes. The demo call runs in your browser with your microphone and talks to the exact same AI agent as the phone line. No phone number or telecom account is needed.",
  },
];

export function FAQs() {
  return (
    <section id="faq" className="scroll-mt-20 py-20 md:py-24">
      <div className="mx-auto max-w-5xl px-6">
        <div className="grid gap-8 md:grid-cols-5 md:gap-12">
          <div className="md:col-span-2">
            <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">Questions</h2>
            <p className="mt-4 text-lg text-balance text-muted-foreground">What teams usually ask before switching off their phone menu.</p>
          </div>
          <div className="md:col-span-3">
            <Accordion type="single" collapsible>
              {FAQS.map((item, i) => (
                <AccordionItem key={item.q} value={`item-${i}`}>
                  <AccordionTrigger className="cursor-pointer text-base hover:no-underline">{item.q}</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-base text-pretty text-muted-foreground">{item.a}</p>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </div>
    </section>
  );
}
