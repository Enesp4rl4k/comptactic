import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AnalyzableWorkspace } from "../types.js";

const TMP_PREFIX = "solidguard-";

export const SKIP_DIRS = new Set([
  "bin",
  "obj",
  ".git",
  ".vs",
  "node_modules",
  "target",
  "dist",
  "build",
  "__pycache__",
  ".venv",
  "venv",
  ".mypy_cache",
  ".ruff_cache",
]);

export async function makeTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), TMP_PREFIX));
}

export async function copyDir(src: string, dest: string): Promise<void> {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const e of entries) {
    if (e.isDirectory() && SKIP_DIRS.has(e.name)) continue;
    const s = path.join(src, e.name);
    const d = path.join(dest, e.name);
    if (e.isDirectory()) {
      await copyDir(s, d);
    } else if (e.isFile()) {
      await fs.copyFile(s, d);
    }
  }
}

/** Recursively collect files with one of the given extensions (incl. dot). */
export async function collectFiles(
  root: string,
  extensions: string[]
): Promise<string[]> {
  const exts = new Set(extensions.map((e) => e.toLowerCase()));
  const out: string[] = [];
  async function walk(dir: string): Promise<void> {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.isDirectory()) {
        if (!SKIP_DIRS.has(e.name)) await walk(path.join(dir, e.name));
      } else if (e.isFile() && exts.has(path.extname(e.name).toLowerCase())) {
        out.push(path.join(dir, e.name));
      }
    }
  }
  await walk(root);
  return out;
}

/**
 * Copy a workspace directory (excluding build output) into a fresh temp dir for
 * sandboxed verification. Language-agnostic: mirrors paths and preserves
 * languageId so the same adapter can re-analyze the clone.
 */
export async function cloneWorkspace(
  ws: AnalyzableWorkspace
): Promise<AnalyzableWorkspace> {
  const dir = await makeTempDir();
  await copyDir(ws.rootDir, dir);
  const projectPath =
    ws.projectPath === ws.rootDir
      ? dir
      : path.join(dir, path.relative(ws.rootDir, ws.projectPath));
  const sourceFiles = ws.sourceFiles.map((f) =>
    path.join(dir, path.relative(ws.rootDir, f))
  );
  return {
    languageId: ws.languageId,
    rootDir: dir,
    projectPath,
    sourceFiles,
    ephemeral: true,
    controlled: ws.controlled,
    cleanup: async () => {
      await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
    },
  };
}

/**
 * Create a fully controlled temp workspace containing the given files. Used by
 * adapters that don't need a generated project descriptor (most non-C# langs).
 */
export async function makeControlledWorkspace(
  languageId: AnalyzableWorkspace["languageId"],
  files: { name: string; content: string }[]
): Promise<AnalyzableWorkspace> {
  const dir = await makeTempDir();
  const sourceFiles: string[] = [];
  for (const f of files) {
    const abs = path.join(dir, f.name);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, f.content, "utf8");
    sourceFiles.push(abs);
  }
  return {
    languageId,
    rootDir: dir,
    projectPath: dir,
    sourceFiles,
    ephemeral: true,
    controlled: true,
    cleanup: async () => {
      await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
    },
  };
}
