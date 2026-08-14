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
const MAX_TRANSIENT_RETRIES = 2;

function isTransientGeminiError(error: unknown): boolean {
  const value = error as { status?: number; message?: string } | null;
  const status = value?.status;
  const message = String(value?.message ?? error ?? "");
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504 ||
    /temporarily|unavailable|high demand|rate.?limit|overloaded/i.test(message);
}

/**
 * Thin wrapper around generateContent that returns { text, inputTokens, outputTokens }.
 * Retries transient Gemini availability/rate-limit errors before surfacing the failure.
 * Handles the usageMetadata shape so callers don't have to.
 * Rejects with a timeout error if Gemini does not respond within GENERATE_TIMEOUT_MS.
 */
export async function generate(opts: {
  model?: string;
  systemInstruction?: string;
  userContent: string;
  maxOutputTokens?: number;
}): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_TRANSIENT_RETRIES; attempt += 1) {
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

    try {
      const response = await Promise.race([request, timeout]);
      return {
        text: response.text ?? "",
        inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
      };
    } catch (error) {
      lastError = error;
      if (!isTransientGeminiError(error) || attempt >= MAX_TRANSIENT_RETRIES) {
        throw error;
      }

      const delayMs = 500 * 2 ** attempt;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Gemini request failed");
}
