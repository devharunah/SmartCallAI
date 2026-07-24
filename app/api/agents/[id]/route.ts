import { NextResponse } from "next/server";
import { deleteAgent, updateAgent, type AgentInput } from "@/lib/agents";
import { CATEGORIES, type Category } from "@/lib/types";

function isCategory(value: unknown): value is Category {
  return typeof value === "string" && (CATEGORIES as readonly string[]).includes(value);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const update: Partial<AgentInput> = {};

  if ("available" in body) {
    if (typeof body.available !== "boolean") {
      return NextResponse.json({ error: "available must be a boolean" }, { status: 400 });
    }
    update.available = body.available;
  }

  if ("name" in body) {
    if (typeof body.name !== "string" || !body.name.trim()) {
      return NextResponse.json({ error: "name must be a non-empty string" }, { status: 400 });
    }
    update.name = body.name.trim();
  }

  if ("phone" in body) {
    if (typeof body.phone !== "string" || !body.phone.trim()) {
      return NextResponse.json({ error: "phone must be a non-empty string" }, { status: 400 });
    }
    update.phone = body.phone.trim();
  }

  if ("department" in body) {
    if (!isCategory(body.department)) {
      return NextResponse.json({ error: "department must be a valid category" }, { status: 400 });
    }
    update.department = body.department;
  }

  if ("categories" in body) {
    if (
      !Array.isArray(body.categories) ||
      body.categories.length === 0 ||
      !body.categories.every(isCategory)
    ) {
      return NextResponse.json(
        { error: "categories must be a non-empty array of valid categories" },
        { status: 400 }
      );
    }
    update.categories = body.categories;
  }

  const agent = await updateAgent(id, update);
  return NextResponse.json(agent);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await deleteAgent(id);
  return NextResponse.json({ ok: true });
}
