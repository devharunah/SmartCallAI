import { generateSpeech } from "ai";
import { openai } from "@ai-sdk/openai";
import { GREETING } from "./agent";

// Text to speech for the in-app voice call (phone providers speak <Say> themselves).

const VOICE = process.env.APP_TTS_VOICE ?? "alloy";

export async function speak(text: string): Promise<{ base64: string; mediaType: string }> {
  const { audio } = await generateSpeech({
    model: openai.speech(process.env.APP_TTS_MODEL ?? "gpt-4o-mini-tts"),
    text,
    voice: VOICE,
    outputFormat: "mp3",
    instructions: "Warm, calm, clear customer-support voice. Natural pace.",
    abortSignal: AbortSignal.timeout(10000),
  });
  return { base64: audio.base64, mediaType: audio.mediaType || "audio/mpeg" };
}

// The greeting never changes, so synthesize it once per server instance.
let greeting: Promise<{ base64: string; mediaType: string }> | null = null;
export function greetingAudio() {
  greeting ??= speak(GREETING).catch((err) => {
    greeting = null;
    throw err;
  });
  return greeting;
}
