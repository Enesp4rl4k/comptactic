import path from "node:path";
import type {
  Evidence,
  Finding,
  MetricEntry,
  VerifiedSuggestion,
} from "../types.js";
import { scoreBadge } from "./score.js";

function shortFile(p?: string): string {
  if (!p) return "";
  return path.basename(p);
}

const SEVERITY_ORDER: Record<Finding["severity"], number> = {
  critical: 0,
  major: 1,
  minor: 2,
  info: 3,
};

function findingsTable(findings: Finding[]): string {
  if (findings.length === 0) return "_No design-level findings._\n";
  const rows = [...findings]
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
    .map((f) => {
      const loc = f.location.startLine
        ? `${shortFile(f.location.file)}:${f.location.startLine}`
        : shortFile(f.location.file);
      return `| ${f.severity} | ${f.principle} | ${escapePipe(f.title)} | ${loc} | ${f.confidence} |`;
    });
  return [
    "| Severity | Principle | Issue | Location | Confidence |",
    "| --- | --- | --- | --- | --- |",
    ...rows,
    "",
  ].join("\n");
}

function escapePipe(s: string): string {
  return s.replace(/\|/g, "\\|");
}

function findingDetails(findings: Finding[]): string {
  if (findings.length === 0) return "";
  const blocks = [...findings]
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
    .map((f) => {
      const ev =
        f.evidence.length > 0
          ? `\n  - Evidence: ${f.evidence.join("; ")}`
          : "";
      return `- **[${f.severity}] ${f.principle}: ${f.title}** (${shortFile(
        f.location.file
      )}${f.location.startLine ? `:${f.location.startLine}` : ""})\n  - ${f.rationale}${ev}`;
    });
  return ["### Details", ...blocks, ""].join("\n");
}

function metricsSection(evidence: Evidence): string {
  const a = evidence.aggregates;
  const lines = [
    "### Metrics",
    `- Build: ${evidence.buildOk ? "succeeded" : "FAILED"}`,
    `- Diagnostics: ${a.diagnosticCount} (errors ${a.errorCount}, warnings ${a.warningCount})`,
    `- Max cyclomatic complexity: ${a.maxCyclomaticComplexity ?? "n/a"}`,
    `- Avg maintainability index: ${a.avgMaintainabilityIndex ?? "n/a"}`,
  ];
  if (a.worstMembers.length > 0) {
    lines.push("- Hotspots:");
    for (const m of a.worstMembers) {
      lines.push(
        `  - ${m.name} (complexity ${m.cyclomaticComplexity ?? "?"}, MI ${m.maintainabilityIndex ?? "?"})`
      );
    }
  }
  lines.push("");
  return lines.join("\n");
}

function suggestionsSection(suggestions: VerifiedSuggestion[]): string {
  if (suggestions.length === 0) return "";
  const blocks = suggestions.map((s) => {
    const status = s.verified
      ? "VERIFIED (compiles, no regressions)"
      : `NOT VERIFIED${s.rejectionReason ? ` - ${s.rejectionReason}` : ""}`;
    const cx = (v?: number) => (v == null ? "none>threshold" : String(v));
    const delta =
      `diagnostics ${s.delta.diagnosticsBefore} -> ${s.delta.diagnosticsAfter}, ` +
      `max complexity ${cx(s.delta.maxComplexityBefore)} -> ${cx(s.delta.maxComplexityAfter)}`;
    return [
      `#### ${shortFile(s.file)} - ${status}`,
      s.explanation,
      `Delta: ${delta}`,
      "",
      "```diff",
      s.unifiedDiff.trimEnd(),
      "```",
      "",
    ].join("\n");
  });
  return ["## Verified refactor suggestions", ...blocks].join("\n");
}

export function renderReview(args: {
  score: number;
  evidence: Evidence;
  findings: Finding[];
  suggestions: VerifiedSuggestion[];
}): string {
  const { score, evidence, findings, suggestions } = args;
  const verifiedCount = suggestions.filter((s) => s.verified).length;

  const out = [
    `# SolidGuard review - score ${score}/100 (${scoreBadge(score)})`,
    "",
    `${findings.length} finding(s), ${verifiedCount}/${suggestions.length} suggestion(s) verified.`,
    "",
    "## Findings",
    findingsTable(findings),
    findingDetails(findings),
    metricsSection(evidence),
    suggestionsSection(suggestions),
  ];

  if (evidence.notes.length > 0) {
    out.push("## Notes", ...evidence.notes.map((n) => `- ${n}`), "");
  }
  return out.join("\n");
}

export function renderMetricsOnly(evidence: Evidence): string {
  const out = [
    "# SolidGuard metrics",
    "",
    metricsSection(evidence),
  ];
  if (evidence.diagnostics.length > 0) {
    out.push("### Diagnostics");
    for (const d of evidence.diagnostics.slice(0, 50)) {
      out.push(
        `- [${d.severity}] ${d.id} ${shortFile(d.file)}${d.line ? `:${d.line}` : ""} - ${d.message}`
      );
    }
    out.push("");
  }
  if (evidence.notes.length > 0) {
    out.push("## Notes", ...evidence.notes.map((n) => `- ${n}`), "");
  }
  return out.join("\n");
}

export function topMetricRows(metrics: MetricEntry[]): MetricEntry[] {
  return metrics.filter((m) => m.scope === "member").slice(0, 20);
}
