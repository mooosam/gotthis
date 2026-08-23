import { GoogleGenAI } from "@google/genai";

const geminiApiKey = process.env.GEMINI_API_KEY;
const groqApiKey = process.env.GROQ_API_KEY;

if (!geminiApiKey) {
  throw new Error(
    "No Gemini API key found. Set GEMINI_API_KEY to keep Gemini available as the fallback provider.",
  );
}

export const ai = new GoogleGenAI({ apiKey: geminiApiKey });

/** Default Gemini fallback model. */
export const GEMINI_FLASH = "gemini-2.5-flash";
export const GEMINI_FAST = "gemini-2.5-flash";

/** Default Groq primary model. Override with GROQ_MODEL if needed. */
export const GROQ_PRIMARY_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-20b";

const GROQ_GENERATE_TIMEOUT_MS = 20_000;
const GEMINI_GENERATE_TIMEOUT_MS = 30_000;
const MAX_GEMINI_TRANSIENT_RETRIES = 1;

export type GenerateResult = {
  text: string;
  inputTokens: number;
  outputTokens: number;
  provider: "groq" | "gemini";
  fallbackUsed: boolean;
};

function isTransientGeminiError(error: unknown): boolean {
  const value = error as { status?: number; message?: string } | null;
  const status = value?.status;
  const message = String(value?.message ?? error ?? "");
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504 ||
    /temporarily|unavailable|high demand|rate.?limit|overloaded/i.test(message);
}

async function generateWithGroq(opts: {
  systemInstruction?: string;
  userContent: string;
  maxOutputTokens?: number;
}): Promise<GenerateResult> {
  if (!groqApiKey) {
    throw new Error("GROQ_API_KEY is not configured");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GROQ_GENERATE_TIMEOUT_MS);

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${groqApiKey}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: GROQ_PRIMARY_MODEL,
        messages: [
          ...(opts.systemInstruction
            ? [{ role: "system", content: opts.systemInstruction }]
            : []),
          { role: "user", content: opts.userContent },
        ],
        max_completion_tokens: opts.maxOutputTokens ?? 8192,
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Groq request failed (${response.status}): ${body.slice(0, 500)}`);
    }

    const payload = await response.json() as {
      choices?: Array<{ message?: { content?: string | null } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };

    const text = payload.choices?.[0]?.message?.content ?? "";
    if (!text.trim()) {
      throw new Error("Groq returned an empty response");
    }

    return {
      text,
      inputTokens: payload.usage?.prompt_tokens ?? 0,
      outputTokens: payload.usage?.completion_tokens ?? 0,
      provider: "groq",
      fallbackUsed: false,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function generateWithGemini(opts: {
  model?: string;
  systemInstruction?: string;
  userContent: string;
  maxOutputTokens?: number;
}): Promise<GenerateResult> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_GEMINI_TRANSIENT_RETRIES; attempt += 1) {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`Gemini generate() timed out after ${GEMINI_GENERATE_TIMEOUT_MS / 1000}s`)),
        GEMINI_GENERATE_TIMEOUT_MS,
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
        provider: "gemini",
        fallbackUsed: true,
      };
    } catch (error) {
      lastError = error;
      if (!isTransientGeminiError(error) || attempt >= MAX_GEMINI_TRANSIENT_RETRIES) {
        throw error;
      }

      const delayMs = 500 * 2 ** attempt;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Gemini request failed");
}

/**
 * Unified AI generation entry point.
 *
 * Groq is attempted once as the primary provider. Any Groq failure (timeout,
 * rate limit, invalid/empty response, network error, etc.) falls back to
 * Gemini automatically. Callers keep using the same function and therefore do
 * not need provider-specific logic.
 */
export async function generate(opts: {
  model?: string;
  systemInstruction?: string;
  userContent: string;
  maxOutputTokens?: number;
}): Promise<GenerateResult> {
  if (groqApiKey) {
    try {
      return await generateWithGroq(opts);
    } catch (error) {
      // Do not surface Groq failures to users; Gemini is the resilience path.
      console.warn("Groq primary generation failed; falling back to Gemini", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return generateWithGemini(opts);
}
