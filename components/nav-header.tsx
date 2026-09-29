import Link from "next/link";
import { signOut } from "@/app/auth/actions";
import { NavLinks } from "@/components/nav-links";
import { Button } from "@/components/ui/button";
import { getClaims } from "@/lib/auth";
import { BRAND } from "@/lib/brand";

// An async server component: the signed-in email is in the initial HTML, so the
// header never flickers from "Sign in" to the user's address after hydration.
// Only the pathname-aware pill nav needs to be a client component.
export async function NavHeader() {
  const claims = await getClaims();

  return (
    <header className="border-b border-border bg-background">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
              <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" fill="currentColor" />
              <path d="M9 9v6M12 9v6M15 9v6" stroke="var(--primary)" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </span>
          <span className="hidden font-semibold tracking-tight sm:inline">{BRAND.name}</span>
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
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
