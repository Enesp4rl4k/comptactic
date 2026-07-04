import { promises as fs } from "node:fs";
import type { Diagnostic, DiagnosticSource } from "../types.js";

export interface SarifParseOptions {
  /** Fallback source for every diagnostic (e.g. "eslint", "ruff"). */
  defaultSource?: DiagnosticSource;
  /** Per-rule classifier; takes precedence over defaultSource when it returns a value. */
  classify?: (ruleId: string) => DiagnosticSource | undefined;
}

function mapLevel(level: string | undefined): Diagnostic["severity"] {
  switch (level) {
    case "error":
      return "error";
    case "warning":
      return "warning";
    case "note":
      return "info";
    default:
      return "info";
  }
}

export function uriToPath(uri: string | undefined): string | undefined {
  if (!uri) return undefined;
  try {
    if (uri.startsWith("file:")) {
      return new URL(uri).pathname.replace(/^\/([A-Za-z]:)/, "$1");
    }
    return uri;
  } catch {
    return uri;
  }
}

/**
 * Parse a SARIF v1 or v2 log into flat, normalized diagnostics. This is the
 * universal normalization point: every language toolchain that emits SARIF
 * (dotnet, ESLint, Ruff, golangci-lint, Clippy, Semgrep, ...) funnels here.
 */
export function parseSarifText(
  text: string,
  opts: SarifParseOptions = {}
): Diagnostic[] {
  if (!text.trim()) return [];
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    return [];
  }

  const diagnostics: Diagnostic[] = [];
  const runs: any[] = Array.isArray(json.runs) ? json.runs : [];
  for (const r of runs) {
    const results: any[] = Array.isArray(r.results) ? r.results : [];
    for (const res of results) {
      const ruleId: string = res.ruleId ?? res.rule?.id ?? "UNKNOWN";

      // SARIF v2: message.text ; SARIF v1: message is a plain string.
      const message =
        typeof res.message === "string"
          ? res.message
          : typeof res.message?.text === "string"
            ? res.message.text
            : JSON.stringify(res.message ?? {});

      // SARIF v2: locations[].physicalLocation.{artifactLocation.uri, region}
      // SARIF v1: locations[].resultFile.{uri, region}
      const loc0 = res.locations?.[0];
      const physical = loc0?.physicalLocation;
      const uri = physical?.artifactLocation?.uri ?? loc0?.resultFile?.uri;
      const region = physical?.region ?? loc0?.resultFile?.region;

      const source: DiagnosticSource =
        opts.classify?.(ruleId) ?? opts.defaultSource ?? "generic";

      diagnostics.push({
        id: ruleId,
        severity: mapLevel(res.level),
        message,
        file: uriToPath(uri),
        line: region?.startLine,
        column: region?.startColumn,
        source,
      });
    }
  }
  return dedupeDiagnostics(diagnostics);
}

export async function parseSarifFile(
  sarifPath: string,
  opts: SarifParseOptions = {}
): Promise<Diagnostic[]> {
  let text: string;
  try {
    text = await fs.readFile(sarifPath, "utf8");
  } catch {
    return [];
  }
  return parseSarifText(text, opts);
}

export function dedupeDiagnostics(diags: Diagnostic[]): Diagnostic[] {
  const seen = new Set<string>();
  const out: Diagnostic[] = [];
  for (const d of diags) {
    const key = `${d.id}|${d.file ?? ""}|${d.line ?? ""}|${d.message}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(d);
    }
  }
  return out;
}
