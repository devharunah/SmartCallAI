// Tiny, safe condition language for workflow edges. No eval: a condition is
// one or more comparisons joined by "&&", e.g. `cart.count > 0 && isOpen == true`.

export const EXPR_VARIABLES = ["cart.count", "cart.total", "isOpen", "fulfillment", "hasAddress", "language"] as const;
export type ExprVariable = (typeof EXPR_VARIABLES)[number];
export type ExprContext = Record<ExprVariable, string | number | boolean | null>;

type Op = "==" | "!=" | ">=" | "<=" | ">" | "<";

interface Comparison {
  variable: ExprVariable;
  op: Op;
  value: string | number | boolean | null;
}

export function parseExpr(source: string): Comparison[] {
  const parts = source.split("&&").map((p) => p.trim());
  if (parts.some((p) => !p)) throw new Error("empty part");
  return parts.map((part) => {
    const match = part.match(/^([a-zA-Z.]+)\s*(==|!=|>=|<=|>|<)\s*(.+)$/);
    if (!match) throw new Error(`expected "variable op value" in "${part}"`);
    const [, variable, op, raw] = match;
    if (!(EXPR_VARIABLES as readonly string[]).includes(variable)) {
      throw new Error(`unknown variable "${variable}" (use ${EXPR_VARIABLES.join(", ")})`);
    }
    return { variable: variable as ExprVariable, op: op as Op, value: parseValue(raw.trim()) };
  });
}

function parseValue(raw: string): Comparison["value"] {
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (raw === "null") return null;
  if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);
  return raw.replace(/^["']|["']$/g, "");
}

export function evalExpr(source: string, ctx: ExprContext): boolean {
  return parseExpr(source).every(({ variable, op, value }) => {
    const actual = ctx[variable];
    switch (op) {
      case "==":
        return actual === value;
      case "!=":
        return actual !== value;
      default: {
        if (typeof actual !== "number" || typeof value !== "number") return false;
        return op === ">" ? actual > value : op === "<" ? actual < value : op === ">=" ? actual >= value : actual <= value;
      }
    }
  });
}
