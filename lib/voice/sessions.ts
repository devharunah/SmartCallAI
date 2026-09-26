import type { ModelMessage } from "ai";
import { supabase } from "../supabase";
import { classifyIssue } from "../classify";
import { recordCall } from "../calls";
import type { CallChannel, CallResolution } from "../types";

// One row per phone call. Each Africa's Talking callback is its own request,
// so the conversation is loaded and saved here on every turn.

export type SessionStatus = "active" | CallResolution;

export interface VoiceSession {
  sessionId: string;
  callerNumber: string | null;
  messages: ModelMessage[];
  turns: number;
  misses: number;
  status: SessionStatus;
  summary: string | null;
  transferredAgentId: string | null;
  createdAt: string;
}

interface SessionRow {
  session_id: string;
  caller_number: string | null;
  messages: ModelMessage[];
  turns: number;
  misses: number;
  status: SessionStatus;
  summary: string | null;
  transferred_agent_id: string | null;
  created_at: string;
}

function toSession(row: SessionRow): VoiceSession {
  return {
    sessionId: row.session_id,
    callerNumber: row.caller_number,
    messages: row.messages ?? [],
    turns: row.turns,
    misses: row.misses,
    status: row.status,
    summary: row.summary,
    transferredAgentId: row.transferred_agent_id,
    createdAt: row.created_at,
  };
}

export async function getSession(sessionId: string): Promise<VoiceSession | null> {
  const { data, error } = await supabase
    .from("voice_sessions")
    .select("*")
    .eq("session_id", sessionId)
    .maybeSingle();
  if (error) throw error;
  return data ? toSession(data as SessionRow) : null;
}

/** Idempotent: AT may retry the first callback. */
export async function startSession(sessionId: string, callerNumber: string | null): Promise<VoiceSession> {
  const { data, error } = await supabase
    .from("voice_sessions")
    .upsert(
      { session_id: sessionId, caller_number: callerNumber },
      { onConflict: "session_id", ignoreDuplicates: true }
    )
    .select()
    .maybeSingle();
  if (error) throw error;
  return data ? toSession(data as SessionRow) : ((await getSession(sessionId)) as VoiceSession);
}

export async function saveSession(
  sessionId: string,
  patch: Partial<Pick<VoiceSession, "messages" | "turns" | "misses" | "status" | "summary" | "transferredAgentId">>
): Promise<void> {
  const { error } = await supabase
    .from("voice_sessions")
    .update({
      ...(patch.messages && { messages: patch.messages }),
      ...(patch.turns !== undefined && { turns: patch.turns }),
      ...(patch.misses !== undefined && { misses: patch.misses }),
      ...(patch.status && { status: patch.status }),
      ...(patch.summary !== undefined && { summary: patch.summary }),
      ...(patch.transferredAgentId !== undefined && { transferred_agent_id: patch.transferredAgentId }),
      updated_at: new Date().toISOString(),
    })
    .eq("session_id", sessionId);
  if (error) throw error;
}

/** What the caller said, in order: the input for classification and the calls row. */
export function callerTranscript(messages: ModelMessage[]): string {
  return messages
    .filter((m) => m.role === "user")
    .map((m) => (typeof m.content === "string" ? m.content : ""))
    .filter(Boolean)
    .join(" ");
}

/**
 * Final callback (isActive=0): write the calls row so phone calls show up in
 * Analytics beside web calls. Safe to call twice: calls.session_id is unique.
 */
export async function finishSession(
  sessionId: string,
  durationSeconds: number | null,
  channel: CallChannel
): Promise<void> {
  const session = await getSession(sessionId);
  if (!session) return;

  // Callers often just hang up once they have what they need: if the AI opened
  // a service request for them, that call was resolved, not abandoned.
  let resolution: CallResolution = session.status === "active" ? "abandoned" : session.status;
  if (session.status === "active") {
    const { count, error } = await supabase
      .from("service_requests")
      .select("id", { count: "exact", head: true })
      .eq("session_id", sessionId);
    if (error) throw error;
    if (count) resolution = "resolved";
    await saveSession(sessionId, { status: resolution });
  }

  const transcript = callerTranscript(session.messages);
  if (!transcript) return; // caller hung up before saying anything

  const { data: existing } = await supabase.from("calls").select("id").eq("session_id", sessionId).maybeSingle();
  if (existing) return;

  const classification = await classifyIssue(transcript);
  let assignedAgentName: string | null = null;
  if (session.transferredAgentId) {
    const { data } = await supabase.from("agents").select("name").eq("id", session.transferredAgentId).maybeSingle();
    assignedAgentName = (data as { name: string } | null)?.name ?? null;
  }

  await recordCall({
    transcript,
    category: classification.category,
    summary: session.summary ?? classification.summary,
    confidence: classification.confidence,
    reason: classification.reason,
    assignedAgentId: session.transferredAgentId,
    assignedAgentName,
    routingTimeMs: null,
    channel,
    callerNumber: session.callerNumber,
    sessionId,
    resolution,
    durationSeconds,
  });
}
