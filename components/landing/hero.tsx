import Link from "next/link";
import { ArrowRight, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CallTranscript } from "./call-transcript";

// Adapted from Tailark Mist hero-section-2 (MIT, github.com/tailark/blocks).
export function Hero() {
  const number = process.env.NEXT_PUBLIC_VOICE_NUMBER;

  return (
    <section className="relative overflow-hidden before:absolute before:inset-1 before:h-[calc(100%-10rem)] before:rounded-2xl before:bg-muted sm:before:inset-2 md:before:rounded-4xl lg:before:h-[calc(100%-14rem)]">
      <div className="pt-16 pb-4 md:pt-28 md:pb-8">
        <div className="relative z-10 mx-auto max-w-5xl px-6 text-center">
          <Link
            href="#how-it-works"
            className="mx-auto flex w-fit items-center gap-2 rounded-full border border-border bg-background py-1 pr-3 pl-1 text-sm transition-colors duration-150 hover:bg-background/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">New</span>
            <span className="font-medium">Talk to it in your browser, no phone number needed</span>
            <ArrowRight className="size-3.5 text-muted-foreground" aria-hidden />
          </Link>

          <h1 className="mx-auto mt-8 max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl md:text-6xl">
            No phone menu. Just say what&apos;s wrong.
          </h1>
          <p className="mx-auto my-6 max-w-xl text-lg text-balance text-muted-foreground">
            SmartCall answers the call, understands the problem in the caller&apos;s own words, and fixes it on the spot. It hands off to a person only when a person is needed.
          </p>

          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/call">Start a voice call</Link>
            </Button>
            {number ? (
              <Button asChild size="lg" variant="outline">
                <a href={`tel:${number.replace(/\s/g, "")}`}>
                  <Phone aria-hidden />
                  <span className="tabular-nums">Call {number}</span>
                </a>
              </Button>
            ) : (
              <Button asChild size="lg" variant="outline">
                <Link href="#how-it-works">See how it works</Link>
              </Button>
            )}
          </div>
        </div>

        <div className="relative z-10 mx-auto mt-12 max-w-2xl px-6 md:mt-16">
          <CallTranscript />
        </div>
      </div>
    </section>
  );
}
