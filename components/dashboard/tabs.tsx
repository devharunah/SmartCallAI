"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/dashboard", label: "Orders" },
  { href: "/dashboard/inbox", label: "Inbox" },
  { href: "/dashboard/menu", label: "Menu" },
  { href: "/dashboard/workflow", label: "Workflow" },
  { href: "/dashboard/insights", label: "Insights" },
  { href: "/dashboard/settings", label: "Settings" },
];

export function DashboardTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Dashboard" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex w-max gap-1 rounded-full border bg-background p-1">
        {TABS.map((tab) => {
          const active = tab.href === "/dashboard" ? pathname === tab.href : pathname.startsWith(tab.href);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-9 items-center rounded-full px-3.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
