import { promises as fs } from "node:fs";
import type { AnalyzableWorkspace } from "../types.js";

/** Read up to `limit` source files for LLM context. */
export async function readSources(
  ws: AnalyzableWorkspace,
  limit = 12
): Promise<Array<{ path: string; content: string }>> {
  const files = ws.sourceFiles.slice(0, limit);
  const out: Array<{ path: string; content: string }> = [];
  for (const f of files) {
    try {
      out.push({ path: f, content: await fs.readFile(f, "utf8") });
    } catch {
      // skip unreadable files
    }
  }
  return out;
}
