import { GoogleGenAI } from "@google/genai";
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

/** Transcribe an audio message with the same Gemini stack used by GotThis. */
export async function transcribeWithGemini(
  audio: Buffer,
  mimeType: string,
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");

  const ai = new GoogleGenAI({ apiKey });
  const model = process.env.GEMINI_VOICE_MODEL || "gemini-2.5-flash";

  const result = await ai.models.generateContent({
    model,
    contents: [
      {
        inlineData: {
          data: audio.toString("base64"),
          mimeType: mimeType.split(";")[0],
        },
      },
      {
        text: "Transcribe this WhatsApp voice note exactly as spoken. Return only the transcription, with no commentary. Preserve the user's meaning and numbers.",
      },
    ],
  });

  const text = result.text?.trim() ?? "";
  if (!text) throw new Error("Gemini returned an empty transcription");
  return text;
}

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
      body: JSON.stringify({
        text,
        model_id: modelId,
      }),
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

/** Best-effort voice response: never prevent the text response from being sent. */
export async function sendVoiceReply(to: string, text: string): Promise<void> {
  try {
    const audio = await generateElevenLabsAudio(text);
    if (!audio) return;
    const mediaId = await uploadWhatsAppAudio(audio);
    await sendWhatsAppAudio(to, mediaId);
  } catch (err) {
    logger.error({ err }, "Failed to generate/send WhatsApp voice reply");
  }
}
