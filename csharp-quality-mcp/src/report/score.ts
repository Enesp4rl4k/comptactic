import { config } from "../config.js";
import type { Evidence, Finding } from "../types.js";

const SEVERITY_PENALTY: Record<Finding["severity"], number> = {
  critical: 18,
  major: 9,
  minor: 3,
  info: 1,
};

/**
 * Produce a 0-100 quality score. Deterministic signals and reasoned findings
 * both contribute; the score is intentionally conservative and explainable.
 */
export function computeScore(evidence: Evidence, findings: Finding[]): number {
  let score = 100;

  if (!evidence.buildOk) score -= 15;

  score -= Math.min(20, evidence.aggregates.errorCount * 5);
  score -= Math.min(15, evidence.aggregates.warningCount * 1.5);

  const maxC = evidence.aggregates.maxCyclomaticComplexity ?? 0;
  if (maxC > config.thresholds.cyclomaticComplexity) {
    score -= Math.min(15, (maxC - config.thresholds.cyclomaticComplexity) * 1.5);
  }

  const mi = evidence.aggregates.avgMaintainabilityIndex;
  if (typeof mi === "number" && mi < config.thresholds.maintainabilityIndexMin) {
    score -= Math.min(15, config.thresholds.maintainabilityIndexMin - mi);
  }

  for (const f of findings) {
    const weight = f.confidence === "low" ? 0.5 : f.confidence === "medium" ? 0.8 : 1;
    score -= SEVERITY_PENALTY[f.severity] * weight;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function scoreBadge(score: number): string {
  if (score >= 85) return "A (strong)";
  if (score >= 70) return "B (good)";
  if (score >= 55) return "C (needs work)";
  if (score >= 40) return "D (poor)";
  return "F (critical)";
}
