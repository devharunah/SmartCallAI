"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

// Admin and Analytics stay visible when signed out on purpose: hiding a link is
// not authorization, and the redirect-then-return flow is worth demonstrating.
const LINKS = [
  { href: "/", label: "Call" },
  { href: "/admin", label: "Admin" },
  { href: "/analytics", label: "Analytics" },
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
            "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
            pathname === link.href
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
