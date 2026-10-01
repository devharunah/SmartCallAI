import { redirect } from "next/navigation";
import { getMyRestaurant } from "@/lib/restaurants/current";
import { DashboardTabs } from "@/components/dashboard/tabs";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const restaurant = await getMyRestaurant();
  if (!restaurant) redirect("/onboarding");

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="font-mono text-xs tracking-widest text-muted-foreground uppercase">Restaurant</p>
          <h1 className="truncate text-2xl font-semibold tracking-tight">{restaurant.name}</h1>
        </div>
        <DashboardTabs />
      </div>
      <div className="mt-6">{children}</div>
    </div>
  );
}
