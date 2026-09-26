import type { Category } from "../types";

// Demo help-desk knowledge the voice agent can resolve calls from. Swap for a
// real source (a Supabase table, docs search) when there is one.
export interface HelpArticle {
  id: string;
  category: Category;
  title: string;
  keywords: string[];
  answer: string;
}

export const HELP_ARTICLES: HelpArticle[] = [
  {
    id: "billing-double-charge",
    category: "Billing",
    title: "Charged twice",
    keywords: ["charged twice", "double", "duplicate", "two charges", "refund"],
    answer:
      "Duplicate charges are usually a pending authorization that drops off within 3 business days. If both charges have posted, we can open a refund request; refunds land in 5 to 7 business days.",
  },
  {
    id: "billing-due-date",
    category: "Billing",
    title: "Bill due date and payment options",
    keywords: ["due date", "pay bill", "payment", "late fee", "m-pesa", "mpesa"],
    answer:
      "Bills are due on the 5th of each month. You can pay by M-Pesa paybill, card, or bank transfer. A late fee applies after a 3-day grace period.",
  },
  {
    id: "tech-router-drops",
    category: "Technical Support",
    title: "Internet keeps dropping",
    keywords: ["router", "wifi", "internet", "dropping", "disconnect", "slow"],
    answer:
      "Unplug the router for 30 seconds and plug it back in, then wait 2 minutes for the lights to go steady. If it still drops, move it away from walls and microwaves. If the internet light stays red, there is a line fault and a technician is needed.",
  },
  {
    id: "tech-password-reset",
    category: "Technical Support",
    title: "Reset account password",
    keywords: ["password", "login", "locked out", "can't sign in", "reset"],
    answer:
      "On the sign-in page choose Forgot password and enter your phone number or email. A reset code arrives by SMS within a minute. After 5 wrong attempts the account locks for 15 minutes.",
  },
  {
    id: "card-blocked",
    category: "Card Support",
    title: "Card blocked or declined",
    keywords: ["card blocked", "declined", "card not working", "frozen card"],
    answer:
      "Cards block automatically after 3 wrong PIN attempts or a suspicious purchase. We can unblock it after confirming the last transaction you made. If you did not make a recent purchase, the card should be cancelled and replaced instead.",
  },
  {
    id: "card-lost",
    category: "Card Support",
    title: "Lost or stolen card",
    keywords: ["lost card", "stolen", "missing card", "replace card"],
    answer:
      "A lost or stolen card should be frozen right away; a human agent confirms identity and cancels it. A replacement card arrives in 5 business days.",
  },
  {
    id: "loans-status",
    category: "Loans",
    title: "Loan application status",
    keywords: ["loan status", "application", "approved", "loan pending"],
    answer:
      "Loan applications are reviewed within 2 business days. You get an SMS when a decision is made. Once approved, money is sent the same day.",
  },
  {
    id: "loans-repayment",
    category: "Loans",
    title: "Loan repayment",
    keywords: ["repay", "repayment", "installment", "loan balance", "pay loan"],
    answer:
      "Repayments are taken automatically on your due date. You can pay early at any time with no penalty, and early payment reduces the interest owed.",
  },
  {
    id: "insurance-claim",
    category: "Insurance",
    title: "Filing a claim",
    keywords: ["claim", "accident", "insurance", "damage", "file a claim"],
    answer:
      "Claims can be started on the phone. We need the date, what happened, and photos if there are any. An assessor calls back within 48 hours.",
  },
  {
    id: "sales-plans",
    category: "Sales",
    title: "Plans and upgrades",
    keywords: ["upgrade", "plan", "price", "cost", "new service", "package"],
    answer:
      "There are three plans: Basic, Plus, and Pro. Upgrades take effect immediately and the difference is prorated on the next bill. A sales agent can walk through which plan fits best.",
  },
  {
    id: "general-hours",
    category: "General Inquiry",
    title: "Opening hours and branches",
    keywords: ["hours", "open", "branch", "location", "office"],
    answer:
      "Phone support runs 24 hours a day. Branches are open 8am to 5pm Monday to Friday and 9am to 1pm on Saturday.",
  },
];

/** Keyword-overlap search. Small enough to not need embeddings. */
export function searchHelp(query: string, limit = 3): HelpArticle[] {
  const q = query.toLowerCase();
  const words = q.split(/\W+/).filter((w) => w.length > 2);
  return HELP_ARTICLES.map((article) => {
    let score = 0;
    for (const k of article.keywords) {
      if (q.includes(k)) score += 3;
      else if (k.split(" ").some((kw) => words.includes(kw))) score += 1;
    }
    if (words.some((w) => article.title.toLowerCase().includes(w))) score += 1;
    return { article, score };
  })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((r) => r.article);
}
