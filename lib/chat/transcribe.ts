import type { Language } from "../restaurants/types";
import { transcribeAudio } from "../voice/stt";

// Voice notes to text, Luganda first. Whisper and OpenAI's transcription models
// don't support Luganda (and OpenAI rejects WhatsApp's OGG), so:
//   1. Sunbird AI (Ugandan; lug/eng; OGG accepted). It can't detect the
//      language itself, so we pass the conversation's and retry with the other
//      one if the result is empty.
//   2. ElevenLabs Scribe (supports Luganda, auto-detects), if a key is set.
// Returns "" when nothing worked; the engine then asks the customer to type.

const MIN_AUDIO_BYTES = 1000;

export interface Transcript {
  text: string;
  provider: "sunbird" | "elevenlabs" | "openai" | "none";
  language: Language | null;
}

export async function transcribeVoiceNote(audio: Uint8Array, mimeType: string, preferred: Language): Promise<Transcript> {
  if (audio.byteLength < MIN_AUDIO_BYTES) return { text: "", provider: "none", language: null };

  if (process.env.SUNBIRD_API_KEY) {
    for (const lang of [preferred, preferred === "lug" ? "eng" : "lug"] as const) {
      try {
        const text = await sunbird(audio, mimeType, lang);
        if (text.replace(/[^\p{L}]/gu, "").length >= 2) return { text, provider: "sunbird", language: lang };
      } catch (err) {
        console.error(`[transcribe] sunbird (${lang}) failed`, err);
        break; // service problem, not a language mismatch: go to the fallback
      }
    }
  }

  if (process.env.ELEVENLABS_API_KEY) {
    try {
      const { text, language } = await elevenlabs(audio, mimeType);
      if (text) return { text, provider: "elevenlabs", language };
    } catch (err) {
      console.error("[transcribe] elevenlabs failed", err);
    }
  }

  // Last resort for browser recordings (WebM/MP4, not OGG): OpenAI, English
  // only. Keeps the web demo usable before a Sunbird key is set up.
  if (process.env.OPENAI_API_KEY && !mimeType.includes("ogg")) {
    try {
      const text = await transcribeAudio(audio);
      if (text) return { text, provider: "openai", language: "eng" };
    } catch (err) {
      console.error("[transcribe] openai failed", err);
    }
  }

  if (!process.env.SUNBIRD_API_KEY && !process.env.ELEVENLABS_API_KEY) {
    console.error("[transcribe] no speech-to-text key: set SUNBIRD_API_KEY (and optionally ELEVENLABS_API_KEY)");
  }
  return { text: "", provider: "none", language: null };
}

function fileName(mimeType: string) {
  const ext = mimeType.includes("ogg") ? "ogg" : mimeType.includes("webm") ? "webm" : mimeType.includes("mp4") ? "m4a" : mimeType.includes("mpeg") ? "mp3" : mimeType.includes("wav") ? "wav" : "ogg";
  return `voice-note.${ext}`;
}

async function sunbird(audio: Uint8Array, mimeType: string, language: Language): Promise<string> {
  const form = new FormData();
  form.append("audio", new Blob([audio as BlobPart], { type: mimeType.split(";")[0] }), fileName(mimeType));
  form.append("language", language);
  const res = await fetch("https://api.sunbird.ai/tasks/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.SUNBIRD_API_KEY}`, accept: "application/json" },
    body: form,
    signal: AbortSignal.timeout(Number(process.env.SUNBIRD_TIMEOUT_MS ?? 15_000)),
  });
  if (!res.ok) throw new Error(`Sunbird ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as { audio_transcription?: string };
  return (data.audio_transcription ?? "").trim();
}

async function elevenlabs(audio: Uint8Array, mimeType: string): Promise<{ text: string; language: Language | null }> {
  const form = new FormData();
  form.append("model_id", process.env.ELEVENLABS_STT_MODEL ?? "scribe_v2");
  form.append("file", new Blob([audio as BlobPart], { type: mimeType.split(";")[0] }), fileName(mimeType));
  const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST",
    headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY! },
    body: form,
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as { text?: string; language_code?: string };
  const code = data.language_code?.toLowerCase() ?? "";
  return {
    text: (data.text ?? "").trim(),
    language: code.startsWith("lug") || code === "lg" ? "lug" : code.startsWith("en") ? "eng" : null,
  };
}
