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

/**
 * Thin wrapper around generateContent that returns { text, inputTokens, outputTokens }.
 * Handles the usageMetadata shape so callers don't have to.
 */
export async function generate(opts: {
  model?: string;
  systemInstruction?: string;
  userContent: string;
  maxOutputTokens?: number;
}): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const response = await ai.models.generateContent({
    model: opts.model ?? GEMINI_FLASH,
    contents: [{ role: "user", parts: [{ text: opts.userContent }] }],
    config: {
      ...(opts.systemInstruction ? { systemInstruction: opts.systemInstruction } : {}),
      maxOutputTokens: opts.maxOutputTokens ?? 8192,
    },
  });

  return {
    text: response.text ?? "",
    inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
    outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
  };
}
