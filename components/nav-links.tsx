"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

// Dashboard stays visible when signed out on purpose: hiding a link is not
// authorization, and the redirect-then-return flow does the right thing.
// The old voice routes (/call, /admin, /analytics) still work but aren't linked.
const LINKS = [
  { href: "/try", label: "Demo" },
  { href: "/dashboard", label: "Dashboard" },
];

export function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1 rounded-full border border-border bg-background p-1">
      {LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={cn(
            "rounded-full px-2.5 py-1.5 text-sm font-medium transition-colors sm:px-3.5",
            pathname === link.href || pathname.startsWith(`${link.href}/`)
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
