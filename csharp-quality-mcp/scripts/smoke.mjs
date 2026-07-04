// Minimal smoke test: spin up the built server over stdio and list tools.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const serverEntry = path.join(here, "..", "dist", "index.js");

const transport = new StdioClientTransport({
  command: process.execPath,
  args: [serverEntry],
});

const client = new Client({ name: "smoke", version: "0.0.0" });
await client.connect(transport);

const tools = await client.listTools();
console.log("Tools:");
for (const t of tools.tools) {
  console.log(`- ${t.name}: ${t.title ?? ""}`);
}

await client.close();
console.log("OK: server initialized and tools listed.");
