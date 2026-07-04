import type { Diagnostic, MetricEntry } from "../types.js";

/**
 * The Microsoft.CodeAnalysis.Metrics MSBuild target is broken on the .NET 9 SDK
 * (it reports an empty assembly). Instead we derive per-member metrics from the
 * built-in code-metric analyzer diagnostics (CA1501/1502/1505/1506), which are
 * accurate and locale-stable once we force English output.
 *
 * Messages (en-US):
 *  CA1502: '<member>' has a cyclomatic complexity of '<n>'. ...
 *  CA1505: '<member>' has a maintainability index of '<n>'. ...
 *  CA1506: '<member>' is coupled with '<n>' different types ...
 *  CA1501: '<member>' has an inheritance depth of '<n>'. ...
 */

function firstQuoted(message: string): string | undefined {
  const m = message.match(/'([^']+)'/);
  return m?.[1];
}

function complexityOf(message: string): number | undefined {
  const m = message.match(/cyclomatic complexity of '(\d+)'/i);
  return m ? Number(m[1]) : undefined;
}
function maintainabilityOf(message: string): number | undefined {
  const m = message.match(/maintainability index of '(\d+)'/i);
  return m ? Number(m[1]) : undefined;
}
function couplingOf(message: string): number | undefined {
  const m = message.match(/coupled with '(\d+)'/i);
  return m ? Number(m[1]) : undefined;
}
function inheritanceOf(message: string): number | undefined {
  const m = message.match(/inheritance depth of '(\d+)'/i);
  return m ? Number(m[1]) : undefined;
}

export function deriveMetricsFromDiagnostics(
  diagnostics: Diagnostic[]
): MetricEntry[] {
  const byKey = new Map<string, MetricEntry>();

  const upsert = (
    name: string,
    file: string | undefined,
    line: number | undefined,
    patch: Partial<MetricEntry>
  ): void => {
    const key = `${name}|${file ?? ""}`;
    const existing = byKey.get(key);
    if (existing) {
      Object.assign(existing, patch);
      if (line && !existing.line) existing.line = line;
    } else {
      byKey.set(key, {
        scope: "member",
        name,
        file,
        line,
        ...patch,
      });
    }
  };

  for (const d of diagnostics) {
    const name = firstQuoted(d.message);
    if (!name) continue;
    switch (d.id) {
      case "CA1502": {
        const v = complexityOf(d.message);
        if (v != null) upsert(name, d.file, d.line, { cyclomaticComplexity: v });
        break;
      }
      case "CA1505": {
        const v = maintainabilityOf(d.message);
        if (v != null) upsert(name, d.file, d.line, { maintainabilityIndex: v });
        break;
      }
      case "CA1506": {
        const v = couplingOf(d.message);
        if (v != null) upsert(name, d.file, d.line, { classCoupling: v });
        break;
      }
      case "CA1501": {
        const v = inheritanceOf(d.message);
        if (v != null) upsert(name, d.file, d.line, { depthOfInheritance: v });
        break;
      }
    }
  }

  return [...byKey.values()];
}
