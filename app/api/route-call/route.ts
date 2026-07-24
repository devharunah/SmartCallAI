import { NextResponse } from "next/server";
import { classifyIssue } from "@/lib/classify";
import { findAvailableAgent, setAgentAvailability } from "@/lib/agents";
import { recordCall } from "@/lib/calls";
import { CATEGORIES, type Category, type ClassificationResult, type RouteCallResponse } from "@/lib/types";

export async function POST(request: Request) {
  const start = Date.now();

  let transcript: string;
  let forceCategory: Category | undefined;
  try {
    const body = await request.json();
    transcript = typeof body.transcript === "string" ? body.transcript.trim() : "";
    forceCategory =
      typeof body.forceCategory === "string" &&
      (CATEGORIES as readonly string[]).includes(body.forceCategory)
        ? (body.forceCategory as Category)
        : undefined;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!transcript) {
    return NextResponse.json({ error: "transcript is required" }, { status: 400 });
  }

  // The customer explicitly asked to skip AI classification and talk to a general
  // agent instead (used by the low-confidence "not sure" escape hatch client-side).
  const classification: ClassificationResult = forceCategory
    ? {
        category: forceCategory,
        summary: transcript.length > 140 ? `${transcript.slice(0, 137)}...` : transcript,
        confidence: 100,
        reason: "Customer asked to speak with a general agent directly.",
      }
    : await classifyIssue(transcript);
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
