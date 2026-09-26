"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Phone, PhoneOff, SkipForward, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// In-app voice call with the same AI agent that answers the phone line.
// Turn-based: record until the caller pauses, POST the clip, play the reply,
// listen again. No telephony provider, so it costs only the OpenAI usage.

type Status = "idle" | "connecting" | "listening" | "thinking" | "speaking" | "transferred" | "ended" | "error";

interface Speech {
  base64: string;
  mediaType: string;
}

interface TurnResponse {
  userText: string;
  reply: string;
  action: "continue" | "retry" | "transfer" | "end";
  agent: { id: string; name: string; phone: string } | null;
  audio: Speech | null;
  error?: string;
}

interface Line {
  who: "ai" | "caller";
  text: string;
  at: number;
}

const SILENCE_MS = 1200; // pause that ends the caller's turn
const NO_SPEECH_MS = 8000; // give up listening if nothing is said
const MAX_TURN_MS = 30000;
const SPEECH_LEVEL = 0.02; // RMS above this counts as talking

const LABEL: Record<Status, string> = {
  idle: "Ready",
  connecting: "Connecting…",
  listening: "Listening, go ahead",
  thinking: "Thinking…",
  speaking: "SmartCall is speaking",
  transferred: "Transferred",
  ended: "Call ended",
  error: "Something went wrong",
};

function formatTime(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function VoiceCall() {
  const [status, setStatus] = useState<Status>("idle");
  const [lines, setLines] = useState<Line[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [level, setLevel] = useState(0);
  const [muted, setMuted] = useState(false);
  const [agent, setAgent] = useState<TurnResponse["agent"]>(null);
  const [error, setError] = useState<string | null>(null);

  const active = useRef(false);
  const sessionId = useRef("");
  const startedAt = useRef(0);
  const stream = useRef<MediaStream | null>(null);
  const audioCtx = useRef<AudioContext | null>(null);
  const analyser = useRef<AnalyserNode | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const player = useRef<HTMLAudioElement | null>(null);
  const skipPlayback = useRef<(() => void) | null>(null);
  const stopTurn = useRef<(() => void) | null>(null);
  const transcriptEnd = useRef<HTMLLIElement | null>(null);

  const live = status === "listening" || status === "thinking" || status === "speaking" || status === "connecting";

  useEffect(() => {
    if (!live) return;
    const timer = setInterval(() => setElapsed(Math.round((Date.now() - startedAt.current) / 1000)), 500);
    return () => clearInterval(timer);
  }, [live]);

  useEffect(() => {
    transcriptEnd.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [lines]);

  useEffect(() => () => teardown(), []);

  function secondsIn() {
    return Math.round((Date.now() - startedAt.current) / 1000);
  }

  function addLine(who: Line["who"], text: string, at = secondsIn()) {
    setLines((prev) => [...prev, { who, text, at }]);
  }

  function teardown() {
    active.current = false;
    stopTurn.current?.();
    skipPlayback.current?.();
    if (recorder.current?.state === "recording") recorder.current.stop();
    stream.current?.getTracks().forEach((t) => t.stop());
    audioCtx.current?.close().catch(() => {});
    stream.current = null;
    audioCtx.current = null;
  }

  async function start() {
    setError(null);
    setLines([]);
    setAgent(null);
    setElapsed(0);
    setStatus("connecting");
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch {
      setStatus("error");
      setError("Microphone access was blocked. Allow the microphone for this site and try again.");
      return;
    }

    audioCtx.current = new AudioContext();
    analyser.current = audioCtx.current.createAnalyser();
    analyser.current.fftSize = 1024;
    audioCtx.current.createMediaStreamSource(stream.current).connect(analyser.current);

    sessionId.current = `app_${crypto.randomUUID()}`;
    startedAt.current = Date.now();
    active.current = true;

    try {
      const res = await fetch("/api/voice/app/greeting");
      const greeting = (await res.json()) as { reply: string; audio: Speech | null };
      addLine("ai", greeting.reply);
      await play(greeting.audio, greeting.reply);
      await loop();
    } catch (err) {
      fail(err);
    }
  }

  async function loop() {
    while (active.current) {
      const listenedAt = secondsIn();
      const clip = await listen();
      if (!active.current) return;

      setStatus("thinking");
      const form = new FormData();
      form.set("sessionId", sessionId.current);
      form.set("audio", clip, clip.type.includes("mp4") ? "turn.mp4" : "turn.webm");
      const res = await fetch("/api/voice/app/turn", { method: "POST", body: form });
      const turn = (await res.json()) as TurnResponse;
      if (!res.ok) throw new Error(turn.error ?? `Request failed (${res.status})`);
      if (!active.current) return;

      if (turn.userText) addLine("caller", turn.userText, listenedAt);
      addLine("ai", turn.reply);
      await play(turn.audio, turn.reply);
      if (!active.current) return;

      if (turn.action === "transfer") {
        setAgent(turn.agent);
        finish("transferred");
        return;
      }
      if (turn.action === "end") {
        finish("ended");
        return;
      }
    }
  }

  /** Record one caller turn; resolves when they pause, press "Done", or say nothing. */
  function listen(): Promise<Blob> {
    setStatus("listening");
    return new Promise((resolve) => {
      const rec = new MediaRecorder(stream.current!);
      recorder.current = rec;
      const chunks: Blob[] = [];
      let heard = false;
      let lastSound = Date.now();
      const began = Date.now();
      let frame = 0;
      const samples = new Float32Array(analyser.current!.fftSize);

      const stop = () => {
        cancelAnimationFrame(frame);
        stopTurn.current = null;
        setLevel(0);
        if (rec.state === "recording") rec.stop();
      };
      stopTurn.current = stop;

      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      // Nothing said: send an empty clip so the server's "didn't catch that" logic runs.
      rec.onstop = () => resolve(heard ? new Blob(chunks, { type: rec.mimeType }) : new Blob([], { type: rec.mimeType }));

      const tick = () => {
        analyser.current!.getFloatTimeDomainData(samples);
        const rms = Math.sqrt(samples.reduce((sum, v) => sum + v * v, 0) / samples.length);
        setLevel(Math.min(1, rms * 12));
        const now = Date.now();
        if (rms > SPEECH_LEVEL) {
          heard = true;
          lastSound = now;
        }
        if ((heard && now - lastSound > SILENCE_MS) || (!heard && now - began > NO_SPEECH_MS) || now - began > MAX_TURN_MS) {
          return stop();
        }
        frame = requestAnimationFrame(tick);
      };

      rec.start(250);
      frame = requestAnimationFrame(tick);
    });
  }

  function play(audio: Speech | null, text: string): Promise<void> {
    setStatus("speaking");
    return new Promise((resolve) => {
      const done = () => {
        skipPlayback.current = null;
        resolve();
      };
      if (audio) {
        const el = new Audio(`data:${audio.mediaType};base64,${audio.base64}`);
        player.current = el;
        el.onended = done;
        el.onerror = done;
        skipPlayback.current = () => {
          el.pause();
          done();
        };
        el.play().catch(done);
      } else if ("speechSynthesis" in window) {
        // Server-side speech failed: fall back to the browser's voice.
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.onend = done;
        utterance.onerror = done;
        skipPlayback.current = () => {
          speechSynthesis.cancel();
          done();
        };
        speechSynthesis.speak(utterance);
      } else {
        done();
      }
    });
  }

  function finish(final: "transferred" | "ended") {
    const duration = Math.round((Date.now() - startedAt.current) / 1000);
    teardown();
    setStatus(final);
    setMuted(false);
    if (sessionId.current) {
      fetch("/api/voice/app/end", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: sessionId.current, durationSeconds: duration }),
        keepalive: true,
      }).catch(() => {});
    }
  }

  function fail(err: unknown) {
    console.error(err);
    const wasActive = active.current;
    finish("ended");
    if (wasActive) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "The call dropped.");
    }
  }

  function toggleMute() {
    const next = !muted;
    stream.current?.getAudioTracks().forEach((t) => (t.enabled = !next));
    setMuted(next);
  }

  return (
    <section aria-label="Voice call with SmartCall AI" className="overflow-hidden rounded-2xl bg-background ring-1 ring-foreground/10">
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
        <div className="flex min-w-0 items-center gap-2 text-sm font-medium" aria-live="polite">
          <span className="relative flex size-2 shrink-0">
            {live && <span className="absolute inline-flex size-full rounded-full bg-accent opacity-60 motion-safe:animate-ping" />}
            <span className={cn("relative inline-flex size-2 rounded-full", live ? "bg-accent" : status === "error" ? "bg-destructive" : "bg-muted-foreground/40")} />
          </span>
          <span className="truncate">
            {status === "transferred" && agent ? `Connecting you to ${agent.name}` : LABEL[status]}
            {muted && live ? " · muted" : ""}
          </span>
        </div>
        <span className="font-mono text-xs text-muted-foreground tabular-nums">{formatTime(elapsed)}</span>
      </div>

      <div className="px-5 py-5">
        {lines.length === 0 ? (
          <div className="py-6 text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-balance">Talk to SmartCall</h1>
            <p className="mx-auto mt-2 max-w-sm text-pretty text-muted-foreground">
              Start a call and describe your problem out loud, like you would on the phone. The AI will try to solve it right away.
            </p>
          </div>
        ) : (
          <ol className="max-h-[22rem] space-y-4 overflow-y-auto pr-1">
            {lines.map((line, i) => (
              <li key={i} className="flex gap-3">
                <span className="w-9 shrink-0 pt-0.5 font-mono text-xs text-muted-foreground tabular-nums">{formatTime(line.at)}</span>
                <div className="min-w-0">
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{line.who === "ai" ? "SmartCall AI" : "You"}</p>
                  <p className={cn("mt-0.5 text-sm text-pretty", line.who === "ai" ? "text-foreground" : "text-muted-foreground")}>{line.text}</p>
                </div>
              </li>
            ))}
            <li ref={transcriptEnd} aria-hidden />
          </ol>
        )}

        {status === "transferred" && (
          <p className="mt-4 rounded-lg bg-muted px-4 py-3 text-sm text-pretty">
            {agent
              ? `In a real call you'd now be ringing ${agent.name}, who gets a summary of what you said.`
              : "Everyone is busy right now. In a real call, someone would call you back."}
          </p>
        )}
        {error && <p className="mt-4 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>}
      </div>

      {status === "listening" && (
        <div className="px-5" aria-hidden>
          <div className="h-1 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-accent transition-[width] duration-75" style={{ width: `${Math.round(level * 100)}%` }} />
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-center gap-3 px-5 py-5">
        {live ? (
          <>
            <Button variant="outline" size="icon-lg" className="size-11" onClick={toggleMute} aria-pressed={muted} aria-label={muted ? "Unmute microphone" : "Mute microphone"}>
              {muted ? <MicOff /> : <Mic />}
            </Button>
            {status === "listening" && (
              <Button variant="outline" size="lg" onClick={() => stopTurn.current?.()}>
                <Square aria-hidden /> Done speaking
              </Button>
            )}
            {status === "speaking" && (
              <Button variant="outline" size="lg" onClick={() => skipPlayback.current?.()}>
                <SkipForward aria-hidden /> Skip
              </Button>
            )}
            <Button variant="destructive" size="lg" onClick={() => finish("ended")}>
              <PhoneOff aria-hidden /> End call
            </Button>
          </>
        ) : (
          <Button variant="accent" size="lg" onClick={start} className="min-w-44">
            <Phone aria-hidden /> {status === "idle" ? "Start voice call" : "Call again"}
          </Button>
        )}
      </div>
    </section>
  );
}
