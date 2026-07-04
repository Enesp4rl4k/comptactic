import { runDeterministicAnalysis } from "../analysis/aggregate.js";
import { prepareWorkspace, type SourceInput } from "../analysis/workspace.js";
import { LlmUnavailableError } from "../llm/provider.js";
import { reasonAboutCode } from "../llm/reviewPrompt.js";
import { renderReview } from "../report/markdown.js";
import { computeScore } from "../report/score.js";
import type {
  Finding,
  FocusArea,
  ReviewResult,
  Suggestion,
  VerifiedSuggestion,
} from "../types.js";
import { verifySuggestions } from "../verify/sandbox.js";
import { readSources } from "./readSources.js";

export interface ReviewArgs extends SourceInput {
  focus?: FocusArea[];
  includeSuggestions?: boolean;
}

export async function reviewCsharp(args: ReviewArgs): Promise<ReviewResult> {
  const ws = await prepareWorkspace(args);
  try {
    const { evidence } = await runDeterministicAnalysis(ws);
    const sources = await readSources(ws);

    let findings: Finding[] = [];
    let rawSuggestions: Suggestion[] = [];
    const wantSuggestions = args.includeSuggestions !== false;

    try {
      const reasoning = await reasonAboutCode({
        files: sources,
        evidence,
        focus: args.focus,
        wantSuggestions,
      });
      findings = reasoning.findings;
      rawSuggestions = reasoning.suggestions;
    } catch (err) {
      if (err instanceof LlmUnavailableError) {
        evidence.notes.push(
          `LLM reasoning skipped: ${err.message} Returning deterministic analysis only.`
        );
      } else {
        evidence.notes.push(`LLM reasoning failed: ${String(err)}`);
      }
    }

    let suggestions: VerifiedSuggestion[] = [];
    if (wantSuggestions && rawSuggestions.length > 0) {
      suggestions = await verifySuggestions(ws, evidence, rawSuggestions);
    }

    const score = computeScore(evidence, findings);
    const markdown = renderReview({ score, evidence, findings, suggestions });

    return {
      score,
      summary: `${findings.length} finding(s); ${suggestions.filter((s) => s.verified).length}/${suggestions.length} suggestion(s) verified.`,
      buildOk: evidence.buildOk,
      findings,
      suggestions,
      metrics: evidence.metrics,
      diagnostics: evidence.diagnostics,
      notes: evidence.notes,
      markdown,
    };
  } finally {
    await ws.cleanup();
  }
}
