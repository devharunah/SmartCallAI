import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Eyebrow } from "./features";

const FAQS = [
  {
    q: "What does it cost to run?",
    a: "WhatsApp gives each business number 1,000 free replies a month; after that each reply costs about UGX 15 (US$0.004). The AI costs a few shillings per conversation. There's no commission on your orders.",
  },
  {
    q: "Will it make up prices or dishes?",
    a: "No. It only offers what's on your menu, prices and totals come straight from your menu, and every order is shown to the customer to confirm before it reaches your kitchen.",
  },
  {
    q: "Can my staff take over a chat?",
    a: "Any time. Open the chat in your inbox and press Take over, and the AI goes quiet until you hand it back. Customers can also type “omuntu” or “person” to reach your staff.",
  },
  {
    q: "Do I need a new phone number?",
    a: "For now, yes. The assistant runs on a number connected to WhatsApp's Business Platform, and that number can't also be active in the regular WhatsApp app. Keeping your existing WhatsApp Business app number alongside it is coming later.",
  },
  {
    q: "Which languages does it understand?",
    a: "English and Luganda, typed or as voice notes, and it replies in whichever the customer uses. If a voice note is noisy or unclear, it asks again or hands the chat to your staff.",
  },
  {
    q: "Can customers pay with mobile money?",
    a: "Today customers pay cash or mobile money when their food arrives or when they collect it. Paying with MTN MoMo or Airtel Money inside the chat is next.",
  },
  {
    q: "What happens to customers' data?",
    a: "Chats are saved so your staff can see them and the order can be prepared. The assistant says so in its first message, as Uganda's Data Protection and Privacy Act expects.",
  },
];

export function FAQs() {
  return (
    <section id="faq" className="scroll-mt-20 py-16 md:py-24">
      <div className="mx-auto max-w-300 px-4 sm:px-6">
        <div className="grid gap-10 md:grid-cols-5 md:gap-16">
          <div className="md:col-span-2">
            <Eyebrow>FAQ</Eyebrow>
            <h2 className="mt-4 font-heading text-4xl leading-[1.1] md:text-5xl">Questions</h2>
            <p className="mt-5 text-lg text-balance text-body">What restaurant owners usually ask first.</p>
          </div>
          <div className="md:col-span-3">
            <Accordion type="single" collapsible className="border-y border-border">
              {FAQS.map((item, i) => (
                <AccordionItem key={item.q} value={`item-${i}`} className="border-border">
                  <AccordionTrigger className="cursor-pointer py-5 text-[17px] font-medium hover:no-underline">{item.q}</AccordionTrigger>
                  <AccordionContent>
                    <p className="pb-2 text-base text-pretty text-body">{item.a}</p>
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
