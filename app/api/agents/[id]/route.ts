import { NextResponse } from "next/server";
import { setAgentAvailability } from "@/lib/agents";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let available: unknown;
  try {
    const body = await request.json();
    available = body.available;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof available !== "boolean") {
    return NextResponse.json({ error: "available must be a boolean" }, { status: 400 });
  }

  const agent = await setAgentAvailability(id, available);
  return NextResponse.json(agent);
}
