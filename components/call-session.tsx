"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { RouteCallResponse } from "@/lib/types";

type Stage = "idle" | "listening" | "processing" | "result" | "connecting" | "error";

export function CallSession() {
  const [stage, setStage] = useState<Stage>("idle");
  const [finalTranscript, setFinalTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [manualText, setManualText] = useState("");
  const [showFallback, setShowFallback] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<RouteCallResponse | null>(null);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    const SpeechRecognitionCtor =
      typeof window !== "undefined"
        ? window.SpeechRecognition ?? window.webkitSpeechRecognition
        : undefined;

    if (!SpeechRecognitionCtor) {
      setSpeechSupported(false);
      setShowFallback(true);
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      let interim = "";
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        if (res.isFinal) {
          final += res[0].transcript;
        } else {
          interim += res[0].transcript;
        }
      }
      if (final) setFinalTranscript((prev) => (prev ? `${prev} ${final}` : final));
      setInterimTranscript(interim);
    };

    recognition.onerror = () => {
      setShowFallback(true);
    };

    recognitionRef.current = recognition;
  }, []);

  const startListening = useCallback(() => {
    setFinalTranscript("");
    setInterimTranscript("");
    setErrorMessage(null);
    setResult(null);

    if (!recognitionRef.current) {
      setShowFallback(true);
      return;
    }

    try {
      recognitionRef.current.start();
      setStage("listening");
    } catch {
      setShowFallback(true);
    }
  }, []);

  const submitTranscript = useCallback(async (transcript: string) => {
    if (!transcript.trim()) return;

    recognitionRef.current?.stop();
    setStage("processing");
    setErrorMessage(null);

    try {
      const res = await fetch("/api/route-call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript }),
      });

      if (!res.ok) throw new Error("Routing request failed");

      const data: RouteCallResponse = await res.json();
      setResult(data);
      setStage("result");
    } catch {
      setErrorMessage("Something went wrong reaching the routing service. Please try again.");
      setStage("error");
    }
  }, []);

  const proceedToConnecting = useCallback(() => {
    setStage("connecting");
  }, []);

  const reset = useCallback(() => {
    setStage("idle");
    setFinalTranscript("");
    setInterimTranscript("");
    setManualText("");
    setResult(null);
    setErrorMessage(null);
  }, []);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-12">
      {stage === "idle" && (
        <Card>
          <CardHeader>
            <CardTitle>Hello. Please tell us how we can help today.</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Button size="lg" onClick={startListening} disabled={!speechSupported && !showFallback}>
              Start Call
            </Button>
            {(showFallback || !speechSupported) && (
              <ManualInput
                value={manualText}
                onChange={setManualText}
                onSubmit={() => submitTranscript(manualText)}
                note={!speechSupported ? "Speech recognition isn't supported in this browser — type your issue instead." : undefined}
              />
            )}
            {speechSupported && !showFallback && (
              <button
                type="button"
                className="text-sm text-muted-foreground underline underline-offset-4"
                onClick={() => setShowFallback(true)}
              >
                Speech not working? Type instead.
              </button>
            )}
          </CardContent>
        </Card>
      )}

      {stage === "listening" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
              Listening...
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="min-h-16 rounded-md border bg-muted/30 p-3 text-sm">
              {finalTranscript}
              <span className="text-muted-foreground italic"> {interimTranscript}</span>
            </p>
            <div className="flex gap-2">
              <Button onClick={() => submitTranscript(finalTranscript || interimTranscript)}>
                Done
              </Button>
              <Button variant="outline" onClick={reset}>
                Cancel
              </Button>
            </div>
            <ManualInput
              value={manualText}
              onChange={setManualText}
              onSubmit={() => submitTranscript(manualText)}
              note="Speech not working? Type instead."
            />
          </CardContent>
        </Card>
      )}

      {stage === "processing" && (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <span className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">Analyzing your request...</p>
          </CardContent>
        </Card>
      )}

      {stage === "result" && result && (
        <Card>
          <CardHeader>
            <CardTitle>We understood your issue</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <Badge>{result.category}</Badge>
              <span className="text-sm text-muted-foreground">
                Confidence: {result.confidence}%
              </span>
            </div>
            <p className="text-sm">{result.summary}</p>
            <p className="text-sm text-muted-foreground">{result.reason}</p>

            {result.queued ? (
              <p className="rounded-md border bg-muted/30 p-3 text-sm">
                All {result.category} agents are currently busy. You are next in the queue.
              </p>
            ) : (
              <p className="text-sm">
                Assigned agent: <span className="font-medium">{result.agent?.name}</span>
              </p>
            )}

            <div className="flex gap-2">
              <Button onClick={proceedToConnecting}>
                {result.queued ? "Continue" : `Connect to ${result.agent?.name}`}
              </Button>
              <Button variant="outline" onClick={reset}>
                Start New Call
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {stage === "connecting" && result && (
        <ConnectingScreen agentName={result.agent?.name ?? null} onDone={reset} />
      )}

      {stage === "error" && (
        <Card>
          <CardContent className="flex flex-col gap-4 py-8">
            <p className="text-sm text-destructive">{errorMessage}</p>
            <Button variant="outline" onClick={reset}>
              Try Again
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ManualInput({
  value,
  onChange,
  onSubmit,
  note,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  note?: string;
}) {
  return (
    <div className="flex flex-col gap-2 border-t pt-4">
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
      <textarea
        className="min-h-20 w-full rounded-md border bg-background p-2 text-sm"
        placeholder="Type your issue here..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <Button variant="secondary" onClick={onSubmit} disabled={!value.trim()}>
        Submit
      </Button>
    </div>
  );
}

function ConnectingScreen({
  agentName,
  onDone,
}: {
  agentName: string | null;
  onDone: () => void;
}) {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setConnected(true), 1800);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 py-12">
        {connected ? (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500 text-white">
            ✓
          </span>
        ) : (
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        )}
        <p className="text-sm text-muted-foreground">
          {connected
            ? agentName
              ? `Connected to ${agentName}.`
              : "You're in the queue."
            : agentName
              ? `Connecting you to ${agentName}...`
              : "Connecting you to the queue..."}
        </p>
        <Button variant="outline" size="sm" onClick={onDone}>
          Start New Call
        </Button>
      </CardContent>
    </Card>
  );
}
