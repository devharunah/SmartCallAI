// These two must be read as literal `process.env.NEXT_PUBLIC_*` expressions.
// Next inlines them by static text replacement at build time — a computed key
// like process.env[name] is never inlined and comes out `undefined` in the browser.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !publishableKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. " +
      "Add them to .env.local, then restart `next dev` (NEXT_PUBLIC_* vars are inlined at build time)."
  );
}

export const SUPABASE_URL = url;
export const SUPABASE_PUBLISHABLE_KEY = publishableKey;
