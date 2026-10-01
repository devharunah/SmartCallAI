"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Bot, Hand, Mic, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createRealtimeClient } from "@/lib/supabase/client";
import { toConversation, type ConversationRow } from "@/lib/chat/conversation-row";
import type { Conversation, DisplayEntry } from "@/lib/chat/types";
import { cn } from "@/lib/utils";

// Every customer chat, live. Staff can pause the AI and reply themselves; on
// WhatsApp that only works within 24 hours of the customer's last message.

const WINDOW_MS = 24 * 3600 * 1000;

function preview(c: Conversation) {
  const last = c.displayLog.at(-1);
  if (!last) return "No messages yet";
  if (last.from === "customer") return last.kind === "voice" ? `🎤 ${last.text || "Voice note"}` : last.text;
  const m = last.message;
  return `${last.from === "staff" ? "You" : "AI"}: ${m.type === "image" ? "📷 Menu" : m.text}`;
}

function time(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toDateString() === new Date().toDateString()
    ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString([], { day: "numeric", month: "short" });
}

function Entry({ e }: { e: DisplayEntry }) {
  if (e.from === "customer") {
    return (
      <div className="flex flex-col items-start">
        <div className="max-w-[80%] rounded-2xl rounded-bl-md border bg-card px-3 py-2 text-sm">
          {e.kind === "voice" && (
            <span className="mb-0.5 flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <Mic className="size-3" aria-hidden /> Voice note, transcribed
            </span>
          )}
          <span className="whitespace-pre-wrap break-words">{e.text || <em className="text-muted-foreground">Couldn&apos;t transcribe</em>}</span>
        </div>
        <span className="mt-0.5 px-1 text-[11px] text-muted-foreground">{time(e.at)}</span>
      </div>
    );
  }
  const m = e.message;
  return (
    <div className="flex flex-col items-end">
      <div className={cn("max-w-[80%] overflow-hidden rounded-2xl rounded-br-md px-3 py-2 text-sm", e.from === "staff" ? "bg-primary text-primary-foreground" : "bg-accent/20")}>
        {m.type === "image" ? (
          <Image src={m.url} alt={m.caption ?? "Menu"} width={200} height={260} unoptimized className="h-auto w-40 rounded-md object-cover object-top" />
        ) : (
          <span className="whitespace-pre-wrap break-words">{m.text}</span>
        )}
        {m.type === "buttons" && <span className="mt-1 block text-xs opacity-70">[{m.buttons.map((b) => b.title).join(" · ")}]</span>}
      </div>
      <span className="mt-0.5 px-1 text-[11px] text-muted-foreground">
        {e.from === "staff" ? "You" : "AI"} · {time(e.at)}
      </span>
    </div>
  );
}

export function Inbox({ restaurantId, initial, selectedId }: { restaurantId: string; initial: Conversation[]; selectedId: string | null }) {
  const [conversations, setConversations] = useState(initial);
  const [selected, setSelected] = useState<string | null>(selectedId);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let cleanup = () => {};
    void (async () => {
      const db = await createRealtimeClient();
      if (cancelled) return;
      const channel = db
        .channel(`conversations:${restaurantId}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "conversations", filter: `restaurant_id=eq.${restaurantId}` }, (payload) => {
          if (payload.eventType === "DELETE") return;
          const c = toConversation(payload.new as ConversationRow);
          setConversations((list) => [c, ...list.filter((x) => x.id !== c.id)].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
        })
        .subscribe();
      cleanup = () => void db.removeChannel(channel);
    })();
    return () => {
      cancelled = true;
      cleanup();
    };
  }, [restaurantId]);

  const current = useMemo(() => conversations.find((c) => c.id === selected) ?? null, [conversations, selected]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [current?.displayLog.length, selected]);

  const windowOpen = current
    ? current.channel === "web" || (current.lastCustomerAt ? now - Date.parse(current.lastCustomerAt) < WINDOW_MS : false)
    : false;

  async function setPaused(aiPaused: boolean) {
    if (!current) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/conversations/${current.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ aiPaused }),
      });
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Couldn't update");
      setConversations((list) => list.map((c) => (c.id === current.id ? { ...c, aiPaused, status: aiPaused ? "handoff" : "active" } : c)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update");
    } finally {
      setBusy(false);
    }
  }

  async function reply(e: React.FormEvent) {
    e.preventDefault();
    if (!current || !draft.trim()) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/conversations/${current.id}/reply`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: draft }),
      });
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Couldn't send");
      setDraft("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send");
    } finally {
      setBusy(false);
    }
  }

  if (conversations.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-10 text-center">
        <p className="font-medium">No chats yet</p>
        <p className="mt-1 text-sm text-pretty text-muted-foreground">
          When customers message your WhatsApp, their chats appear here. Try it from the Workflow tab&apos;s test panel.
        </p>
      </div>
    );
  }

  return (
    <div className="grid h-[calc(100dvh-13rem)] min-h-[480px] overflow-hidden rounded-xl border md:grid-cols-[300px_1fr]">
      <ul className={cn("overflow-y-auto border-r", current && "hidden md:block")} aria-label="Chats">
        {conversations.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => setSelected(c.id)}
              aria-current={c.id === selected ? "true" : undefined}
              className={cn(
                "flex w-full flex-col gap-0.5 border-b px-4 py-3 text-left transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none",
                c.id === selected && "bg-muted"
              )}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium">{c.customerName ?? (c.channel === "whatsapp" ? `+${c.customerId}` : "Test chat")}</span>
                <span className="shrink-0 text-[11px] text-muted-foreground">{time(c.updatedAt)}</span>
              </span>
              <span className="truncate text-xs text-muted-foreground">{preview(c)}</span>
              <span className="mt-1 flex gap-1">
                {c.aiPaused && <Badge variant="destructive">Needs staff</Badge>}
                {c.channel === "web" && <Badge variant="secondary">Test</Badge>}
                <Badge variant="outline">{c.language === "lug" ? "Luganda" : "English"}</Badge>
              </span>
            </button>
          </li>
        ))}
      </ul>

      {current ? (
        <section className="flex min-h-0 flex-col" aria-label="Chat">
          <header className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
            <button type="button" className="text-sm text-muted-foreground underline md:hidden" onClick={() => setSelected(null)}>
              Back
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{current.customerName ?? (current.channel === "whatsapp" ? `+${current.customerId}` : "Test chat")}</p>
              <p className="text-xs text-muted-foreground">
                {current.channel === "whatsapp" ? `WhatsApp +${current.customerId}` : "Web test chat"} ·{" "}
                {current.aiPaused ? "AI paused, you're replying" : "AI is replying"}
              </p>
            </div>
            {current.aiPaused ? (
              <Button size="sm" variant="outline" disabled={busy} onClick={() => void setPaused(false)}>
                <Bot className="size-3.5" /> Hand back to AI
              </Button>
            ) : (
              <Button size="sm" disabled={busy} onClick={() => void setPaused(true)}>
                <Hand className="size-3.5" /> Take over
              </Button>
            )}
          </header>
          <div ref={scroller} className="flex-1 space-y-3 overflow-y-auto bg-muted/40 p-4">
            {current.displayLog.map((e, i) => (
              <Entry key={i} e={e} />
            ))}
          </div>
          {error && (
            <p role="alert" className="border-t px-4 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          {current.aiPaused ? (
            windowOpen ? (
              <form onSubmit={reply} className="flex gap-2 border-t p-3">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Reply as the restaurant"
                  aria-label="Reply"
                  maxLength={2000}
                  className="h-10 min-w-0 flex-1 rounded-full border bg-background px-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <Button type="submit" size="icon-lg" disabled={busy || !draft.trim()} aria-label="Send reply">
                  <Send className="size-4" />
                </Button>
              </form>
            ) : (
              <p className="border-t px-4 py-3 text-sm text-pretty text-muted-foreground">
                It&apos;s been over 24 hours since this customer&apos;s last message, so WhatsApp won&apos;t deliver a reply until they write again.
              </p>
            )
          ) : (
            <p className="border-t px-4 py-3 text-sm text-muted-foreground">Take over to reply yourself. The AI stops answering until you hand it back.</p>
          )}
        </section>
      ) : (
        <div className="hidden items-center justify-center text-sm text-muted-foreground md:flex">Choose a chat</div>
      )}
    </div>
  );
}
