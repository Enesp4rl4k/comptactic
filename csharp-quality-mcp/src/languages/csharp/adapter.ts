import { promises as fs } from "node:fs";
import path from "node:path";
import { config } from "../../config.js";
import { run } from "../../util/proc.js";
import { commandExists } from "../../util/proc.js";
import {
  collectFiles,
  makeTempDir,
} from "../../analysis/fsutil.js";
import { parseSarifFile } from "../../analysis/sarif.js";
import { deriveMetricsFromDiagnostics } from "../../analysis/metrics.js";
import type {
  AnalyzableWorkspace,
  Diagnostic,
  DiagnosticSource,
  SourceInput,
} from "../../types.js";
import type {
  AdapterCapabilities,
  LanguageAdapter,
  NativeAnalysis,
  VerifyResult,
} from "../types.js";

function classifySource(ruleId: string): DiagnosticSource {
  if (/^S\d/.test(ruleId)) return "sonar";
  if (ruleId.startsWith("RCS")) return "roslynator";
  if (/^CA15(0[1256])/.test(ruleId)) return "metrics";
  return "dotnet";
}

function editorConfig(): string {
  const t = config.thresholds;
  return [
    "root = true",
    "",
    "[*.cs]",
    "# Code metric rules are disabled by default; enable them as warnings.",
    "dotnet_diagnostic.CA1502.severity = warning",
    "dotnet_diagnostic.CA1501.severity = warning",
    "dotnet_diagnostic.CA1505.severity = warning",
    "dotnet_diagnostic.CA1506.severity = warning",
    "",
    `# thresholds: complexity<=${t.cyclomaticComplexity}, coupling<=${t.classCoupling}`,
    "",
  ].join("\n");
}

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

interface BuildOutcome {
  buildOk: boolean;
  diagnostics: Diagnostic[];
  rawOutput: string;
  timedOut: boolean;
  toolingError: boolean;
}

async function buildAndAnalyze(ws: AnalyzableWorkspace): Promise<BuildOutcome> {
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

  const diagnostics = await parseSarifFile(sarifPath, { classify: classifySource });
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

export const csharpAdapter: LanguageAdapter = {
  id: "csharp",
  extensions: [".cs"],
  snippetFileName: "Submission.cs",
  analyzeVerifies: true,

  async capabilities(): Promise<AdapterCapabilities> {
    const hasDotnet = await commandExists("dotnet");
    return {
      analyze: hasDotnet,
      verify: hasDotnet,
      missingTools: hasDotnet ? [] : ["dotnet"],
    };
  },

  async prepareWorkspace(input: SourceInput): Promise<AnalyzableWorkspace> {
    if (input.projectPath) {
      const projectPath = path.resolve(input.projectPath);
      await fs.access(projectPath);
      const rootDir = path.dirname(projectPath);
      const sourceFiles = await collectFiles(rootDir, [".cs"]);
      return {
        languageId: "csharp",
        rootDir,
        projectPath,
        sourceFiles,
        ephemeral: false,
        controlled: false,
        cleanup: async () => {},
      };
    }

    const dir = await makeTempDir();
    const projectPath = await writeGeneratedProject(dir);

    let sourceFileName = this.snippetFileName;
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
      languageId: "csharp",
      rootDir: dir,
      projectPath,
      sourceFiles: [sourcePath],
      ephemeral: true,
      controlled: true,
      cleanup: async () => {
        await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
      },
    };
  },

  async analyze(ws: AnalyzableWorkspace): Promise<NativeAnalysis> {
    const notes: string[] = [];
    const build = await buildAndAnalyze(ws);
    if (build.timedOut) notes.push("dotnet build timed out; results may be incomplete.");
    if (build.toolingError) {
      notes.push(
        "dotnet build could not run analyzers (restore/tooling error). " +
          "Ensure the .NET SDK has network access to restore analyzer packages."
      );
    }
    const metrics = deriveMetricsFromDiagnostics(build.diagnostics);
    return {
      diagnostics: build.diagnostics,
      metrics,
      buildOk: build.buildOk,
      notes,
    };
  },

  async verify(ws: AnalyzableWorkspace): Promise<VerifyResult> {
    const build = await buildAndAnalyze(ws);
    return {
      ok: build.buildOk,
      reason: build.buildOk ? undefined : "dotnet build failed.",
    };
  },
};
