/** Centralized, env-overridable configuration. */

function num(env: string | undefined, fallback: number): number {
  const n = env ? Number(env) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

export const config = {
  /** Quality thresholds used both for the generated .editorconfig and scoring. */
  thresholds: {
    cyclomaticComplexity: num(process.env.SG_MAX_COMPLEXITY, 10),
    maintainabilityIndexMin: num(process.env.SG_MIN_MAINTAINABILITY, 20),
    classCoupling: num(process.env.SG_MAX_COUPLING, 30),
    inheritanceDepth: num(process.env.SG_MAX_INHERITANCE, 5),
    methodLines: num(process.env.SG_MAX_METHOD_LINES, 60),
  },

  /** Target framework used for generated throwaway projects. */
  targetFramework: process.env.SG_TARGET_FRAMEWORK ?? "net9.0",

  /** NuGet analyzer package versions for generated projects. */
  analyzerVersions: {
    sonar: process.env.SG_SONAR_VERSION ?? "10.24.0.138807",
    roslynator: process.env.SG_ROSLYNATOR_VERSION ?? "4.14.0",
    metrics: process.env.SG_METRICS_VERSION ?? "3.3.4",
  },

  /** How long (ms) a single dotnet invocation may run before being killed. */
  dotnetTimeoutMs: num(process.env.SG_DOTNET_TIMEOUT_MS, 240_000),

  /** How long (ms) any non-dotnet external tool (semgrep, eslint, ...) may run. */
  toolTimeoutMs: num(process.env.SG_TOOL_TIMEOUT_MS, 120_000),

  /** Max iterations of the autonomous fix loop. */
  maxFixIterations: num(process.env.SG_MAX_FIX_ITERATIONS, 4),

  llm: {
    provider: (process.env.SG_LLM_PROVIDER ?? "openai") as
      | "openai"
      | "anthropic"
      | "openai-compatible",
    model: process.env.SG_LLM_MODEL ?? "gpt-4o-mini",
    /** Base URL for openai-compatible providers (e.g. Ollama: http://localhost:11434/v1). */
    baseURL: process.env.SG_LLM_BASE_URL,
    apiKey:
      process.env.SG_LLM_API_KEY ??
      process.env.OPENAI_API_KEY ??
      process.env.ANTHROPIC_API_KEY,
    maxOutputTokens: num(process.env.SG_LLM_MAX_TOKENS, 8000),
  },

  /** Maximum number of suggestions to actually verify in the sandbox. */
  maxVerifiedSuggestions: num(process.env.SG_MAX_VERIFIED, 4),
} as const;

export type Config = typeof config;
