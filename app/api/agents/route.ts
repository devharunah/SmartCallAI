import { NextResponse } from "next/server";
import { createAgent, listAgents } from "@/lib/agents";
import { CATEGORIES, type Category } from "@/lib/types";

export async function GET() {
  const agents = await listAgents();
  return NextResponse.json(agents);
}

function isCategory(value: unknown): value is Category {
  return typeof value === "string" && (CATEGORIES as readonly string[]).includes(value);
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { name, phone, department, categories, available } = body as Record<string, unknown>;

  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (typeof phone !== "string" || !phone.trim()) {
    return NextResponse.json({ error: "phone is required" }, { status: 400 });
  }
  if (!isCategory(department)) {
    return NextResponse.json({ error: "department must be a valid category" }, { status: 400 });
  }
  if (!Array.isArray(categories) || categories.length === 0 || !categories.every(isCategory)) {
    return NextResponse.json(
      { error: "categories must be a non-empty array of valid categories" },
      { status: 400 }
    );
  }

  const agent = await createAgent({
    name: name.trim(),
    phone: phone.trim(),
    department,
    categories,
    available: typeof available === "boolean" ? available : true,
  });

  return NextResponse.json(agent, { status: 201 });
}
