import Link from "next/link";
import { signOut } from "@/app/auth/actions";
import { BrandLogo } from "@/components/brand-mark";
import { NavLinks } from "@/components/nav-links";
import { Button } from "@/components/ui/button";
import { getClaims } from "@/lib/auth";
import { BRAND } from "@/lib/brand";

// An async server component: the signed-in email is in the initial HTML, so the
// header never flickers from "Sign in" to the user's address after hydration.
// Only the pathname-aware links need to be a client component.
export async function NavHeader() {
  const claims = await getClaims();

  return (
    <header className="relative z-20 bg-background">
      <div className="mx-auto flex h-16 max-w-300 items-center justify-between gap-2 px-4 sm:px-6">
        <div className="flex items-center gap-8">
          <Link
            href="/"
            aria-label={`${BRAND.name} home`}
            className="rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
          >
            <BrandLogo />
          </Link>
          <NavLinks className="hidden md:flex" />
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          {claims ? (
            <>
              <span className="hidden text-sm text-muted-foreground lg:inline">{claims.email}</span>
              <Button variant="ghost" asChild className="h-10 rounded-full px-3 text-[15px] md:hidden">
                <Link href="/dashboard">Dashboard</Link>
              </Button>
              <form action={signOut}>
                <Button type="submit" variant="outline" className="h-10 px-4 text-[15px]">
                  Sign out
                </Button>
              </form>
            </>
          ) : (
            <>
              <Button variant="ghost" asChild className="h-10 rounded-full px-2.5 text-[15px] sm:px-3">
                <Link href="/login">Sign in</Link>
              </Button>
              <Button asChild className="h-10 px-4 text-[15px] sm:px-5">
                <Link href="/try">
                  <span className="sm:hidden">Demo</span>
                  <span className="hidden sm:inline">Try the demo</span>
                </Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
