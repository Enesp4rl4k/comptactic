import { promises as fs } from "node:fs";
import path from "node:path";
import { createTwoFilesPatch } from "diff";
import { config } from "../config.js";
import { runDeterministicAnalysis } from "../analysis/aggregate.js";
import { cloneWorkspace } from "../analysis/workspace.js";
import type {
  AnalyzableWorkspace,
  Evidence,
  Suggestion,
  VerifiedSuggestion,
} from "../types.js";

/** Resolve which on-disk source file a (possibly shortened) LLM path refers to. */
export function resolveTargetFile(
  ws: AnalyzableWorkspace,
  candidate: string
): string | undefined {
  const norm = (p: string) => path.resolve(p).replace(/\\/g, "/").toLowerCase();
  const target = norm(candidate);

  const exact = ws.sourceFiles.find((f) => norm(f) === target);
  if (exact) return exact;

  const base = path.basename(candidate).toLowerCase();
  const byBase = ws.sourceFiles.find(
    (f) => path.basename(f).toLowerCase() === base
  );
  if (byBase) return byBase;

  if (ws.sourceFiles.length === 1) return ws.sourceFiles[0];
  return undefined;
}

function computeVerdict(
  before: Evidence,
  after: Evidence,
  compileOk: boolean
): { verified: boolean; rejectionReason?: string } {
  if (!compileOk) {
    return { verified: false, rejectionReason: "Proposed code does not compile." };
  }
  const beforeErrors = before.aggregates.errorCount;
  const afterErrors = after.aggregates.errorCount;
  if (afterErrors > beforeErrors) {
    return {
      verified: false,
      rejectionReason: `Introduces ${afterErrors - beforeErrors} new error diagnostic(s).`,
    };
  }
  if (after.aggregates.diagnosticCount > before.aggregates.diagnosticCount) {
    return {
      verified: false,
      rejectionReason: "Increases total analyzer diagnostics.",
    };
  }
  const cBefore = before.aggregates.maxCyclomaticComplexity ?? Infinity;
  const cAfter = after.aggregates.maxCyclomaticComplexity ?? cBefore;
  if (cAfter > cBefore) {
    return {
      verified: false,
      rejectionReason: "Increases peak cyclomatic complexity.",
    };
  }
  return { verified: true };
}

/**
 * Apply a suggestion in an isolated clone, re-run analysis, and decide whether
 * it is a genuine, evidence-backed improvement. This is the self-verification
 * loop that distinguishes the tool from a plain linter.
 */
export async function verifySuggestion(
  ws: AnalyzableWorkspace,
  baseline: Evidence,
  suggestion: Suggestion
): Promise<VerifiedSuggestion> {
  const targetAbs = resolveTargetFile(ws, suggestion.file);

  const baseUnverified: VerifiedSuggestion = {
    ...suggestion,
    verified: false,
    compileOk: false,
    unifiedDiff: "",
    delta: {
      diagnosticsBefore: baseline.aggregates.diagnosticCount,
      diagnosticsAfter: baseline.aggregates.diagnosticCount,
      maxComplexityBefore: baseline.aggregates.maxCyclomaticComplexity,
      maxComplexityAfter: baseline.aggregates.maxCyclomaticComplexity,
      avgMaintainabilityBefore: baseline.aggregates.avgMaintainabilityIndex,
      avgMaintainabilityAfter: baseline.aggregates.avgMaintainabilityIndex,
    },
  };

  if (!targetAbs) {
    return {
      ...baseUnverified,
      rejectionReason: `Could not match suggested file "${suggestion.file}" to a source file.`,
    };
  }

  const originalContent = await fs.readFile(targetAbs, "utf8").catch(() => "");
  const unifiedDiff = createTwoFilesPatch(
    suggestion.file,
    suggestion.file,
    originalContent,
    suggestion.newContent,
    "original",
    "proposed"
  );

  const clone = await cloneWorkspace(ws);
  try {
    const rel = path.relative(ws.rootDir, targetAbs);
    const clonedTarget = path.join(clone.rootDir, rel);
    await fs.writeFile(clonedTarget, suggestion.newContent, "utf8");

    const { evidence: after, build } = await runDeterministicAnalysis(clone);
    const verdict = computeVerdict(baseline, after, build.buildOk);

    return {
      ...suggestion,
      verified: verdict.verified,
      compileOk: build.buildOk,
      unifiedDiff,
      rejectionReason: verdict.rejectionReason,
      delta: {
        diagnosticsBefore: baseline.aggregates.diagnosticCount,
        diagnosticsAfter: after.aggregates.diagnosticCount,
        maxComplexityBefore: baseline.aggregates.maxCyclomaticComplexity,
        maxComplexityAfter: after.aggregates.maxCyclomaticComplexity,
        avgMaintainabilityBefore: baseline.aggregates.avgMaintainabilityIndex,
        avgMaintainabilityAfter: after.aggregates.avgMaintainabilityIndex,
      },
    };
  } finally {
    await clone.cleanup();
  }
}

/** Verify several suggestions, capped to avoid runaway build costs. */
export async function verifySuggestions(
  ws: AnalyzableWorkspace,
  baseline: Evidence,
  suggestions: Suggestion[]
): Promise<VerifiedSuggestion[]> {
  const capped = suggestions.slice(0, config.maxVerifiedSuggestions);
  const out: VerifiedSuggestion[] = [];
  for (const s of capped) {
    out.push(await verifySuggestion(ws, baseline, s));
  }
  return out;
}
