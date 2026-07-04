import { runDeterministicAnalysis } from "../analysis/aggregate.js";
import { prepareWorkspace, type SourceInput } from "../analysis/workspace.js";
import { renderMetricsOnly } from "../report/markdown.js";
import type { Diagnostic, Evidence, MetricEntry } from "../types.js";

export interface MetricsResult {
  buildOk: boolean;
  aggregates: Evidence["aggregates"];
  metrics: MetricEntry[];
  diagnostics: Diagnostic[];
  notes: string[];
  markdown: string;
}

export async function getMetrics(args: SourceInput): Promise<MetricsResult> {
  const ws = await prepareWorkspace(args);
  try {
    const { evidence } = await runDeterministicAnalysis(ws);
    return {
      buildOk: evidence.buildOk,
      aggregates: evidence.aggregates,
      metrics: evidence.metrics,
      diagnostics: evidence.diagnostics,
      notes: evidence.notes,
      markdown: renderMetricsOnly(evidence),
    };
  } finally {
    await ws.cleanup();
  }
}
