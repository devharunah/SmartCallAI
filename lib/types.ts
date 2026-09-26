export const CATEGORIES = [
  "Billing",
  "Technical Support",
  "Sales",
  "Insurance",
  "Loans",
  "Card Support",
  "General Inquiry",
] as const;

export type Category = (typeof CATEGORIES)[number];

// Below this, the customer is asked to confirm/clarify instead of being auto-routed silently.
export const CONFIDENCE_THRESHOLD = 70;

export interface Agent {
  id: string;
  name: string;
  phone: string;
  department: Category;
  categories: Category[];
  available: boolean;
}

export interface Call {
  id: string;
  transcript: string;
  category: Category;
  summary: string;
  confidence: number;
  reason: string;
  assignedAgentId: string | null;
  assignedAgentName: string | null;
  routingTimeMs: number | null;
  channel: CallChannel;
  callerNumber: string | null;
  resolution: CallResolution | null;
  durationSeconds: number | null;
  createdAt: string;
}

// web = typed/Web Speech router, phone = a real phone call, app = in-app voice call.
export type CallChannel = "web" | "phone" | "app";
export type CallResolution = "resolved" | "transferred" | "abandoned";

export interface ClassificationResult {
  category: Category;
  summary: string;
  confidence: number;
  reason: string;
}

export interface RouteCallResponse extends ClassificationResult {
  agent: { id: string; name: string; phone: string } | null;
  queued: boolean;
  callId: string | null;
}
