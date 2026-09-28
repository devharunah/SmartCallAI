"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ArrowUp, Check, CheckCheck, Mic, RotateCcw, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { OutMessage } from "@/lib/chat/types";

// A WhatsApp-style chat that talks to the same engine as the real WhatsApp
// webhook, through /api/chat/web. Used by the public /try demo and the
// dashboard's "Test your bot" panel.

type Lang = "lug" | "eng";

type Bubble =
  | { id: string; from: "me"; kind: "text" | "voice"; text: string; pending?: boolean; seconds?: number }
  | { id: string; from: "bot"; message: OutMessage };

interface ChatResponse {
  transcript: string | null;
  out: OutMessage[];
  orderReference: string | null;
  handoff: boolean;
  error?: string;
}

const SUGGESTIONS: Record<Lang, string[]> = {
  lug: ["Oli otya! Mpa menu", "Njagala rolex bbiri ne juice", "Muggala ssaawa mmeka?", "Njagala kwogera n'omuntu"],
  eng: ["Hi, can I see the menu?", "Two rolexes and a passion juice please", "Do you deliver to Ntinda?", "What time do you close?"],
};

const MAX_RECORD_MS = 60_000;

function newSessionId() {
  return `web_${crypto.randomUUID()}`;
}

function storedSession(key: string): string {
  try {
    const existing = sessionStorage.getItem(key);
    if (existing && /^web_[0-9a-f-]{36}$/.test(existing)) return existing;
    const id = newSessionId();
    sessionStorage.setItem(key, id);
    return id;
  } catch {
    return newSessionId();
  }
}

/** WhatsApp's *bold* and _italic_, plus line breaks. */
function RichText({ text }: { text: string }) {
  const parts = text.split(/(\*[^*\n]+\*|_[^_\n]+_)/g);
  return (
    <span className="whitespace-pre-wrap break-words">
      {parts.map((p, i) =>
        p.startsWith("*") && p.endsWith("*") && p.length > 2 ? (
          <strong key={i} className="font-semibold">{p.slice(1, -1)}</strong>
        ) : p.startsWith("_") && p.endsWith("_") && p.length > 2 ? (
          <em key={i}>{p.slice(1, -1)}</em>
        ) : (
          <span key={i}>{p}</span>
        )
      )}
    </span>
  );
}

export function ChatSimulator({
  restaurantSlug,
  restaurantName,
  defaultLanguage = "lug",
  storageKey = "emmere-try-session",
  className,
}: {
  restaurantSlug?: string;
  restaurantName: string;
  defaultLanguage?: Lang;
  storageKey?: string;
  className?: string;
}) {
  const session = useRef<string | null>(null);
  const [lang, setLang] = useState<Lang>(defaultLanguage);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordMs, setRecordMs] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const recordStart = useRef(0);
  const scroller = useRef<HTMLDivElement>(null);

  // Created on first send, so the server render and the first client render match.
  const sessionId = () => (session.current ??= storedSession(storageKey));

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [bubbles, busy]);

  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => {
      const ms = Date.now() - recordStart.current;
      setRecordMs(ms);
      if (ms >= MAX_RECORD_MS) recorder.current?.stop();
    }, 200);
    return () => clearInterval(timer);
  }, [recording]);

  async function send(payload: { text?: string; buttonId?: string; audio?: Blob; seconds?: number }) {
    if (busy) return;
    setError(null);
    const mine: Bubble = {
      id: crypto.randomUUID(),
      from: "me",
      kind: payload.audio ? "voice" : "text",
      text: payload.text ?? "",
      pending: true,
      seconds: payload.seconds,
    };
    setBubbles((b) => [...b, mine]);
    setBusy(true);

    const form = new FormData();
    form.set("sessionId", sessionId());
    form.set("language", lang);
    if (restaurantSlug) form.set("restaurant", restaurantSlug);
    if (payload.text) form.set("text", payload.text);
    if (payload.buttonId) form.set("buttonId", payload.buttonId);
    if (payload.audio) form.set("audio", payload.audio, "voice-note");

    try {
      const res = await fetch("/api/chat/web", { method: "POST", body: form });
      const data = (await res.json().catch(() => ({ error: "Unexpected response" }))) as ChatResponse;
      if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
      setBubbles((b) => [
        ...b.map((x) =>
          x.id === mine.id && x.from === "me" ? { ...x, pending: false, text: data.transcript ?? x.text } : x
        ),
        ...data.out.map((message): Bubble => ({ id: crypto.randomUUID(), from: "bot", message })),
      ]);
      if (data.orderReference) setNotice(`Order ${data.orderReference} is now on ${restaurantName}'s order board.`);
      else if (data.handoff) setNotice("A staff member has been asked to take over this chat. The AI will stay quiet.");
    } catch (err) {
      setBubbles((b) => b.filter((x) => x.id !== mine.id));
      setError(err instanceof Error ? err.message : "Couldn't send. Check your connection and try again.");
      if (payload.text && !payload.buttonId) setDraft(payload.text);
    } finally {
      setBusy(false);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    void send({ text });
  }

  async function toggleRecording() {
    if (recording) {
      recorder.current?.stop();
      return;
    }
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // OGG/Opus is what WhatsApp sends and Sunbird accepts; Chrome only records WebM.
      const mimeType = ["audio/ogg;codecs=opus", "audio/webm;codecs=opus", "audio/mp4"].find((t) => MediaRecorder.isTypeSupported(t));
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunks.current = [];
      rec.ondataavailable = (e) => e.data.size > 0 && chunks.current.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        const seconds = Math.max(1, Math.round((Date.now() - recordStart.current) / 1000));
        const blob = new Blob(chunks.current, { type: rec.mimeType || "audio/webm" });
        if (blob.size > 1000) void send({ audio: blob, seconds });
      };
      recorder.current = rec;
      recordStart.current = Date.now();
      setRecordMs(0);
      rec.start();
      setRecording(true);
    } catch {
      setError("Microphone access was blocked. Allow it in your browser, or type your message.");
    }
  }

  function restart() {
    const id = newSessionId();
    try {
      sessionStorage.setItem(storageKey, id);
    } catch {
      /* private mode: keep it in memory */
    }
    session.current = id;
    setBubbles([]);
    setNotice(null);
    setError(null);
  }

  const lastBot = [...bubbles].reverse().find((b) => b.from === "bot");
  const liveButtons = lastBot?.from === "bot" && lastBot.message.type === "buttons" ? lastBot.id : null;

  return (
    <div className={cn("flex h-[min(720px,calc(100dvh-8rem))] min-h-[520px] flex-col overflow-hidden rounded-3xl border bg-card shadow-sm", className)}>
      <header className="flex items-center gap-3 border-b px-4 py-3">
        <div aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-accent/15 text-sm font-semibold text-foreground">
          {restaurantName.slice(0, 1)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{restaurantName}</p>
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {busy ? "typing…" : "AI assistant · usually replies instantly"}
          </p>
        </div>
        <div role="group" aria-label="Language" className="flex rounded-full border p-0.5 text-xs">
          {(["lug", "eng"] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLang(l)}
              aria-pressed={lang === l}
              className={cn(
                "min-h-8 rounded-full px-2.5 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                lang === l ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {l === "lug" ? "Luganda" : "English"}
            </button>
          ))}
        </div>
        <Button variant="ghost" size="icon" onClick={restart} aria-label="Start a new chat" title="New chat" className="size-10">
          <RotateCcw className="size-4" />
        </Button>
      </header>

      <div ref={scroller} className="flex-1 space-y-2 overflow-y-auto bg-muted/60 px-3 py-4" role="log" aria-live="polite" aria-label="Chat">
        {bubbles.length === 0 && (
          <div className="mx-auto max-w-xs py-6 text-center">
            <p className="text-sm text-pretty text-muted-foreground">
              {lang === "lug"
                ? "Wandiika oba wereza voice note nga bw'owandiikira ekifo ky'emmere ku WhatsApp."
                : "Text or send a voice note, just like messaging a restaurant on WhatsApp."}
            </p>
            <div className="mt-4 flex flex-col gap-2">
              {SUGGESTIONS[lang].map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={busy}
                  onClick={() => void send({ text: s })}
                  className="min-h-10 rounded-full border bg-card px-4 text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {bubbles.map((b) =>
          b.from === "me" ? (
            <div key={b.id} className="flex justify-end">
              <div className="max-w-[80%] rounded-2xl rounded-br-md bg-accent/25 px-3 py-2 text-sm text-foreground">
                {b.kind === "voice" && (
                  <p className="mb-0.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Mic className="size-3.5" aria-hidden /> Voice note{b.seconds ? ` · 0:${String(b.seconds).padStart(2, "0")}` : ""}
                  </p>
                )}
                {b.kind === "voice" && !b.text ? (
                  <span className="text-muted-foreground italic">{b.pending ? "Transcribing…" : "Couldn't transcribe"}</span>
                ) : (
                  <RichText text={b.text} />
                )}
                <span className="float-right mt-1 ml-2 text-muted-foreground" aria-label={b.pending ? "Sending" : "Delivered"}>
                  {b.pending ? <Check className="size-3.5" /> : <CheckCheck className="size-3.5" />}
                </span>
              </div>
            </div>
          ) : (
            <div key={b.id} className="flex flex-col items-start gap-1.5">
              <div className="max-w-[85%] overflow-hidden rounded-2xl rounded-bl-md bg-card text-sm shadow-xs">
                {b.message.type === "image" ? (
                  <a href={b.message.url} target="_blank" rel="noreferrer" className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <Image
                      src={b.message.url}
                      alt={b.message.caption ?? "Menu"}
                      width={540}
                      height={720}
                      unoptimized
                      className="h-auto max-h-96 w-64 object-cover object-top outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10"
                    />
                    {b.message.caption && <p className="px-3 py-2 text-xs text-muted-foreground">{b.message.caption}</p>}
                  </a>
                ) : (
                  <p className="px-3 py-2">
                    <RichText text={b.message.text} />
                  </p>
                )}
              </div>
              {b.message.type === "buttons" && (
                <div className="flex max-w-[85%] flex-wrap gap-1.5">
                  {b.message.buttons.map((btn) => (
                    <button
                      key={btn.id}
                      type="button"
                      disabled={liveButtons !== b.id || busy}
                      onClick={() => void send({ text: btn.title, buttonId: btn.id })}
                      className="min-h-10 rounded-full border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                    >
                      {btn.title}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        )}

        {busy && (
          <div className="flex" aria-hidden>
            <div className="flex gap-1 rounded-2xl rounded-bl-md bg-card px-3 py-3 shadow-xs">
              {[0, 150, 300].map((d) => (
                <span key={d} className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60 motion-reduce:animate-none" style={{ animationDelay: `${d}ms` }} />
              ))}
            </div>
          </div>
        )}
      </div>

      {(notice || error) && (
        <p role={error ? "alert" : "status"} className={cn("border-t px-4 py-2 text-xs text-pretty", error ? "text-destructive" : "bg-accent/10 text-foreground")}>
          {error ?? notice}
        </p>
      )}

      <form onSubmit={submit} className="flex items-center gap-2 border-t p-2.5">
        {recording ? (
          <p className="flex flex-1 items-center gap-2 px-3 text-sm" aria-live="polite">
            <span className="size-2 animate-pulse rounded-full bg-destructive motion-reduce:animate-none" aria-hidden />
            Recording <span className="tabular-nums">{`0:${String(Math.floor(recordMs / 1000)).padStart(2, "0")}`}</span>
            <span className="text-muted-foreground">· tap stop to send</span>
          </p>
        ) : (
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={lang === "lug" ? "Wandiika obubaka" : "Type a message"}
            aria-label="Message"
            maxLength={1000}
            className="h-11 min-w-0 flex-1 rounded-full border bg-background px-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        )}
        {draft.trim() && !recording ? (
          <Button type="submit" size="icon" disabled={busy} aria-label="Send" className="size-11 shrink-0 rounded-full">
            <ArrowUp className="size-5" />
          </Button>
        ) : (
          <Button
            type="button"
            size="icon"
            variant={recording ? "destructive" : "default"}
            disabled={busy}
            onClick={() => void toggleRecording()}
            aria-label={recording ? "Stop and send voice note" : "Record a voice note"}
            className="size-11 shrink-0 rounded-full"
          >
            {recording ? <Square className="size-4" /> : <Mic className="size-5" />}
          </Button>
        )}
      </form>
    </div>
  );
}
