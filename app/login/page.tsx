import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { getClaims, safeNextPath } from "@/lib/auth";

// Lookup table rather than echoing the raw query param into the DOM.
const ERRORS: Record<string, string> = {
  confirm:
    "That confirmation link is invalid or has expired. Try signing up again.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const target = safeNextPath(next);

  if (await getClaims()) redirect(target);

  return (
    <LoginForm
      next={target}
      initialError={error ? ERRORS[error] : undefined}
    />
  );
}
