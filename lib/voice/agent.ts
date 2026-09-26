import { generateText, isStepCount, tool, type ModelMessage } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { findAvailableAgent, setAgentAvailability } from "../agents";
import { supabase } from "../supabase";
import { classifyIssue } from "../classify";
import { CATEGORIES } from "../types";
import { searchHelp } from "./knowledge";

// The voice agent's brain. It knows nothing about phones: the caller's words go
// in, one spoken reply plus what to do next comes out. Africa's Talking (or any
// other telephony provider) lives in the route handlers.

export type TurnAction =
  | { type: "continue" }
  | { type: "end"; resolved: boolean; summary: string }
  | { type: "transfer"; agent: { id: string; name: string; phone: string } | null; summary: string };

export interface TurnResult {
  reply: string;
  action: TurnAction;
  messages: ModelMessage[];
}

export const GREETING = "Hi, you've reached SmartCall. I'm an AI assistant and I can sort most things out right now. What can I help you with?";

const INSTRUCTIONS = `You are SmartCall, the AI phone assistant for a Kenyan company that offers billing, internet, cards, loans, insurance and sales.
Everything you write is read aloud by text-to-speech on a phone call.

How to talk:
- Reply in one to three short sentences. Plain spoken English. No lists, markdown, emojis, URLs or symbols.
- Ask one question at a time. Say numbers the way a person would.
- The caller's words come from speech recognition and may contain mistakes; if something is unclear, ask.

How to help:
- Try to solve the problem yourself first. Call searchHelp for any factual question about bills, internet, cards, loans, insurance, plans or hours, and only state facts that searchHelp returned.
- Walk the caller through the fix step by step and check whether it worked.
- When the fix needs follow-up work (a refund, a technician visit, a callback, unblocking a card, a claim), call openServiceRequest as soon as the caller agrees (if they already asked for it, don't ask again), and read them the reference with a short pause between characters. That counts as solving it; don't transfer for these.
- Call transferToHuman when the caller asks for a person, is upset, or the issue needs identity checks, account changes or anything searchHelp doesn't cover. Tell them you're connecting them.
- As soon as the caller says they have nothing else ("that's all", "no thanks", "bye"), you must call endCall in that same turn, then say a short goodbye. Never say goodbye without calling endCall.
- Never invent account details, balances or promises.`;

export async function runTurn({
  messages,
  userText,
  sessionId,
  callerNumber,
}: {
  messages: ModelMessage[];
  userText: string;
  sessionId: string;
  callerNumber: string | null;
}): Promise<TurnResult> {
  const history: ModelMessage[] = [...messages, { role: "user", content: userText }];
  // Set by the tools below; the cast stops TS narrowing it to "continue".
  let action = { type: "continue" } as TurnAction;

  const tools = {
    searchHelp: tool({
      description: "Search the help-desk knowledge base for how to solve a customer issue.",
      inputSchema: z.object({ query: z.string().min(2).max(200).describe("The caller's issue in a few words") }),
      execute: async ({ query }) => {
        const hits = searchHelp(query);
        return hits.length > 0
          ? hits.map((h) => ({ title: h.title, answer: h.answer }))
          : { result: "No article found. Offer to connect the caller to a person." };
      },
    }),
    openServiceRequest: tool({
      description: "Log follow-up work for the caller (refund, technician visit, callback, card unblock, claim). Returns a reference to read out.",
      inputSchema: z.object({
        category: z.enum(CATEGORIES),
        kind: z.enum(["refund", "technician_visit", "callback", "card_unblock", "claim", "other"]),
        details: z.string().min(5).max(500).describe("What was agreed with the caller"),
      }),
      execute: async ({ category, kind, details }) => {
        const reference = `SC-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
        const { error } = await supabase.from("service_requests").insert({
          reference,
          session_id: sessionId,
          caller_number: callerNumber,
          category,
          kind,
          details,
        });
        if (error) {
          console.error("[voice/agent] openServiceRequest failed", error);
          return { ok: false, result: "Could not log the request. Offer to connect the caller to a person." };
        }
        // TTS reads "SC-FQ34C" unpredictably; give the model a spelled-out form to say.
        return {
          ok: true,
          reference,
          sayItAs: reference.replace("-", "").split("").join(" "),
          note: "The request is logged for the team, not done yet. Say what happens next; never claim it is already completed.",
        };
      },
    }),
    transferToHuman: tool({
      description: "Connect the caller to a human agent in the right department.",
      inputSchema: z.object({
        category: z.enum(CATEGORIES),
        summary: z.string().max(300).describe("One sentence the human agent reads before picking up"),
      }),
      execute: async ({ category, summary }) => {
        const agent = await reserveAgent(category);
        action = { type: "transfer", agent, summary };
        return agent
          ? { connected: true, agentName: agent.name }
          : { connected: false, result: "Nobody is free right now. Tell the caller someone will call them back shortly." };
      },
    }),
    endCall: tool({
      description: "End the call once the caller's issue is handled and they have nothing else.",
      inputSchema: z.object({
        resolved: z.boolean().describe("Whether the caller's issue was solved"),
        summary: z.string().max(300),
      }),
      execute: async ({ resolved, summary }) => {
        action = { type: "end", resolved, summary };
        return { ok: true };
      },
    }),
  };

  const result = await generateText({
    model: openai(process.env.VOICE_MODEL ?? "gpt-4o-mini"),
    instructions: INSTRUCTIONS,
    messages: history,
    tools,
    stopWhen: isStepCount(4),
    maxOutputTokens: 200,
    temperature: 0.3,
    abortSignal: AbortSignal.timeout(8000),
  });

  const reply =
    result.text.trim() ||
    (action.type === "transfer"
      ? action.agent
        ? `Connecting you to ${action.agent.name} now.`
        : "Everyone is busy right now, so someone will call you back shortly."
      : action.type === "end"
        ? "Thanks for calling. Goodbye."
        : "Sorry, could you say that again?");

  return { reply, action, messages: [...history, ...result.responseMessages] };
}

/**
 * Used when the model call itself fails: fall back to the old router so the
 * caller still reaches a person instead of hearing silence.
 */
export async function fallbackTransfer(
  transcript: string,
  reason: "error" | "cant_hear" | "too_long" = "error"
): Promise<TurnResult> {
  const { category, summary } = await classifyIssue(transcript);
  const agent = await reserveAgent(category);
  const opener = {
    error: "Sorry, I'm having trouble on my side.",
    cant_hear: "Sorry, I'm having trouble hearing you.",
    too_long: "Let me get you some more help with this.",
  }[reason];
  return {
    reply: agent
      ? `${opener} I'm connecting you to ${agent.name} in ${category}.`
      : `${opener} Everyone is busy right now, so someone will call you back shortly.`,
    action: { type: "transfer", agent, summary },
    messages: [],
  };
}

// Two round-trips, so two simultaneous callers could grab the same agent.
// Acceptable for the demo; use one atomic RPC (FOR UPDATE SKIP LOCKED) before
// real traffic — see backend-patterns.
async function reserveAgent(category: (typeof CATEGORIES)[number]) {
  const agent = (await findAvailableAgent(category)) ?? (await findAvailableAgent("General Inquiry"));
  if (!agent) return null;
  await setAgentAvailability(agent.id, false);
  return { id: agent.id, name: agent.name, phone: agent.phone };
}
