import { test } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { parseSarif } from "../dist/analysis/dotnetBuild.js";
import { deriveMetricsFromDiagnostics } from "../dist/analysis/metrics.js";
import { computeScore, scoreBadge } from "../dist/report/score.js";

async function writeTemp(name, content) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "sg-test-"));
  const p = path.join(dir, name);
  await fs.writeFile(p, content, "utf8");
  return p;
}

test("parseSarif handles SARIF v1 (resultFile + string message)", async () => {
  const sarif = {
    version: "1.0.0",
    runs: [
      {
        results: [
          {
            ruleId: "CA1502",
            level: "warning",
            message: "'M' has a cyclomatic complexity of '14'.",
            locations: [
              {
                resultFile: {
                  uri: "file:///C:/proj/A.cs",
                  region: { startLine: 14, startColumn: 5 },
                },
              },
            ],
          },
        ],
      },
    ],
  };
  const p = await writeTemp("v1.sarif", JSON.stringify(sarif));
  const diags = await parseSarif(p);
  assert.equal(diags.length, 1);
  assert.equal(diags[0].id, "CA1502");
  assert.equal(diags[0].line, 14);
  assert.match(diags[0].file ?? "", /A\.cs$/);
  assert.equal(diags[0].source, "metrics");
});

test("parseSarif handles SARIF v2 (physicalLocation + message.text)", async () => {
  const sarif = {
    version: "2.1.0",
    runs: [
      {
        results: [
          {
            ruleId: "S1104",
            level: "warning",
            message: { text: "Encapsulate the field." },
            locations: [
              {
                physicalLocation: {
                  artifactLocation: { uri: "file:///C:/proj/B.cs" },
                  region: { startLine: 3 },
                },
              },
            ],
          },
        ],
      },
    ],
  };
  const p = await writeTemp("v2.sarif", JSON.stringify(sarif));
  const diags = await parseSarif(p);
  assert.equal(diags.length, 1);
  assert.equal(diags[0].source, "sonar");
  assert.equal(diags[0].line, 3);
});

test("deriveMetricsFromDiagnostics extracts member metrics", () => {
  const diags = [
    {
      id: "CA1502",
      severity: "warning",
      message: "'ProcessOrder' has a cyclomatic complexity of '14'.",
      file: "A.cs",
      line: 14,
      source: "metrics",
    },
    {
      id: "CA1506",
      severity: "warning",
      message: "'ProcessOrder' is coupled with '37' different types.",
      file: "A.cs",
      line: 14,
      source: "metrics",
    },
  ];
  const metrics = deriveMetricsFromDiagnostics(diags);
  assert.equal(metrics.length, 1);
  assert.equal(metrics[0].name, "ProcessOrder");
  assert.equal(metrics[0].cyclomaticComplexity, 14);
  assert.equal(metrics[0].classCoupling, 37);
});

test("computeScore penalizes errors, complexity, and findings", () => {
  const clean = {
    diagnostics: [],
    metrics: [],
    buildOk: true,
    notes: [],
    aggregates: {
      diagnosticCount: 0,
      errorCount: 0,
      warningCount: 0,
      worstMembers: [],
    },
  };
  const cleanScore = computeScore(clean, []);
  assert.equal(cleanScore, 100);

  const messy = {
    ...clean,
    buildOk: false,
    aggregates: {
      diagnosticCount: 5,
      errorCount: 2,
      warningCount: 3,
      maxCyclomaticComplexity: 30,
      worstMembers: [],
    },
  };
  const messyScore = computeScore(messy, [
    {
      id: "F1",
      principle: "SRP",
      severity: "critical",
      title: "x",
      rationale: "y",
      location: { file: "A.cs" },
      evidence: [],
      confidence: "high",
    },
  ]);
  assert.ok(messyScore < cleanScore);
  assert.ok(messyScore >= 0);
});

test("scoreBadge thresholds", () => {
  assert.match(scoreBadge(90), /A/);
  assert.match(scoreBadge(30), /F/);
});
