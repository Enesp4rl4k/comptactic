import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { config } from "../config.js";
import type { AnalyzableWorkspace } from "../types.js";

export interface SourceInput {
  code?: string;
  filePath?: string;
  projectPath?: string;
}

const TMP_PREFIX = "solidguard-";

async function makeTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), TMP_PREFIX));
}

/** Build the .editorconfig that turns on code-metric rules at our thresholds. */
function editorConfig(): string {
  const t = config.thresholds;
  return [
    "root = true",
    "",
    "[*.cs]",
    "# Code metric rules are disabled by default; enable them as warnings.",
    "dotnet_diagnostic.CA1502.severity = warning", // cyclomatic complexity
    "dotnet_diagnostic.CA1501.severity = warning", // inheritance depth
    "dotnet_diagnostic.CA1505.severity = warning", // maintainability index
    "dotnet_diagnostic.CA1506.severity = warning", // class coupling
    "",
    `# thresholds: complexity<=${t.cyclomaticComplexity}, coupling<=${t.classCoupling}`,
    "",
  ].join("\n");
}

/** CodeMetricsConfig.txt consumed by the CA15xx metric analyzers. */
function codeMetricsConfig(): string {
  const t = config.thresholds;
  return [
    `CA1502: ${t.cyclomaticComplexity}`,
    `CA1501: ${t.inheritanceDepth}`,
    `CA1505: ${t.maintainabilityIndexMin}`,
    `CA1506: ${t.classCoupling}`,
    "",
  ].join("\n");
}

/** A generated library project that references the analyzer + metric packages. */
function projectFile(): string {
  const v = config.analyzerVersions;
  const analyzerAssets =
    "<IncludeAssets>runtime; build; native; contentfiles; analyzers; buildtransitive</IncludeAssets>" +
    "<PrivateAssets>all</PrivateAssets>";
  return `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>${config.targetFramework}</TargetFramework>
    <OutputType>Library</OutputType>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <LangVersion>latest</LangVersion>
    <EnableNETAnalyzers>true</EnableNETAnalyzers>
    <AnalysisLevel>latest</AnalysisLevel>
    <RunAnalyzersDuringBuild>true</RunAnalyzersDuringBuild>
    <GenerateDocumentationFile>false</GenerateDocumentationFile>
    <NoWarn>CS5001</NoWarn>
    <EnableDefaultCompileItems>true</EnableDefaultCompileItems>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="SonarAnalyzer.CSharp" Version="${v.sonar}">${analyzerAssets}</PackageReference>
    <PackageReference Include="Roslynator.Analyzers" Version="${v.roslynator}">${analyzerAssets}</PackageReference>
  </ItemGroup>
  <ItemGroup>
    <!-- Consumed by the built-in .NET code-metric analyzers (CA1501/02/05/06). -->
    <AdditionalFiles Include="CodeMetricsConfig.txt" />
  </ItemGroup>
</Project>
`;
}

async function writeGeneratedProject(dir: string): Promise<string> {
  const projectPath = path.join(dir, "Analysis.csproj");
  await fs.writeFile(projectPath, projectFile(), "utf8");
  await fs.writeFile(path.join(dir, ".editorconfig"), editorConfig(), "utf8");
  await fs.writeFile(
    path.join(dir, "CodeMetricsConfig.txt"),
    codeMetricsConfig(),
    "utf8"
  );
  return projectPath;
}

/**
 * Normalize any supported input into an on-disk project that dotnet can build
 * and that our analyzers run against.
 */
export async function prepareWorkspace(
  input: SourceInput
): Promise<AnalyzableWorkspace> {
  const provided = [input.code, input.filePath, input.projectPath].filter(
    (x) => x != null && x !== ""
  );
  if (provided.length === 0) {
    throw new Error(
      "Provide one of: code (string), filePath (.cs), or projectPath (.csproj/.sln)."
    );
  }

  // Existing project / solution: analyze in place, do not modify it.
  if (input.projectPath) {
    const projectPath = path.resolve(input.projectPath);
    await fs.access(projectPath);
    const rootDir = path.dirname(projectPath);
    const sourceFiles = await collectCsFiles(rootDir);
    return {
      rootDir,
      projectPath,
      sourceFiles,
      ephemeral: false,
      controlled: false,
      cleanup: async () => {},
    };
  }

  // Snippet or single file: wrap in a generated, fully controlled project.
  const dir = await makeTempDir();
  const projectPath = await writeGeneratedProject(dir);

  let sourceFileName = "Submission.cs";
  let content: string;
  if (input.filePath) {
    const abs = path.resolve(input.filePath);
    content = await fs.readFile(abs, "utf8");
    sourceFileName = path.basename(abs);
  } else {
    content = input.code ?? "";
  }
  const sourcePath = path.join(dir, sourceFileName);
  await fs.writeFile(sourcePath, content, "utf8");

  return {
    rootDir: dir,
    projectPath,
    sourceFiles: [sourcePath],
    ephemeral: true,
    controlled: true,
    cleanup: async () => {
      await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
    },
  };
}

const SKIP_DIRS = new Set(["bin", "obj", ".git", ".vs", "node_modules"]);

/** Recursively collect .cs files, skipping build output directories. */
export async function collectCsFiles(root: string): Promise<string[]> {
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
      } else if (e.isFile() && e.name.endsWith(".cs")) {
        out.push(path.join(dir, e.name));
      }
    }
  }
  await walk(root);
  return out;
}

/**
 * Copy a workspace directory (excluding build output) into a fresh temp dir for
 * sandboxed verification. Returns the new project path mirror.
 */
export async function cloneWorkspace(
  ws: AnalyzableWorkspace
): Promise<AnalyzableWorkspace> {
  const dir = await makeTempDir();
  await copyDir(ws.rootDir, dir);
  const rel = path.relative(ws.rootDir, ws.projectPath);
  const projectPath = path.join(dir, rel);
  const sourceFiles = ws.sourceFiles.map((f) =>
    path.join(dir, path.relative(ws.rootDir, f))
  );
  return {
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

async function copyDir(src: string, dest: string): Promise<void> {
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
