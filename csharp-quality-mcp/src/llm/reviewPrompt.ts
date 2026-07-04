import { generateObject } from "ai";
import { z } from "zod";
import { config } from "../config.js";
import type {
  Evidence,
  Finding,
  FocusArea,
  Suggestion,
} from "../types.js";
import { resolveModel } from "./provider.js";

const findingSchema = z.object({
  principle: z.enum([
    "SRP",
    "OCP",
    "LSP",
    "ISP",
    "DIP",
    "Readability",
    "Security",
    "Performance",
    "Duplication",
    "Complexity",
    "Naming",
    "ErrorHandling",
  ]),
  severity: z.enum(["critical", "major", "minor", "info"]),
  title: z.string().describe("Short, specific title of the issue."),
  rationale: z
    .string()
    .describe("Why this is a problem, referencing the concrete code."),
  file: z.string(),
  startLine: z.number().int().optional(),
  endLine: z.number().int().optional(),
  member: z.string().optional(),
  confidence: z.enum(["high", "medium", "low"]),
  relatedEvidence: z
    .array(z.string())
    .optional()
    .describe("Diagnostic ids or metric facts supporting this finding."),
});

const suggestionSchema = z.object({
  file: z.string().describe("The file this rewrite targets."),
  newContent: z
    .string()
    .describe("The complete, compilable new content of the file."),
  explanation: z.string().describe("What the refactor changes and why."),
  addressesFindingIndexes: z
    .array(z.number().int())
    .optional()
    .describe("0-based indexes into the findings array this suggestion fixes."),
});

const responseSchema = z.object({
  findings: z.array(findingSchema),
  suggestions: z.array(suggestionSchema),
});

export interface ReasoningInput {
  files: Array<{ path: string; content: string }>;
  evidence: Evidence;
  focus?: FocusArea[];
  wantSuggestions: boolean;
}

export interface ReasoningOutput {
  findings: Finding[];
  suggestions: Suggestion[];
}

const MAX_FILE_CHARS = 16_000;
const MAX_TOTAL_CHARS = 48_000;

function buildPrompt(input: ReasoningInput): string {
  const focus =
    input.focus && input.focus.length > 0
      ? input.focus.join(", ")
      : "solid, security, perf, readability";

  let budget = MAX_TOTAL_CHARS;
  const fileBlocks: string[] = [];
  for (const f of input.files) {
    if (budget <= 0) break;
    const slice = f.content.slice(0, Math.min(MAX_FILE_CHARS, budget));
    budget -= slice.length;
    const numbered = slice
      .split("\n")
      .map((line, i) => `${String(i + 1).padStart(4, " ")}| ${line}`)
      .join("\n");
    fileBlocks.push(`FILE: ${f.path}\n${numbered}`);
  }

  const ev = input.evidence;
  const topDiag = ev.diagnostics
    .slice(0, 40)
    .map(
      (d) =>
        `- [${d.severity}] ${d.id} ${d.file ? `${shortFile(d.file)}:${d.line ?? "?"}` : ""} ${d.message}`
    )
    .join("\n");
  const worst = ev.aggregates.worstMembers
    .map(
      (m) =>
        `- ${m.name}: complexity=${m.cyclomaticComplexity ?? "?"}, maintainability=${m.maintainabilityIndex ?? "?"}`
    )
    .join("\n");

  return `You are a meticulous senior C#/.NET reviewer. Judge DESIGN quality that
linters cannot: SOLID adherence, abstraction smells, coupling, naming, error
handling, and unnecessary complexity. Ground every finding in the concrete code
and, where possible, the deterministic evidence below. Do NOT invent issues.

Focus areas: ${focus}

DETERMINISTIC EVIDENCE (objective, from Roslyn):
- build ok: ${ev.buildOk}
- diagnostics: ${ev.aggregates.diagnosticCount} (errors=${ev.aggregates.errorCount}, warnings=${ev.aggregates.warningCount})
- max cyclomatic complexity: ${ev.aggregates.maxCyclomaticComplexity ?? "n/a"} (threshold ${config.thresholds.cyclomaticComplexity})
- avg maintainability index: ${ev.aggregates.avgMaintainabilityIndex ?? "n/a"}
Worst members:
${worst || "- (none reported)"}
Top diagnostics:
${topDiag || "- (none reported)"}

SOURCE:
${fileBlocks.join("\n\n")}

Rules:
- Prefer fewer, high-signal findings over many trivial ones.
- Set confidence honestly; if context is missing (single snippet), use "medium" or "low".
- ${
    input.wantSuggestions
      ? "For the most impactful findings, propose a concrete refactor as the COMPLETE new file content. The new content MUST stay compilable and preserve behavior."
      : "Do not propose suggestions; return an empty suggestions array."
  }
- Use the line numbers shown in the SOURCE for startLine/endLine.`;
}

function shortFile(p: string): string {
  const parts = p.replace(/\\/g, "/").split("/");
  return parts[parts.length - 1] ?? p;
}

let counter = 0;
function nextId(): string {
  counter += 1;
  return `F${counter}`;
}

/** Run the LLM reasoning step and normalize into domain types. */
export async function reasonAboutCode(
  input: ReasoningInput
): Promise<ReasoningOutput> {
  const model = resolveModel();
  const { object } = await generateObject({
    model,
    schema: responseSchema,
    maxOutputTokens: config.llm.maxOutputTokens,
    prompt: buildPrompt(input),
  });

  const findings: Finding[] = object.findings.map((f) => ({
    id: nextId(),
    principle: f.principle,
    severity: f.severity,
    title: f.title,
    rationale: f.rationale,
    location: {
      file: f.file,
      startLine: f.startLine,
      endLine: f.endLine,
      member: f.member,
    },
    evidence: f.relatedEvidence ?? [],
    confidence: f.confidence,
  }));

  const suggestions: Suggestion[] = object.suggestions.map((s) => {
    const findingIds = (s.addressesFindingIndexes ?? [])
      .map((i) => findings[i]?.id)
      .filter((x): x is string => Boolean(x));
    return {
      file: s.file,
      newContent: s.newContent,
      explanation: s.explanation,
      findingIds,
    };
  });

  return { findings, suggestions };
}
