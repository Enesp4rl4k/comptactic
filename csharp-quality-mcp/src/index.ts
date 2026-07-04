#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";

async function main(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stderr is safe to log to; stdout is reserved for the JSON-RPC stream.
  process.stderr.write("[solidguard] MCP server ready on stdio\n");
}

main().catch((err) => {
  process.stderr.write(`[solidguard] fatal: ${String(err)}\n`);
  process.exit(1);
});
