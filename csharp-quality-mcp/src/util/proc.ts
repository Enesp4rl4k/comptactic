import { spawn } from "node:child_process";

export interface RunResult {
  code: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

export interface RunOptions {
  cwd?: string;
  timeoutMs?: number;
  env?: NodeJS.ProcessEnv;
}

/**
 * Run a command, capturing stdout/stderr. Never rejects on a non-zero exit
 * code; callers inspect `code`. Rejects only on spawn errors (e.g. ENOENT).
 */
export function run(
  command: string,
  args: string[],
  opts: RunOptions = {}
): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: opts.cwd,
      env: { ...process.env, ...opts.env },
      shell: false,
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timer = opts.timeoutMs
      ? setTimeout(() => {
          timedOut = true;
          child.kill("SIGKILL");
        }, opts.timeoutMs)
      : undefined;

    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));

    child.on("error", (err) => {
      if (timer) clearTimeout(timer);
      reject(err);
    });

    child.on("close", (code) => {
      if (timer) clearTimeout(timer);
      resolve({ code, stdout, stderr, timedOut });
    });
  });
}

/** Check whether an executable is resolvable by trying `<cmd> --version`. */
export async function commandExists(command: string): Promise<boolean> {
  try {
    const res = await run(command, ["--version"], { timeoutMs: 15_000 });
    return res.code === 0 || res.stdout.length > 0;
  } catch {
    return false;
  }
}
