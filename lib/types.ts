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
  createdAt: string;
}

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
