import { runDeterministicAnalysis } from "../analysis/aggregate.js";
import { prepareWorkspace, type SourceInput } from "../analysis/workspace.js";
import type { VerifiedSuggestion } from "../types.js";
import { verifySuggestion } from "../verify/sandbox.js";

export interface VerifyPatchArgs extends SourceInput {
  targetFile: string;
  newContent: string;
}

export interface VerifyPatchResult extends VerifiedSuggestion {
  markdown: string;
}

export async function verifyPatch(
  args: VerifyPatchArgs
): Promise<VerifyPatchResult> {
  const ws = await prepareWorkspace(args);
  try {
    const { evidence } = await runDeterministicAnalysis(ws);
    const verified = await verifySuggestion(ws, evidence, {
      file: args.targetFile,
      newContent: args.newContent,
      explanation: "Manual patch submitted via verify_patch.",
      findingIds: [],
    });

    const status = verified.verified
      ? "VERIFIED (compiles, no regressions)"
      : `NOT VERIFIED${verified.rejectionReason ? ` - ${verified.rejectionReason}` : ""}`;
    const cx = (v: number | undefined) =>
      v == null ? "none over threshold" : String(v);
    const markdown = [
      `# verify_patch: ${status}`,
      "",
      `- Compiles: ${verified.compileOk}`,
      `- Diagnostics: ${verified.delta.diagnosticsBefore} -> ${verified.delta.diagnosticsAfter}`,
      `- Max complexity: ${cx(verified.delta.maxComplexityBefore)} -> ${cx(verified.delta.maxComplexityAfter)}`,
      "",
      "```diff",
      verified.unifiedDiff.trimEnd(),
      "```",
      "",
    ].join("\n");

    return { ...verified, markdown };
  } finally {
    await ws.cleanup();
  }
}
