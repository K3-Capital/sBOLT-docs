/**
 * Contract test for `.github/workflows/notify-docs-portal.yml`.
 *
 * The workflow that notifies `K3-Capital/docs` is a published interface between this
 * repository and the portal: if the event name, the dispatch endpoint, or the token
 * scoping drifts, the combined site silently stops rebuilding. This test asserts the
 * contract against the real workflow file and runs as the first step of the workflow
 * itself, before any token is minted.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const TARGET_REPOSITORY = "K3-Capital/docs";
const EVENT_TYPE = "docs-source-updated";
const APP_TOKEN_SECRETS = ["DOCS_DISPATCH_APP_ID", "DOCS_DISPATCH_APP_PRIVATE_KEY"];

const workflow = await readFile(
  new URL("../.github/workflows/notify-docs-portal.yml", import.meta.url),
  "utf8",
);

function indentOf(line) {
  return line.match(/^[ \t]*/)[0].length;
}

function isBlank(line) {
  return line.trim() === "";
}

function readIndentedBlock(lines, startIndex, parentIndent) {
  const block = [];
  let index = startIndex;

  while (index < lines.length) {
    const line = lines[index];
    if (isBlank(line)) {
      block.push("");
      index += 1;
      continue;
    }
    if (indentOf(line) <= parentIndent) {
      break;
    }
    block.push(line);
    index += 1;
  }

  return { block, next: index };
}

/** Every step with a `name:` plus its `uses:` or `run:` and `env:` entries. */
function extractSteps(text) {
  const lines = text.split("\n");
  const steps = [];
  let current = null;
  let envIndent = null;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const stepStart = line.match(/^\s*-\s+(?:name|uses):\s*(.*)$/);

    if (stepStart) {
      current = { name: "", uses: null, run: null, env: {} };
      steps.push(current);
      envIndent = null;
      if (/^\s*-\s+name:/.test(line)) {
        current.name = stepStart[1].replace(/^["']|["']$/g, "");
      } else {
        current.uses = stepStart[1].replace(/^["']|["']$/g, "");
      }
      continue;
    }

    if (current === null || isBlank(line)) {
      continue;
    }

    const indent = indentOf(line);

    if (indent <= 2) {
      current = null;
      envIndent = null;
      continue;
    }

    if (envIndent !== null && indent <= envIndent) {
      envIndent = null;
    }

    if (/^\s*env:\s*$/.test(line)) {
      envIndent = indent;
      continue;
    }

    if (envIndent !== null) {
      const entry = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*):\s*(.*?)\s*$/);
      if (entry) {
        current.env[entry[1]] = entry[2];
      }
      continue;
    }

    if (/^\s*uses:\s*\S/.test(line)) {
      current.uses = line.replace(/^\s*uses:\s*/, "").trim();
      continue;
    }

    if (/^\s*run:\s*[|>][-+]?\s*$/.test(line)) {
      const { block, next } = readIndentedBlock(lines, index + 1, indent);
      current.run = block.join("\n");
      index = next - 1;
      continue;
    }

    const inlineRun = line.match(/^\s*run:\s*(\S.*?)\s*$/);
    if (inlineRun) {
      current.run = inlineRun[1].replace(/^["']|["']$/g, "");
    }
  }

  return steps;
}

const steps = extractSteps(workflow);

test("the workflow runs on pushes to main, and can be dispatched manually", () => {
  assert.match(workflow, /^on:\s*$/m);
  assert.match(workflow, /push:\s*\n\s*branches:\s*\n\s*- main\s*$/m);
  assert.match(workflow, /^ {2}workflow_dispatch:\s*$/m);
  assert.doesNotMatch(workflow, /pull_request/, "the notification must not run on pull requests");
});

test("the source repository gets no deployment credentials of any kind", () => {
  assert.match(workflow, /permissions:\s*\n {2}contents: read\s*$/m);
  assert.doesNotMatch(workflow, /pages: write/);
  assert.doesNotMatch(workflow, /id-token: write/);
  assert.doesNotMatch(workflow, /actions: write/);
});

test("concurrent notifications collapse into the newest one", () => {
  assert.match(workflow, /^concurrency:\s*$/m);
  assert.match(workflow, /^ {2}group: notify-docs-portal\s*$/m);
  assert.match(workflow, /^ {2}cancel-in-progress: true\s*$/m);
});

test("the app token is scoped to the portal repository and nothing else", () => {
  const token = steps.find((step) => step.uses?.startsWith("actions/create-github-app-token@"));
  assert.ok(token, "the workflow must mint a GitHub App token");
  assert.match(token.uses, /^actions\/create-github-app-token@v\d+$/);

  for (const secret of APP_TOKEN_SECRETS) {
    assert.match(
      workflow,
      new RegExp(`\\$\\{\\{ secrets\\.${secret} \\}\\}`),
      `the token step must read ${secret}`,
    );
  }

  assert.match(workflow, /owner: K3-Capital\s*$/m);
  assert.match(workflow, /repositories: docs\s*$/m);
  assert.doesNotMatch(
    workflow,
    /permission-[a-z-]+:/,
    "the token must not be widened beyond the app installation's own permissions",
  );
});

test("the dispatch posts the source repository and commit to the portal", () => {
  const dispatch = steps.find((step) => step.run?.includes("/dispatches"));
  assert.ok(dispatch, "no step posts to a repository dispatch endpoint");

  assert.deepEqual(
    Object.keys(dispatch.env).sort(),
    ["EVENT_TYPE", "GH_TOKEN", "SOURCE_REF", "SOURCE_REPOSITORY", "SOURCE_SHA", "TARGET_REPOSITORY"],
  );
  assert.equal(dispatch.env.GH_TOKEN, "${{ steps.app-token.outputs.token }}");
  assert.equal(dispatch.env.SOURCE_REPOSITORY, "${{ github.repository }}");
  assert.equal(dispatch.env.SOURCE_SHA, "${{ github.sha }}");
  assert.equal(dispatch.env.TARGET_REPOSITORY, TARGET_REPOSITORY);
  assert.equal(dispatch.env.EVENT_TYPE, EVENT_TYPE);

  assert.match(dispatch.run, /\/repos\/\$TARGET_REPOSITORY\/dispatches/);
  assert.match(dispatch.run, /--method POST/);
  assert.match(dispatch.run, /gh api/);
  assert.match(dispatch.run, /--input -/);
  assert.match(dispatch.run, /client_payload/);
  assert.match(dispatch.run, /--arg repository "\$SOURCE_REPOSITORY"/);
  assert.match(dispatch.run, /--arg sha "\$SOURCE_SHA"/);
});

test("no run: script interpolates a ${{ }} expression into the shell", () => {
  const offenders = steps
    .filter((step) => step.run !== null && step.run.includes("${{"))
    .map((step) => step.name);
  assert.deepEqual(offenders, [], `these steps interpolate expressions into the shell: ${offenders}`);
});

test("the workflow validates this contract before it mints a token", () => {
  const validate = steps.find((step) => step.run?.includes("test/notify-workflow.test.mjs"));
  assert.ok(validate, "the workflow must run its own contract test");
  assert.ok(
    steps.indexOf(validate) < steps.indexOf(steps.find((step) => step.uses?.startsWith("actions/create-github-app-token@"))),
    "the contract test must run before the token is minted",
  );
});
