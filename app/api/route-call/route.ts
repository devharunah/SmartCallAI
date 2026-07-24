import { NextResponse } from "next/server";
import { classifyIssue } from "@/lib/classify";
import { findAvailableAgent, setAgentAvailability } from "@/lib/agents";
import { recordCall } from "@/lib/calls";
import type { RouteCallResponse } from "@/lib/types";

export async function POST(request: Request) {
  const start = Date.now();

  let transcript: string;
  try {
    const body = await request.json();
    transcript = typeof body.transcript === "string" ? body.transcript.trim() : "";
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!transcript) {
    return NextResponse.json({ error: "transcript is required" }, { status: 400 });
  }

  const classification = await classifyIssue(transcript);
  const agent = await findAvailableAgent(classification.category);

  if (agent) {
    await setAgentAvailability(agent.id, false);
  }

  const routingTimeMs = Date.now() - start;

  const call = await recordCall({
    transcript,
    category: classification.category,
    summary: classification.summary,
    confidence: classification.confidence,
    reason: classification.reason,
    assignedAgentId: agent?.id ?? null,
    assignedAgentName: agent?.name ?? null,
    routingTimeMs,
  });

  const response: RouteCallResponse = {
    ...classification,
    agent: agent ? { id: agent.id, name: agent.name, phone: agent.phone } : null,
    queued: !agent,
    callId: call.id,
  };

  return NextResponse.json(response);
}
