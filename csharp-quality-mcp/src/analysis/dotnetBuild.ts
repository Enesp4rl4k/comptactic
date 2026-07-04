import { promises as fs } from "node:fs";
import path from "node:path";
import { config } from "../config.js";
import { run } from "../util/proc.js";
import type { AnalyzableWorkspace, Diagnostic, DiagnosticSource } from "../types.js";

export interface BuildOutcome {
  buildOk: boolean;
  diagnostics: Diagnostic[];
  rawOutput: string;
  timedOut: boolean;
  /** True if the failure looks like missing tooling / restore failure. */
  toolingError: boolean;
}

function classifySource(ruleId: string): DiagnosticSource {
  if (/^S\d/.test(ruleId)) return "sonar";
  if (ruleId.startsWith("RCS")) return "roslynator";
  if (/^CA15(0[1256])/.test(ruleId)) return "metrics";
  return "dotnet";
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

function uriToPath(uri: string | undefined): string | undefined {
  if (!uri) return undefined;
  try {
    if (uri.startsWith("file:")) return new URL(uri).pathname.replace(/^\/([A-Za-z]:)/, "$1");
    return uri;
  } catch {
    return uri;
  }
}

/** Parse a SARIF v2 log into flat diagnostics. */
export async function parseSarif(sarifPath: string): Promise<Diagnostic[]> {
  let text: string;
  try {
    text = await fs.readFile(sarifPath, "utf8");
  } catch {
    return [];
  }
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
      const uri =
        physical?.artifactLocation?.uri ?? loc0?.resultFile?.uri;
      const region = physical?.region ?? loc0?.resultFile?.region;

      diagnostics.push({
        id: ruleId,
        severity: mapLevel(res.level),
        message,
        file: uriToPath(uri),
        line: region?.startLine,
        column: region?.startColumn,
        source: classifySource(ruleId),
      });
    }
  }
  return dedupe(diagnostics);
}

function dedupe(diags: Diagnostic[]): Diagnostic[] {
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

/**
 * Build the workspace project, emitting analyzer diagnostics to a SARIF file,
 * and parse them. Never throws on analyzer warnings/build errors; only surfaces
 * tooling problems via `toolingError`.
 */
export async function buildAndAnalyze(
  ws: AnalyzableWorkspace
): Promise<BuildOutcome> {
  const sarifPath = path.join(ws.rootDir, "solidguard.sarif");
  const args = [
    "build",
    ws.projectPath,
    "-c",
    "Debug",
    "--nologo",
    "-v",
    "quiet",
    `/p:ErrorLog=${sarifPath},version=2`,
    "/p:TreatWarningsAsErrors=false",
    "/p:RunAnalyzersDuringBuild=true",
    "/p:EnforceCodeStyleInBuild=true",
  ];

  let res;
  try {
    res = await run("dotnet", args, {
      cwd: ws.rootDir,
      timeoutMs: config.dotnetTimeoutMs,
      // Force invariant English so analyzer messages are stable and parseable.
      env: { DOTNET_CLI_UI_LANGUAGE: "en-US" },
    });
  } catch (err) {
    return {
      buildOk: false,
      diagnostics: [],
      rawOutput: String(err),
      timedOut: false,
      toolingError: true,
    };
  }

  const diagnostics = await parseSarif(sarifPath);
  const combined = `${res.stdout}\n${res.stderr}`;
  const toolingError =
    res.code !== 0 &&
    diagnostics.length === 0 &&
    /(NU\d{4}|MSB\d{4}|No such file|not found|Unable to load|restore)/i.test(
      combined
    );

  return {
    buildOk: res.code === 0,
    diagnostics,
    rawOutput: combined,
    timedOut: res.timedOut,
    toolingError,
  };
}
