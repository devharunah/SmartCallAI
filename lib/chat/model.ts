import { gateway, type LanguageModel } from "ai";
import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";

// Gemini Flash writes Luganda far better than GPT-4o-mini (see
// docs/research/whatsapp-restaurant-uganda.html and scripts/evals), so it's the
// default: directly with a Google AI Studio key, or through the Vercel AI
// Gateway. OpenAI is the fallback when neither is set or the call fails. It
// understands Luganda orders fine but writes clumsy Luganda.

export function primaryChatModel(): { model: LanguageModel; label: string } | null {
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    const id = process.env.CHAT_MODEL?.replace(/^google\//, "") ?? "gemini-2.5-flash";
    return { model: google(id), label: `google:${id}` };
  }
  if (process.env.AI_GATEWAY_API_KEY) {
    const id = process.env.CHAT_MODEL ?? "google/gemini-2.5-flash";
    return { model: gateway(id), label: `gateway:${id}` };
  }
  return null;
}

export function fallbackChatModel(): { model: LanguageModel; label: string } {
  const id = process.env.CHAT_FALLBACK_MODEL ?? "gpt-4o-mini";
  return { model: openai(id), label: `openai:${id}` };
}
