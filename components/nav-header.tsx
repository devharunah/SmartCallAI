import Link from "next/link";
import { signOut } from "@/app/auth/actions";
import { NavLinks } from "@/components/nav-links";
import { Button } from "@/components/ui/button";
import { getClaims } from "@/lib/auth";

// An async server component: the signed-in email is in the initial HTML, so the
// header never flickers from "Sign in" to the user's address after hydration.
// Only the pathname-aware pill nav needs to be a client component.
export async function NavHeader() {
  const claims = await getClaims();

  return (
    <header className="border-b border-border bg-background">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M6.6 10.8c1.2 2.4 3.2 4.4 5.6 5.6l1.9-1.9a1 1 0 0 1 1-.25 8 8 0 0 0 2.5.4 1 1 0 0 1 1 1V19a1 1 0 0 1-1 1A15 15 0 0 1 3 6a1 1 0 0 1 1-1h3.4a1 1 0 0 1 1 1 8 8 0 0 0 .4 2.5 1 1 0 0 1-.25 1z"
                fill="currentColor"
              />
            </svg>
          </span>
          <span className="font-semibold tracking-tight">SmartCall AI</span>
        </Link>
        <div className="flex items-center gap-3">
          <NavLinks />
          {claims ? (
            <div className="flex items-center gap-2">
              <span className="hidden text-sm text-muted-foreground sm:inline">
                {claims.email}
              </span>
              <form action={signOut}>
                <Button type="submit" variant="outline" size="sm">
                  Sign out
                </Button>
              </form>
            </div>
          ) : (
            <Button variant="accent" size="sm" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
