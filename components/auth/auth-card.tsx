import { BRAND } from "@/lib/brand";

/** Taller inputs for the auth forms (44px, per the design system) without changing Input everywhere. */
export const AUTH_INPUT = "h-11 bg-card px-4";

export function AuthCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="mx-auto grid max-w-300 gap-6 px-4 py-10 sm:px-6 md:py-16 lg:grid-cols-2 lg:items-stretch lg:gap-10">
      <div className="flex flex-col justify-center lg:py-10">
        <div className="mx-auto w-full max-w-md">
          <h1 className="font-heading text-4xl leading-[1.1] text-balance md:text-5xl">{title}</h1>
          <p className="mt-3 text-pretty text-body">{description}</p>
          <div className="mt-8 flex flex-col gap-4 rounded-2xl bg-card p-6 ring-1 ring-border sm:p-8">{children}</div>
          <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>
        </div>
      </div>

      {/* Atmosphere and a reminder of what's behind the sign-in; hidden on small screens. */}
      <aside aria-hidden className="relative hidden min-h-[36rem] overflow-hidden rounded-3xl bg-canvas-soft ring-1 ring-border lg:block">
        <div className="orb motion-safe:animate-orb -top-20 -left-16 size-96 bg-orb-mint" />
        <div className="orb motion-safe:animate-orb right-[-6rem] bottom-[-4rem] size-[26rem] bg-orb-peach [animation-delay:-8s]" />
        <div className="orb top-1/2 left-1/3 size-64 bg-orb-lavender opacity-60" />
        <div className="relative flex h-full flex-col justify-end gap-4 p-10">
          <div className="max-w-[80%] self-end rounded-2xl rounded-br-md bg-accent/60 px-4 py-3 text-sm backdrop-blur-sm">
            Hi, can I see the menu?
          </div>
          <div className="max-w-[80%] rounded-2xl rounded-bl-md bg-card/90 px-4 py-3 text-sm ring-1 ring-border backdrop-blur-sm">
            🛵 Order {BRAND.orderPrefix}-7F3K2 is on its way to you!
          </div>
          <p className="mt-6 max-w-sm font-heading text-3xl leading-[1.15]">{BRAND.tagline}</p>
        </div>
      </aside>
    </div>
  );
}
