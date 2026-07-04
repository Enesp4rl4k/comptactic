import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";
import { config } from "../config.js";

export class LlmUnavailableError extends Error {}

/**
 * Resolve a language model from environment configuration. Supports OpenAI,
 * Anthropic, and any OpenAI-compatible endpoint (e.g. Ollama, LM Studio).
 */
export function resolveModel(): LanguageModel {
  const { provider, model, apiKey, baseURL } = config.llm;

  switch (provider) {
    case "anthropic": {
      if (!apiKey) {
        throw new LlmUnavailableError(
          "Anthropic API key missing (set SG_LLM_API_KEY or ANTHROPIC_API_KEY)."
        );
      }
      return createAnthropic({ apiKey })(model);
    }
    case "openai-compatible": {
      if (!baseURL) {
        throw new LlmUnavailableError(
          "openai-compatible provider requires SG_LLM_BASE_URL (e.g. http://localhost:11434/v1)."
        );
      }
      return createOpenAICompatible({
        name: "solidguard-compat",
        baseURL,
        apiKey: apiKey ?? "not-needed",
      })(model);
    }
    case "openai":
    default: {
      if (!apiKey) {
        throw new LlmUnavailableError(
          "OpenAI API key missing (set SG_LLM_API_KEY or OPENAI_API_KEY)."
        );
      }
      return createOpenAI({ apiKey })(model);
    }
  }
}
