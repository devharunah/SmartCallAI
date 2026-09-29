import type { Metadata } from "next";
import { BRAND } from "@/lib/brand";
import { createClient } from "@/lib/supabase/server";
import { getMyRestaurant } from "@/lib/restaurants/current";
import { getWorkflow } from "@/lib/workflow/store";
import { DEFAULT_WORKFLOW } from "@/lib/workflow/default";
import { WorkflowEditor } from "@/components/workflow/editor";
import { ChatSimulator } from "@/components/chat/chat-simulator";

export const metadata: Metadata = { title: `Workflow · ${BRAND.name}` };

export default async function WorkflowPage() {
  const restaurant = (await getMyRestaurant())!;
  const db = await createClient();
  const workflow = await getWorkflow(db, restaurant.id);

  return (
    <div className="grid gap-6 2xl:grid-cols-[1fr_380px]">
      <WorkflowEditor initialGraph={workflow.graph} initialVersion={workflow.version} isDefault={workflow.isDefault} defaultGraph={DEFAULT_WORKFLOW} />
      <aside className="space-y-2">
        <h2 className="font-semibold">Test your bot</h2>
        <p className="text-sm text-pretty text-muted-foreground">Chats here use your saved workflow and menu. Test orders show on the board marked “Test”.</p>
        <ChatSimulator
          restaurantSlug={restaurant.slug}
          restaurantName={restaurant.name}
          defaultLanguage={restaurant.defaultLanguage}
          storageKey={`emmere-test-${restaurant.id}`}
          className="h-[640px] max-w-xl"
        />
      </aside>
    </div>
  );
}
