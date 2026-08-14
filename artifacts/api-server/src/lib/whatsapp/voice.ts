import { logger } from "../logger.js";

const GRAPH_VERSION = "v21.0";

function getWhatsAppConfig() {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!phoneNumberId || !token) {
    throw new Error("WhatsApp Cloud API is not configured");
  }
  return { phoneNumberId, token };
}

/** Download an incoming WhatsApp media object into memory. */
export async function downloadWhatsAppMedia(mediaId: string): Promise<{
  data: Buffer;
  mimeType: string;
}> {
  const { token } = getWhatsAppConfig();

  const metaRes = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(mediaId)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!metaRes.ok) {
    throw new Error(`WhatsApp media metadata failed: ${metaRes.status}`);
  }

  const meta = (await metaRes.json()) as { url?: string; mime_type?: string };
  if (!meta.url) throw new Error("WhatsApp media URL was not returned");

  const mediaRes = await fetch(meta.url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!mediaRes.ok) {
    throw new Error(`WhatsApp media download failed: ${mediaRes.status}`);
  }

  return {
    data: Buffer.from(await mediaRes.arrayBuffer()),
    mimeType: meta.mime_type || mediaRes.headers.get("content-type") || "audio/ogg",
  };
}

/** Transcribe WhatsApp audio with ElevenLabs Scribe. Gemini is intentionally not used for STT. */
export async function transcribeWithElevenLabs(
  audio: Buffer,
  mimeType: string,
): Promise<string> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY is not configured");

  const form = new FormData();
  form.append("model_id", process.env.ELEVENLABS_STT_MODEL_ID || "scribe_v2");
  form.append("tag_audio_events", "false");
  form.append(
    "file",
    new Blob([audio], { type: mimeType.split(";")[0] || "audio/ogg" }),
    "whatsapp-voice.ogg",
  );

  const response = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST",
    headers: { "xi-api-key": apiKey },
    body: form,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`ElevenLabs STT failed: ${response.status} ${body.slice(0, 300)}`);
  }

  const result = (await response.json()) as { text?: string };
  const text = result.text?.trim() ?? "";
  if (!text) throw new Error("ElevenLabs returned an empty transcription");
  return text;
}

/** @deprecated Kept as an alias for compatibility with existing imports. */
export const transcribeWithGemini = transcribeWithElevenLabs;

/** Generate an MP3 response with ElevenLabs. Returns null when voice replies are not configured. */
export async function generateElevenLabsAudio(text: string): Promise<Buffer | null> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;

  if (!apiKey || !voiceId) {
    logger.warn("ElevenLabs voice replies are not configured; sending text only");
    return null;
  }

  const modelId = process.env.ELEVENLABS_MODEL_ID || "eleven_multilingual_v2";
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({ text, model_id: modelId }),
    },
  );

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`ElevenLabs TTS failed: ${response.status} ${body.slice(0, 300)}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

/** Upload generated audio to WhatsApp and return the media ID. */
export async function uploadWhatsAppAudio(audio: Buffer): Promise<string> {
  const { phoneNumberId, token } = getWhatsAppConfig();
  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("type", "audio/mpeg");
  form.append("file", new Blob([audio], { type: "audio/mpeg" }), "gotthis.mp3");

  const response = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/media`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    },
  );

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`WhatsApp audio upload failed: ${response.status} ${body.slice(0, 300)}`);
  }

  const result = (await response.json()) as { id?: string };
  if (!result.id) throw new Error("WhatsApp did not return an audio media ID");
  return result.id;
}

export async function sendWhatsAppAudio(to: string, mediaId: string): Promise<void> {
  const { phoneNumberId, token } = getWhatsAppConfig();
  const response = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "audio",
        audio: { id: mediaId },
      }),
    },
  );

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`WhatsApp audio send failed: ${response.status} ${body.slice(0, 300)}`);
  }
}

/** Best-effort voice response retained for compatibility; voice replies are disabled in the current text-only mode. */
export async function sendVoiceReply(_to: string, _text: string): Promise<void> {
  logger.debug("Voice reply skipped; GotThis is configured for text-only responses");
}
