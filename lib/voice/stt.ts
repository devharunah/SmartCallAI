import { transcribe } from "ai";
import { openai } from "@ai-sdk/openai";

/**
 * Download an Africa's Talking recording (MP3/WAV, kept 48h) and turn it into
 * text. AT doesn't document whether recording links need auth, so try a plain
 * GET first and retry once with the API key header.
 */
export async function transcribeRecording(recordingUrl: string): Promise<string> {
  let res = await fetch(recordingUrl, { signal: AbortSignal.timeout(5000) });
  if ((res.status === 401 || res.status === 403) && process.env.AT_API_KEY) {
    res = await fetch(recordingUrl, {
      headers: { apiKey: process.env.AT_API_KEY },
      signal: AbortSignal.timeout(5000),
    });
  }
  if (!res.ok) throw new Error(`Recording download failed: ${res.status}`);

  return transcribeAudio(new Uint8Array(await res.arrayBuffer()));
}

/** Speech to text for any audio clip (MP3, WAV, WebM, MP4/M4A). */
export async function transcribeAudio(audio: Uint8Array): Promise<string> {
  if (audio.byteLength < 1000) return ""; // silence / empty file

  const { text } = await transcribe({
    model: openai.transcription(process.env.VOICE_STT_MODEL ?? "gpt-4o-mini-transcribe"),
    audio,
    abortSignal: AbortSignal.timeout(8000),
  });
  return text.trim();
}
