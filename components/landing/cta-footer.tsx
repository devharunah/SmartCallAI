import Link from "next/link";
import { BrandLogo } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { BRAND } from "@/lib/brand";

export function CallToAction() {
  return (
    <section className="px-4 pb-16 sm:px-6 md:pb-24">
      <div className="relative mx-auto max-w-300 overflow-hidden rounded-3xl bg-canvas-soft px-6 py-20 text-center ring-1 ring-border md:py-28">
        <div aria-hidden>
          <div className="orb motion-safe:animate-orb -top-24 left-[12%] size-72 bg-orb-lavender sm:size-96" />
          <div className="orb motion-safe:animate-orb -bottom-28 right-[10%] size-72 bg-orb-sky [animation-delay:-6s] sm:size-96" />
          <div className="orb top-1/3 left-1/2 size-56 -translate-x-1/2 bg-orb-rose opacity-50" />
        </div>
        <div className="relative">
          <h2 className="mx-auto max-w-2xl font-heading text-4xl leading-[1.1] text-balance md:text-[3.25rem]">Order a rolex from the demo</h2>
          <p className="mx-auto mt-5 max-w-md text-lg text-pretty text-body">
            Message Mama Rose Kitchen by text or voice note and watch the order go through.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link href="/try">Try the demo</Link>
            </Button>
            <Button asChild size="lg" variant="ghost" className="w-full rounded-full sm:w-auto">
              <Link href="/signup">Set up your restaurant →</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

const LINKS = [
  {
    group: "Product",
    items: [
      { title: "Features", href: "/#features" },
      { title: "How it works", href: "/#how-it-works" },
      { title: "FAQ", href: "/#faq" },
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
    <footer className="border-t border-border">
      <div className="mx-auto max-w-300 px-4 pt-14 sm:px-6 md:pt-16">
        <div className="grid gap-10 md:grid-cols-5">
          <div className="md:col-span-3">
            <BrandLogo />
            <p className="mt-4 max-w-xs text-[15px] text-pretty text-body">{BRAND.tagline}</p>
          </div>
          <div className="grid grid-cols-2 gap-6 md:col-span-2">
            {LINKS.map((link) => (
              <div key={link.group} className="space-y-3 text-[15px]">
                <span className="block font-medium">{link.group}</span>
                {link.items.map((item) => (
                  <Link key={item.title} href={item.href} className="block text-body transition-colors duration-150 hover:text-foreground">
                    {item.title}
                  </Link>
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className="mt-14 flex flex-col gap-2 border-t border-border py-6 text-sm text-muted-foreground sm:flex-row sm:justify-between">
          <span>© {new Date().getFullYear()} {BRAND.name}</span>
          <span>Made in Kampala</span>
        </div>
      </div>
    </footer>
  );
}
