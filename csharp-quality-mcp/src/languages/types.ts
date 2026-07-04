import type {
  AnalyzableWorkspace,
  Diagnostic,
  LanguageId,
  MetricEntry,
  SourceInput,
} from "../types.js";

/** What an adapter's native toolchain can do in the current environment. */
export interface AdapterCapabilities {
  /** Native linter/analyzer available (otherwise only universal layers run). */
  analyze: boolean;
  /** Native compiler/checker available for verification. */
  verify: boolean;
  /** Tools the adapter looked for but did not find. */
  missingTools: string[];
}

/** The native (language-specific) analysis result, before universal layers. */
export interface NativeAnalysis {
  diagnostics: Diagnostic[];
  /** Language-authoritative metrics (e.g. C# CA metrics). Empty = use tree-sitter. */
  metrics: MetricEntry[];
  /** Whether the project builds/compiles (best-effort). */
  buildOk: boolean;
  notes: string[];
}

export interface VerifyResult {
  ok: boolean;
  reason?: string;
}

/**
 * A language plug-in. Each adapter knows how to turn input into an on-disk
 * workspace, run its native analyzer, and verify that proposed code still
 * compiles. Universal layers (Semgrep, tree-sitter) are added by the
 * orchestrator, so adapters only own language-specific behavior.
 */
export interface LanguageAdapter {
  id: LanguageId;
  /** File extensions (incl. dot) this adapter owns. */
  extensions: string[];
  /** Default file name for raw-code snippets. */
  snippetFileName: string;
  /** When true, analyze() already compiles, so the sandbox can skip verify(). */
  analyzeVerifies?: boolean;
  capabilities(): Promise<AdapterCapabilities>;
  prepareWorkspace(input: SourceInput): Promise<AnalyzableWorkspace>;
  analyze(ws: AnalyzableWorkspace): Promise<NativeAnalysis>;
  verify(ws: AnalyzableWorkspace): Promise<VerifyResult>;
}
