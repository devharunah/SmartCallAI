import { ImageResponse } from "next/og";
import { supabase } from "@/lib/supabase";
import { formatUgx, getMenu, getRestaurantBy } from "@/lib/restaurants/data";

// PUBLIC: the menu picture the bot sends when a restaurant hasn't uploaded its
// own. WhatsApp fetches it by URL, so it has to be reachable without auth. It's
// drawn from menu_items, so prices and "sold out" are always current; the
// engine adds ?v=<hash of the menu> so caches refresh when the menu changes.

const WIDTH = 1080;

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return new Response("Not found", { status: 404 });

  const restaurant = await getRestaurantBy(supabase, "slug", slug).catch(() => null);
  if (!restaurant) return new Response("Not found", { status: 404 });
  const menu = await getMenu(supabase, restaurant.id);

  const sections = [...menu.categories, { id: "", name: "More", nameLg: null, position: 999 }]
    .map((c) => ({ ...c, items: menu.items.filter((i) => (i.categoryId ?? "") === c.id) }))
    .filter((c) => c.items.length > 0);
  const rows = sections.reduce((n, s) => n + s.items.length + 2, 0);
  const height = Math.min(4000, 250 + rows * 54);

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#fbf7f0", color: "#1f1a14", padding: "56px 64px", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", flexDirection: "column", borderBottom: "3px solid #1f1a14", paddingBottom: 24, marginBottom: 16 }}>
          <div style={{ fontSize: 26, letterSpacing: 6, textTransform: "uppercase", color: "#b0532a" }}>Menu</div>
          <div style={{ fontSize: 60, fontWeight: 700, marginTop: 6 }}>{restaurant.name}</div>
          <div style={{ fontSize: 24, color: "#6b6258", marginTop: 8 }}>
            {`Open ${restaurant.hours.open}–${restaurant.hours.close} daily${restaurant.delivery.delivery ? ` · Delivery ${formatUgx(restaurant.delivery.fee)}` : ""}`}
          </div>
        </div>
        {sections.map((s) => (
          <div key={s.id || "more"} style={{ display: "flex", flexDirection: "column", marginTop: 28 }}>
            <div style={{ display: "flex", alignItems: "baseline", fontSize: 32, fontWeight: 700, color: "#b0532a" }}>
              {s.name}
              {s.nameLg ? <span style={{ fontSize: 22, fontWeight: 400, color: "#8a7f73", marginLeft: 14 }}>{s.nameLg}</span> : null}
            </div>
            {s.items.map((i) => (
              <div key={i.id} style={{ display: "flex", alignItems: "baseline", marginTop: 16, fontSize: 28, opacity: i.available ? 1 : 0.45 }}>
                <span style={{ display: "flex" }}>{i.name}</span>
                {i.nameLg ? <span style={{ fontSize: 20, color: "#8a7f73", marginLeft: 12 }}>{i.nameLg}</span> : null}
                <span style={{ flexGrow: 1, borderBottom: "1px solid #ddd3c6", margin: "0 14px", height: 1 }} />
                <span style={{ fontWeight: 700 }}>{i.available ? formatUgx(i.price) : "Sold out"}</span>
              </div>
            ))}
          </div>
        ))}
        <div style={{ display: "flex", marginTop: "auto", paddingTop: 32, fontSize: 22, color: "#6b6258" }}>
          Reply with what you&apos;d like, by text or voice note, in Luganda or English.
        </div>
      </div>
    ),
    { width: WIDTH, height, headers: { "cache-control": "public, max-age=300, s-maxage=3600" } }
  );
}
