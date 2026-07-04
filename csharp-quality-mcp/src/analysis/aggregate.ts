import type {
  AnalyzableWorkspace,
  Diagnostic,
  Evidence,
  MetricEntry,
} from "../types.js";
import { buildAndAnalyze, type BuildOutcome } from "./dotnetBuild.js";
import { deriveMetricsFromDiagnostics } from "./metrics.js";

export interface DeterministicResult {
  evidence: Evidence;
  build: BuildOutcome;
}

export function aggregate(
  diagnostics: Diagnostic[],
  metrics: MetricEntry[],
  buildOk: boolean,
  notes: string[]
): Evidence {
  const members = metrics.filter((m) => m.scope === "member");

  const complexities = members
    .map((m) => m.cyclomaticComplexity)
    .filter((n): n is number => typeof n === "number");
  const maintainabilities = members
    .map((m) => m.maintainabilityIndex)
    .filter((n): n is number => typeof n === "number");

  const worstMembers = [...members]
    .sort(
      (a, b) =>
        (b.cyclomaticComplexity ?? 0) - (a.cyclomaticComplexity ?? 0) ||
        (a.maintainabilityIndex ?? 100) - (b.maintainabilityIndex ?? 100)
    )
    .slice(0, 5)
    .map((m) => ({
      name: m.name,
      file: m.file,
      cyclomaticComplexity: m.cyclomaticComplexity,
      maintainabilityIndex: m.maintainabilityIndex,
    }));

  return {
    diagnostics,
    metrics,
    buildOk,
    notes,
    aggregates: {
      diagnosticCount: diagnostics.length,
      errorCount: diagnostics.filter((d) => d.severity === "error").length,
      warningCount: diagnostics.filter((d) => d.severity === "warning").length,
      maxCyclomaticComplexity: complexities.length
        ? Math.max(...complexities)
        : undefined,
      avgMaintainabilityIndex: maintainabilities.length
        ? Math.round(
            maintainabilities.reduce((a, b) => a + b, 0) /
              maintainabilities.length
          )
        : undefined,
      worstMembers,
    },
  };
}

/** Run the full deterministic layer: build (diagnostics) + metrics. */
export async function runDeterministicAnalysis(
  ws: AnalyzableWorkspace
): Promise<DeterministicResult> {
  const notes: string[] = [];
  const build = await buildAndAnalyze(ws);

  if (build.timedOut) notes.push("Build timed out; results may be incomplete.");
  if (build.toolingError) {
    notes.push(
      "dotnet build could not run analyzers (restore/tooling error). " +
        "Ensure the .NET SDK has network access to restore analyzer packages."
    );
  }

  const metrics = deriveMetricsFromDiagnostics(build.diagnostics);

  const evidence = aggregate(build.diagnostics, metrics, build.buildOk, notes);
  return { evidence, build };
}
