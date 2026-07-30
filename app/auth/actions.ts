"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { safeNextPath } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { error: string | null; sent?: boolean };

// Every redirect() below sits at the top level of its function, after all error
// handling. redirect() works by throwing NEXT_REDIRECT — wrapping it in a
// try/catch swallows the throw and the form silently does nothing.

export async function login(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  // Re-validated here, not just at render: the hidden input is client-controlled.
  const next = safeNextPath(formData.get("next"));

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  // Generic on purpose — Supabase's raw message distinguishes wrong-password
  // from unconfirmed-email, which leaks whether an account exists.
  if (error) return { error: "Invalid email or password." };

  revalidatePath("/", "layout");
  redirect(next);
}

export async function signup(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Email and password are required." };
  }
  if (password.length < 6) {
    return { error: "Password must be at least 6 characters." };
  }

  const supabase = await createClient();
  // error.message is passed through here (unlike login) because this is where
  // password-strength feedback lives.
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) return { error: error.message };

  // No redirect: with email confirmation on, signUp() returns no session.
  // Signing up an existing email also lands here with no error — that is
  // Supabase's anti-enumeration behavior and is intentionally indistinguishable.
  return { error: null, sent: true };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();

  // Without this the client router cache serves a stale header still showing
  // the signed-in state.
  revalidatePath("/", "layout");
  redirect("/login");
}
