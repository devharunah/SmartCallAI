"use client";

import { useState } from "react";
import Image from "next/image";
import { ImagePlus, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { formatUgx } from "@/lib/restaurants/data";
import type { Menu, MenuCategory, MenuItem } from "@/lib/restaurants/types";

// The owner's menu. This is the only source of prices: the bot reads it on
// every message, and the generated menu image redraws from it.

interface Photo {
  id: string;
  url: string;
}

interface Draft {
  name: string;
  nameLg: string;
  description: string;
  price: string;
  categoryId: string;
  aliases: string;
}

const EMPTY: Draft = { name: "", nameLg: "", description: "", price: "", categoryId: "", aliases: "" };

function toDraft(i: MenuItem): Draft {
  return {
    name: i.name,
    nameLg: i.nameLg ?? "",
    description: i.description ?? "",
    price: String(i.price),
    categoryId: i.categoryId ?? "",
    aliases: i.aliases.join(", "),
  };
}

async function api<T>(url: string, init: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "content-type": "application/json", ...init.headers } });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? "Something went wrong");
  return data as T;
}

export function MenuEditor({ initialMenu, initialPhotos, generatedMenuUrl }: { initialMenu: Menu; initialPhotos: Photo[]; generatedMenuUrl: string }) {
  const [categories, setCategories] = useState<MenuCategory[]>(initialMenu.categories);
  const [items, setItems] = useState<MenuItem[]>(initialMenu.items);
  const [photos, setPhotos] = useState<Photo[]>(initialPhotos);
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [newSection, setNewSection] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);

  const sections = [...categories, { id: "", name: "More", nameLg: null, position: Infinity }]
    .map((c) => ({ ...c, items: items.filter((i) => (i.categoryId ?? "") === c.id) }))
    .filter((c) => c.id !== "" || c.items.length > 0);

  function startEdit(item: MenuItem | null, categoryId = "") {
    setError(null);
    setEditing(item ? item.id : "new");
    setDraft(item ? toDraft(item) : { ...EMPTY, categoryId });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const price = Number(draft.price.replace(/[, ]/g, ""));
    if (!draft.name.trim() || !Number.isInteger(price) || price < 0) {
      setError("Give the item a name and a whole-shilling price.");
      return;
    }
    const body = JSON.stringify({
      name: draft.name,
      nameLg: draft.nameLg || null,
      description: draft.description || null,
      price,
      categoryId: draft.categoryId || null,
      aliases: draft.aliases.split(",").map((a) => a.trim()).filter(Boolean),
    });
    setSaving(true);
    try {
      if (editing === "new") {
        const item = await api<MenuItem>("/api/menu/items", { method: "POST", body });
        setItems((list) => [...list, item]);
      } else if (editing) {
        const item = await api<MenuItem>(`/api/menu/items/${editing}`, { method: "PATCH", body });
        setItems((list) => list.map((i) => (i.id === item.id ? item : i)));
      }
      setEditing(null);
      setPreviewKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save");
    } finally {
      setSaving(false);
    }
  }

  async function toggle(item: MenuItem, available: boolean) {
    setItems((list) => list.map((i) => (i.id === item.id ? { ...i, available } : i)));
    try {
      await api(`/api/menu/items/${item.id}`, { method: "PATCH", body: JSON.stringify({ available }) });
      setPreviewKey((k) => k + 1);
    } catch (err) {
      setItems((list) => list.map((i) => (i.id === item.id ? { ...i, available: !available } : i)));
      setError(err instanceof Error ? err.message : "Couldn't update");
    }
  }

  async function remove(item: MenuItem) {
    if (!confirm(`Delete ${item.name} from the menu?`)) return;
    try {
      await api(`/api/menu/items/${item.id}`, { method: "DELETE" });
      setItems((list) => list.filter((i) => i.id !== item.id));
      setPreviewKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't delete");
    }
  }

  async function addSection(e: React.FormEvent) {
    e.preventDefault();
    if (!newSection.trim()) return;
    try {
      const cat = await api<MenuCategory>("/api/menu/categories", { method: "POST", body: JSON.stringify({ name: newSection }) });
      setCategories((c) => [...c, cat]);
      setNewSection("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add the section");
    }
  }

  async function removeSection(cat: MenuCategory) {
    if (!confirm(`Delete the "${cat.name}" section? Its items move to "More".`)) return;
    try {
      await api(`/api/menu/categories/${cat.id}`, { method: "DELETE" });
      setCategories((c) => c.filter((x) => x.id !== cat.id));
      setItems((list) => list.map((i) => (i.categoryId === cat.id ? { ...i, categoryId: null } : i)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't delete the section");
    }
  }

  async function upload(file: File) {
    setError(null);
    const form = new FormData();
    form.set("file", file);
    try {
      const res = await fetch("/api/menu/assets", { method: "POST", body: form });
      const data = (await res.json().catch(() => ({}))) as Photo & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      setPhotos((p) => [...p, { id: data.id, url: data.url }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    }
  }

  async function removePhoto(photo: Photo) {
    try {
      await api(`/api/menu/assets/${photo.id}`, { method: "DELETE" });
      setPhotos((p) => p.filter((x) => x.id !== photo.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't remove the photo");
    }
  }

  const form = (
    <form onSubmit={save} className="grid gap-3 rounded-lg border bg-muted/40 p-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="item-name">Name</Label>
        <Input id="item-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required maxLength={80} autoFocus />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="item-lg">Luganda name (optional)</Label>
        <Input id="item-lg" value={draft.nameLg} onChange={(e) => setDraft({ ...draft, nameLg: e.target.value })} maxLength={80} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="item-price">Price (UGX)</Label>
        <Input id="item-price" inputMode="numeric" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} required className="tabular-nums" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="item-cat">Section</Label>
        <select
          id="item-cat"
          value={draft.categoryId}
          onChange={(e) => setDraft({ ...draft, categoryId: e.target.value })}
          className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">More</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="item-aliases">Other names customers use</Label>
        <Input id="item-aliases" value={draft.aliases} onChange={(e) => setDraft({ ...draft, aliases: e.target.value })} placeholder="chapo, kyapati" />
        <p className="text-xs text-muted-foreground">Comma-separated. Helps the assistant match what people type or say.</p>
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="item-desc">Description (optional)</Label>
        <Input id="item-desc" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} maxLength={300} />
      </div>
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : editing === "new" ? "Add item" : "Save"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
          Cancel
        </Button>
      </div>
    </form>
  );

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        {error && (
          <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
        {items.length === 0 && editing !== "new" && (
          <div className="rounded-xl border border-dashed p-8 text-center">
            <p className="font-medium">Your menu is empty</p>
            <p className="mt-1 text-sm text-muted-foreground">Add what you sell. The assistant only offers items listed here.</p>
            <Button className="mt-4" onClick={() => startEdit(null)}>
              <Plus className="size-4" /> Add the first item
            </Button>
          </div>
        )}
        {sections.map((s) => (
          <section key={s.id || "more"} aria-labelledby={`sec-${s.id || "more"}`}>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 id={`sec-${s.id || "more"}`} className="font-semibold">
                {s.name} {s.nameLg && <span className="font-normal text-muted-foreground">· {s.nameLg}</span>}
              </h2>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => startEdit(null, s.id)}>
                  <Plus className="size-3.5" /> Item
                </Button>
                {s.id && (
                  <Button size="icon-sm" variant="ghost" aria-label={`Delete section ${s.name}`} onClick={() => void removeSection(s)}>
                    <Trash2 className="size-3.5" />
                  </Button>
                )}
              </div>
            </div>
            {editing === "new" && draft.categoryId === s.id && <div className="mb-2">{form}</div>}
            <ul className="divide-y rounded-lg border">
              {s.items.length === 0 && <li className="px-3 py-4 text-sm text-muted-foreground">No items yet</li>}
              {s.items.map((item) =>
                editing === item.id ? (
                  <li key={item.id} className="p-2">
                    {form}
                  </li>
                ) : (
                  <li key={item.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className={item.available ? "font-medium" : "font-medium text-muted-foreground line-through"}>{item.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[item.nameLg, item.aliases.length ? `also: ${item.aliases.join(", ")}` : null].filter(Boolean).join(" · ") || item.description}
                      </p>
                    </div>
                    <span className="tabular-nums text-sm font-medium">{formatUgx(item.price)}</span>
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Switch checked={item.available} onCheckedChange={(v) => void toggle(item, v)} aria-label={`${item.name} available`} />
                      {item.available ? "Available" : "Sold out"}
                    </label>
                    <Button size="icon-sm" variant="ghost" aria-label={`Edit ${item.name}`} onClick={() => startEdit(item)}>
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button size="icon-sm" variant="ghost" aria-label={`Delete ${item.name}`} onClick={() => void remove(item)}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  </li>
                )
              )}
            </ul>
          </section>
        ))}
        <form onSubmit={addSection} className="flex gap-2">
          <Input value={newSection} onChange={(e) => setNewSection(e.target.value)} placeholder="New section, e.g. Breakfast" aria-label="New section name" maxLength={60} />
          <Button type="submit" variant="outline" disabled={!newSection.trim()}>
            Add section
          </Button>
        </form>
      </div>

      <aside className="space-y-4">
        <div>
          <h2 className="font-semibold">Menu picture</h2>
          <p className="mt-1 text-sm text-pretty text-muted-foreground">
            {photos.length
              ? "The assistant sends these photos when customers ask for the menu."
              : "No photos uploaded, so the assistant sends this picture made from your menu. It updates automatically."}
          </p>
        </div>
        {photos.length === 0 ? (
          <a href={generatedMenuUrl} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border">
            <Image key={previewKey} src={`${generatedMenuUrl}?p=${previewKey}`} alt="Generated menu picture" width={320} height={420} unoptimized className="h-auto w-full" />
          </a>
        ) : (
          <ul className="grid grid-cols-2 gap-2">
            {photos.map((p) => (
              <li key={p.id} className="relative overflow-hidden rounded-lg border">
                <Image src={p.url} alt="Menu photo" width={160} height={200} unoptimized className="h-40 w-full object-cover" />
                <Button size="icon-sm" variant="secondary" className="absolute top-1 right-1" aria-label="Remove photo" onClick={() => void removePhoto(p)}>
                  <Trash2 className="size-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <label className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed text-sm font-medium hover:bg-muted focus-within:ring-2 focus-within:ring-ring">
          <ImagePlus className="size-4" /> Upload a menu photo
          <input
            type="file"
            accept="image/jpeg,image/png"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f);
              e.target.value = "";
            }}
          />
        </label>
        <p className="text-xs text-muted-foreground">JPEG or PNG, up to 5 MB.</p>
      </aside>
    </div>
  );
}
