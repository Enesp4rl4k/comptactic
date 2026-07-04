// Exercise the deterministic pipeline end-to-end against a fixture file.
import { getMetrics } from "../dist/tools/getMetrics.js";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = path.join(here, "..", "test", "fixtures", "BadOrderService.cs");

console.error("Running get_metrics on", fixture, "(first run restores NuGet analyzers)...");
const res = await getMetrics({ filePath: fixture });
console.log(res.markdown);
console.error("\n--- raw aggregates ---");
console.error(JSON.stringify(res.aggregates, null, 2));
console.error("diagnostics:", res.diagnostics.length, "metrics:", res.metrics.length);
