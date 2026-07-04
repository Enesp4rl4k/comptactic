import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { reviewCsharp } from "./tools/reviewCsharp.js";
import { getMetrics } from "./tools/getMetrics.js";
import { verifyPatch } from "./tools/verifyPatch.js";

const inputSourceShape = {
  code: z
    .string()
    .optional()
    .describe("Raw C# source code to review. Use for snippets/single files."),
  filePath: z
    .string()
    .optional()
    .describe("Absolute path to a single .cs file to review."),
  projectPath: z
    .string()
    .optional()
    .describe("Absolute path to a .csproj or .sln to review in place."),
};

function textResult(markdown: string, json: unknown) {
  return {
    content: [
      { type: "text" as const, text: markdown },
      {
        type: "text" as const,
        text: "```json\n" + JSON.stringify(json, null, 2) + "\n```",
      },
    ],
  };
}

function errorResult(message: string) {
  return {
    isError: true,
    content: [{ type: "text" as const, text: message }],
  };
}

export function createServer(): McpServer {
  const server = new McpServer({
    name: "solidguard",
    version: "0.1.0",
  });

  server.registerTool(
    "review_csharp",
    {
      title: "Review C# code (SOLID & quality)",
      description:
        "Reviews C#/.NET code for SOLID and design-quality issues. Runs deterministic " +
        "Roslyn analysis (diagnostics + metrics), reasons about design with an LLM, and " +
        "returns sandbox-verified refactor suggestions. Provide exactly one of code, " +
        "filePath, or projectPath. Ideal to call right after generating/editing C# code.",
      inputSchema: {
        ...inputSourceShape,
        focus: z
          .array(z.enum(["solid", "security", "perf", "readability"]))
          .optional()
          .describe("Optional focus areas. Defaults to all."),
        includeSuggestions: z
          .boolean()
          .optional()
          .describe("If true (default), include verified refactor diffs."),
      },
    },
    async (args) => {
      try {
        const result = await reviewCsharp(args);
        return textResult(result.markdown, result);
      } catch (err) {
        return errorResult(`review_csharp failed: ${String(err)}`);
      }
    }
  );

  server.registerTool(
    "get_metrics",
    {
      title: "Get C# code metrics (fast, no LLM)",
      description:
        "Returns deterministic Roslyn metrics and analyzer diagnostics only (cyclomatic " +
        "complexity, maintainability index, coupling, analyzer warnings). No LLM cost. " +
        "Provide exactly one of code, filePath, or projectPath.",
      inputSchema: { ...inputSourceShape },
    },
    async (args) => {
      try {
        const result = await getMetrics(args);
        return textResult(result.markdown, result);
      } catch (err) {
        return errorResult(`get_metrics failed: ${String(err)}`);
      }
    }
  );

  server.registerTool(
    "verify_patch",
    {
      title: "Verify a proposed C# patch",
      description:
        "Applies a proposed full-file replacement in a sandbox, recompiles, and reports " +
        "whether it builds and how metrics/diagnostics changed versus the original. " +
        "Use to validate a refactor before applying it.",
      inputSchema: {
        ...inputSourceShape,
        targetFile: z
          .string()
          .describe(
            "The file (within the project) whose content is being replaced. " +
              "For code/filePath inputs this is the single source file."
          ),
        newContent: z
          .string()
          .describe("The proposed full new content for targetFile."),
      },
    },
    async (args) => {
      try {
        const result = await verifyPatch(args);
        return textResult(result.markdown, result);
      } catch (err) {
        return errorResult(`verify_patch failed: ${String(err)}`);
      }
    }
  );

  return server;
}
