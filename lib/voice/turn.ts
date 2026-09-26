import { fallbackTransfer, runTurn, type TurnAction, type TurnResult } from "./agent";
import { callerTranscript, saveSession, type VoiceSession } from "./sessions";

// One conversation turn, independent of how the audio arrived (Africa's Talking
// recording, Twilio <Gather> speech result, or the in-app mic). Each transport
// only turns speech into `userText` and the result into its own reply format.

const MAX_TURNS = 12;
const MAX_MISSES = 2;

export type HandledAction = TurnAction | { type: "retry" };

export interface HandledTurn {
  reply: string;
  action: HandledAction;
}

export async function handleTurn({
  session,
  userText,
  callerNumber,
}: {
  session: VoiceSession;
  userText: string;
  callerNumber: string | null;
}): Promise<HandledTurn> {
  const { sessionId } = session;

  if (!userText) {
    const misses = session.misses + 1;
    if (misses <= MAX_MISSES) {
      await saveSession(sessionId, { misses });
      return { reply: "Sorry, I didn't catch that. Could you say it again?", action: { type: "retry" } };
    }
    // Can't hear them: hand to a person rather than loop forever.
    const turn = await fallbackTransfer(callerTranscript(session.messages) || "caller could not be understood", "cant_hear");
    return save(session, turn);
  }

  const soFar = `${callerTranscript(session.messages)} ${userText}`;
  let turn: TurnResult;
  try {
    turn =
      session.turns >= MAX_TURNS
        ? await fallbackTransfer(soFar, "too_long")
        : await runTurn({ messages: session.messages, userText, sessionId, callerNumber: callerNumber ?? session.callerNumber });
  } catch (err) {
    console.error("[voice/turn] agent failed, falling back to routing", err);
    turn = await fallbackTransfer(soFar);
  }
  return save(session, turn, userText);
}

async function save(session: VoiceSession, turn: TurnResult, userText?: string): Promise<HandledTurn> {
  // fallbackTransfer returns no history; keep what we had plus the last utterance.
  const messages =
    turn.messages.length > 0
      ? turn.messages
      : [...session.messages, ...(userText ? [{ role: "user" as const, content: userText }] : [])];

  const { action } = turn;
  await saveSession(session.sessionId, {
    messages,
    turns: session.turns + 1,
    misses: 0,
    ...(action.type === "end" && { status: action.resolved ? "resolved" : "abandoned", summary: action.summary }),
    ...(action.type === "transfer" && {
      status: "transferred",
      summary: action.summary,
      transferredAgentId: action.agent?.id ?? null,
    }),
  });
  return { reply: turn.reply, action };
}
