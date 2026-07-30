import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { getAnalytics } from "@/lib/calls";

export async function GET() {
  const { unauthorized } = await requireApiUser();
  if (unauthorized) return unauthorized;

  const analytics = await getAnalytics();
  return NextResponse.json(analytics);
}
