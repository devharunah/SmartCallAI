"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signup, type AuthState } from "@/app/auth/actions";
import { AuthCard } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const INITIAL: AuthState = { error: null };

export function SignupForm() {
  const [state, formAction, pending] = useActionState(signup, INITIAL);

  // Swapped in place rather than redirecting: with email confirmation on there
  // is no session yet, and this keeps the address out of the URL bar.
  if (state.sent) {
    return (
      <AuthCard
        title="Check your email"
        description="One more step to finish creating your account."
        footer={
          <Link href="/login" className="text-foreground underline underline-offset-4">
            Back to sign in
          </Link>
        }
      >
        <p className="text-sm text-muted-foreground">
          We sent a confirmation link to your inbox. Open it to activate your
          account — you&apos;ll be signed in automatically.
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Create an account"
      description="You need an account to reach the Admin and Analytics dashboards."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="text-foreground underline underline-offset-4">
            Sign in
          </Link>
        </>
      }
    >
      <form action={formAction} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            aria-invalid={state.error ? true : undefined}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={6}
            required
            aria-invalid={state.error ? true : undefined}
          />
        </div>
        {state.error && <p className="text-sm text-destructive">{state.error}</p>}
        <Button type="submit" variant="accent" disabled={pending}>
          {pending ? "Creating account..." : "Create account"}
        </Button>
      </form>
    </AuthCard>
  );
}
