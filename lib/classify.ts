import OpenAI from "openai";
import { CATEGORIES, type Category, type ClassificationResult } from "./types";

const KEYWORDS: Record<Category, string[]> = {
  Billing: ["bill", "billing", "charged", "charge", "payment", "invoice", "twice", "refund"],
  "Technical Support": [
    "internet",
    "router",
    "wifi",
    "down",
    "slow",
    "connection",
    "outage",
    "not working",
  ],
  Sales: ["buy", "purchase", "upgrade", "plan", "subscribe", "pricing", "new account"],
  Insurance: ["insurance", "policy", "claim", "coverage", "premium"],
  Loans: ["loan", "borrow", "repayment", "interest rate", "installment"],
  "Card Support": ["card", "lost card", "stolen", "debit", "credit card", "block my card", "pin"],
  "General Inquiry": [],
};

function ruleBasedClassifier(transcript: string): ClassificationResult {
  const text = transcript.toLowerCase();
  let bestCategory: Category = "General Inquiry";
  let bestMatches: string[] = [];

  for (const category of CATEGORIES) {
    const matches = KEYWORDS[category].filter((kw) => text.includes(kw));
    if (matches.length > bestMatches.length) {
      bestMatches = matches;
      bestCategory = category;
    }
  }

  const confidence =
    bestMatches.length === 0 ? 60 : Math.min(95, 75 + bestMatches.length * 8);

  const reason =
    bestMatches.length === 0
      ? "No strong keyword matches were found; routed to General Inquiry by default."
      : `Customer mentioned: ${bestMatches.join(", ")}. These indicate a ${bestCategory} issue.`;

  return {
    category: bestCategory,
    summary: transcript.length > 140 ? `${transcript.slice(0, 137)}...` : transcript,
    confidence,
    reason,
  };
}

const SYSTEM_PROMPT = `You are an intelligent call routing assistant.

Analyze the customer's message.

Return JSON only, matching this shape exactly:
{
  "category": "",
  "summary": "",
  "confidence": 0,
  "reason": ""
}

Possible categories (use exactly one, spelled exactly as shown):
Billing
Technical Support
Sales
Insurance
Loans
Card Support
General Inquiry`;

async function openaiClassifier(transcript: string): Promise<ClassificationResult> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: transcript },
    ],
    response_format: { type: "json_object" },
    temperature: 0.2,
  });

  const raw = response.choices[0]?.message?.content;
  if (!raw) throw new Error("Empty response from OpenAI");

  const parsed = JSON.parse(raw) as ClassificationResult;

  if (!CATEGORIES.includes(parsed.category)) {
    throw new Error(`OpenAI returned an unknown category: ${parsed.category}`);
  }

  return parsed;
}

export async function classifyIssue(transcript: string): Promise<ClassificationResult> {
  if (process.env.OPENAI_API_KEY) {
    try {
      return await openaiClassifier(transcript);
    } catch (err) {
      console.error("OpenAI classification failed, falling back to rule-based classifier:", err);
      return ruleBasedClassifier(transcript);
    }
  }

  return ruleBasedClassifier(transcript);
}
