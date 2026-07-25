"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/", label: "Call" },
  { href: "/admin", label: "Admin" },
  { href: "/analytics", label: "Analytics" },
];

export function NavHeader() {
  const pathname = usePathname();

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
      </div>
    </header>
  );
}
