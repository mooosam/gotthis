import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error(
    "No Gemini API key found. Set GEMINI_API_KEY to your key from aistudio.google.com.",
  );
}

export const ai = new GoogleGenAI({ apiKey });

/** Default model for main coaching responses (capable, fast). */
export const GEMINI_FLASH = "gemini-2.5-flash";

/** Alias — same model used for both "sonnet-class" and "haiku-class" tasks. */
export const GEMINI_FAST = "gemini-2.5-flash";

/** How long to wait for a Gemini response before giving up. */
const GENERATE_TIMEOUT_MS = 30_000;

/**
 * Thin wrapper around generateContent that returns { text, inputTokens, outputTokens }.
 * Handles the usageMetadata shape so callers don't have to.
 * Rejects with a timeout error if Gemini does not respond within GENERATE_TIMEOUT_MS.
 */
export async function generate(opts: {
  model?: string;
  systemInstruction?: string;
  userContent: string;
  maxOutputTokens?: number;
}): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error(`Gemini generate() timed out after ${GENERATE_TIMEOUT_MS / 1000}s`)),
      GENERATE_TIMEOUT_MS,
    ),
  );

  const request = ai.models.generateContent({
    model: opts.model ?? GEMINI_FLASH,
    contents: [{ role: "user", parts: [{ text: opts.userContent }] }],
    config: {
      ...(opts.systemInstruction ? { systemInstruction: opts.systemInstruction } : {}),
      maxOutputTokens: opts.maxOutputTokens ?? 8192,
    },
  });

  const response = await Promise.race([request, timeout]);

  return {
    text: response.text ?? "",
    inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
    outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
  };
}
