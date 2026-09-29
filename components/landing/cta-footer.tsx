import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BRAND } from "@/lib/brand";

// Adapted from Tailark Mist call-to-action-1 and footer-2 (MIT, github.com/tailark/blocks).
export function CallToAction() {
  return (
    <section className="px-2 pb-2">
      <div className="mx-auto max-w-5xl rounded-2xl bg-primary px-6 py-16 text-center text-primary-foreground md:rounded-4xl md:py-20">
        <h2 className="text-3xl font-semibold tracking-tight text-balance lg:text-4xl">Order a rolex from the demo</h2>
        <p className="mx-auto mt-4 max-w-md text-pretty text-primary-foreground/70">
          Message Mama Rose Kitchen by text or voice note, in Luganda or English, and watch the order go through.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Button asChild size="lg" variant="accent">
            <Link href="/try">Try the demo</Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="border-primary-foreground/20 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
          >
            <Link href="/signup">Set up your restaurant</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

const LINKS = [
  {
    group: "Product",
    items: [
      { title: "Features", href: "#features" },
      { title: "How it works", href: "#how-it-works" },
      { title: "FAQ", href: "#faq" },
    ],
  },
  {
    group: "App",
    items: [
      { title: "Try the demo", href: "/try" },
      { title: "Dashboard", href: "/dashboard" },
      { title: "Sign up", href: "/signup" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="pt-16">
      <div className="mx-auto max-w-5xl px-6">
        <div className="grid gap-10 md:grid-cols-5">
          <div className="md:col-span-3">
            <p className="font-semibold tracking-tight">{BRAND.name}</p>
            <p className="mt-2 max-w-xs text-sm text-pretty text-muted-foreground">{BRAND.tagline} Made in Kampala.</p>
          </div>
          <div className="grid grid-cols-2 gap-6 md:col-span-2">
            {LINKS.map((link) => (
              <div key={link.group} className="space-y-3 text-sm">
                <span className="block font-medium">{link.group}</span>
                {link.items.map((item) => (
                  <Link key={item.title} href={item.href} className="block text-muted-foreground transition-colors duration-150 hover:text-foreground">
                    {item.title}
                  </Link>
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className="mt-12 border-t border-border py-6 text-sm text-muted-foreground">
          © {new Date().getFullYear()} {BRAND.name}
        </div>
      </div>
    </footer>
  );
}
