import type { Metadata } from "next";
import Link from "next/link";
import { CallSession } from "@/components/call-session";
import { VoiceCall } from "@/components/voice-call";

export const metadata: Metadata = { title: "Demo call · SmartCall AI" };

// /call        -> voice call with the AI agent (same agent as the phone line)
// /call?mode=router -> the original speak/type-and-route flow
export default async function CallPage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const { mode } = await searchParams;

  if (mode === "router") {
    return (
      <>
        <CallSession />
        <p className="pb-12 text-center text-sm text-muted-foreground">
          <Link href="/call" className="underline underline-offset-4 hover:text-foreground">
            Back to the voice call with the AI agent
          </Link>
        </p>
      </>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-10 sm:px-6 sm:py-12">
      <VoiceCall />
      <p className="text-center text-sm text-pretty text-muted-foreground">
        Can&apos;t use a microphone?{" "}
        <Link href="/call?mode=router" className="underline underline-offset-4 hover:text-foreground">
          Type your issue instead
        </Link>
      </p>
    </div>
  );
}
