import Anthropic from "@anthropic-ai/sdk";

// Self-hosted: set ANTHROPIC_API_KEY to your key from console.anthropic.com
// Replit-hosted: set AI_INTEGRATIONS_ANTHROPIC_API_KEY + AI_INTEGRATIONS_ANTHROPIC_BASE_URL
//   (these are auto-set by the Replit Anthropic AI Integration)
const apiKey =
  process.env.ANTHROPIC_API_KEY ??
  process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY;

const baseURL = process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL;

if (!apiKey) {
  throw new Error(
    "No Anthropic API key found. " +
    "Self-hosted: set ANTHROPIC_API_KEY (get one at console.anthropic.com). " +
    "Replit: provision the Anthropic AI Integration to auto-set AI_INTEGRATIONS_ANTHROPIC_API_KEY.",
  );
}

export const anthropic = new Anthropic({
  apiKey,
  ...(baseURL ? { baseURL } : {}),
});
