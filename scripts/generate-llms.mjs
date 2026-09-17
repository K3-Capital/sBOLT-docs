import { readFile, writeFile } from "node:fs/promises";
import { join, posix } from "node:path";
import { llmsFromPages, validateLlmsTxt } from "@lacspace/llms-txt";

const outputDirectory = process.argv[2] ?? "_book";
const baseUrl = "https://k3-capital.github.io/sBOLT-docs/";
const summaryPath = "SUMMARY.md";

/** Parse SUMMARY.md into an ordered list of pages, each grouped under its top-level section. */
function parseSummary(summary) {
  const pages = [];
  let currentSection = null;

  for (const line of summary.split("\n")) {
    const match = line.match(/^(\s*)-?\s+\[([^\]]+)\]\(([^)]+\.md)\)\s*$/);
    if (!match) continue;

    const [, indent, title, source] = match;
    const isTopLevel = indent.length === 0;

    if (isTopLevel) {
      currentSection = title;
      pages.push({ title, source, section: title });
    } else {
      pages.push({ title, source, section: currentSection ?? "Docs" });
    }
  }

  return pages;
}

/** Relative page URL within the site (README.md -> index.html, others -> <path>.html). */
function pageUrl(source) {
  if (source === "README.md") return baseUrl;
  return `${baseUrl}${source.replace(/\.md$/, ".html")}`;
}

/** Canonicalize the full markdown path referenced by a relative link from `source`. */
function linkSourcePath(rawLinkPath, source) {
  const sourceDir = posix.dirname(source);
  if (posix.isAbsolute(rawLinkPath)) return posix.normalize(rawLinkPath).replace(/^\//, "");
  return posix.normalize(posix.join(sourceDir, rawLinkPath));
}

/**
 * Resolve one link target to an absolute published URL.
 *
 * Internal relative `.md` links (e.g. `for-investors.md`, `../integration/quickstart.md`)
 * are resolved against the source page's directory, mapped to their published `.html`
 * page, and made absolute so they survive the pages being combined at the site root in
 * `llms-full.txt`. Fragments, external links, root-absolute non-doc paths, and anything
 * that is not a doc page are left untouched.
 *
 * Returns the rewritten target, or `null` when the target needs no change.
 */
function resolveLinkTarget(target, source) {
  let path = target;
  let fragment = "";

  const hashIndex = target.search(/#/);
  if (hashIndex !== -1) {
    path = target.slice(0, hashIndex);
    fragment = target.slice(hashIndex);
  }

  // External schemes, pure anchors, and empty targets: never rewrite.
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(path)) return null;
  if (path === "" || path.startsWith("#")) return null;

  // Only rewrite targets that point at a markdown doc page.
  if (!path.endsWith(".md")) return null;

  const canonical = linkSourcePath(path, source);
  if (canonical === "." || canonical === ".." || canonical.includes("..")) return null;

  const resolved = pageUrl(canonical);
  return `${resolved}${fragment}`;
}

const inlineLinkPattern = /\[([^\]\n]*)\]\(([^()\n]+)\)/g;

/** Track code-fence state while rewriting inline links, so fences never get touched. */
function rewriteInternalLinks(content, source) {
  const isFence = /^\s*(```|~~~)/;
  const lines = content.split("\n");
  let inFence = false;

  for (let i = 0; i < lines.length; i++) {
    if (isFence.test(lines[i])) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    lines[i] = lines[i].replace(inlineLinkPattern, (match, text, rawTarget) => {
      // Preserve an optional quoted `"title"` suffix.
      const titleMatch = rawTarget.match(/^(\S+)(\s+".+")?$/);
      const target = titleMatch ? titleMatch[1] : rawTarget;
      const title = titleMatch && titleMatch[2] ? titleMatch[2] : "";

      const rewritten = resolveLinkTarget(target, source);
      if (rewritten === null) return match;
      return `[${text}](${rewritten}${title})`;
    });
  }

  return lines.join("\n");
}

/**
 * Deterministic generated-output gate: after rewriting, `llms-full.txt` must contain
 * NO unresolved internal `.md` links. An internal link is one that still has a relative
 * or root-relative markdown target (no scheme) — the exact 404 class the rewrite exists
 * to eliminate. Any such leftover fails the build.
 */
function assertNoUnresolvedInternalMdLinks(full) {
  const leftover = [];
  const linkPattern = /\[([^\]\n]*)\]\(([^()\n]+)\)/g;
  let match;
  while ((match = linkPattern.exec(full)) !== null) {
    const rawPath = match[2].replace(/\s+".*"?$/, "");
    // Strip any trailing fragment so ".md#fragment" targets are caught too.
    const path = rawPath.split("#")[0];
    if (path.startsWith("#")) continue;
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(path)) continue; // external link: fine
    if (path.endsWith(".md")) {
      leftover.push({ text: match[1], target: match[2] });
    }
  }

  if (leftover.length > 0) {
    const samples = leftover
      .slice(0, 10)
      .map((l) => `  [${l.text}](${l.target})`)
      .join("\n");
    throw new Error(
      `llms-full.txt still contains ${leftover.length} unresolved internal .md link(s):\n${samples}`,
    );
  }

  return leftover.length;
}

/**
 * Deterministic navigation coverage: the generated artifacts must stay reachable from
 * the published table of contents. `SUMMARY.md` carries one absolute link per artifact
 * (HonKit renders absolute links as sidebar entries from every page depth, while a bare
 * non-page relative target is silently dropped), so removing either link hides the
 * LLM-facing files from the docs navigation. Fail the build instead.
 */
function assertLlmsArtifactsLinked(summary) {
  const artifacts = ["llms.txt", "llms-full.txt"];
  const missing = artifacts.filter((file) => !summary.includes(`(${baseUrl}${file})`));

  if (missing.length > 0) {
    throw new Error(
      `SUMMARY.md does not link the generated ${missing.join(
        ", ",
      )} artifact(s); add "- [<file>](${baseUrl}<file>)" so they stay in the site navigation.`,
    );
  }

  return artifacts.length;
}

const summary = await readFile(summaryPath, "utf8");
const pages = parseSummary(summary);

const llmsPages = [];
for (const page of pages) {
  const raw = await readFile(page.source, "utf8");
  const content = rewriteInternalLinks(raw, page.source);
  llmsPages.push({
    title: page.title,
    url: pageUrl(page.source),
    content,
    section: page.section,
  });
}

const { txt, full } = llmsFromPages(llmsPages, {
  title: "sBOLD",
  summary:
    "Documentation for sBOLD, K3 Capital's yield-bearing ERC-4626 token that routes BOLD deposits into a weighted basket of Liquity v2 Stability Pools: protocol design, vault mechanics, exchanges and swaps, the price oracle stack, and audit reports.",
  details:
    "sBOLD is a standard-conforming ERC-4626 vault whose shares represent a pro-rata claim on BOLD deposited into Liquity v2 Stability Pools. These docs describe the protocol's background (Liquity v2 design), its yield sources and rebalancing mechanics, the Technical Details of the vault accounting and exchange rate, the deposit/withdraw/swap/rebalance interactions, the oracle adapters used for pricing, and the published audit reports.",
  defaultSection: "Docs",
});

// Deterministic generated-output coverage: the compact index must validate, and the
// full artifact must contain zero unresolved internal .md links.
const validation = validateLlmsTxt(txt);
if (!validation.valid) {
  throw new Error(`llms.txt failed validation: ${JSON.stringify(validation)}`);
}
assertNoUnresolvedInternalMdLinks(full);
assertLlmsArtifactsLinked(summary);

const llmsTxtPath = join(outputDirectory, "llms.txt");
const llmsFullPath = join(outputDirectory, "llms-full.txt");
await writeFile(llmsTxtPath, txt);
await writeFile(llmsFullPath, full);

console.log(
  `Generated ${llmsPages.length} page entries: ${llmsTxtPath} and ${llmsFullPath}.`,
);
console.log(`Internal .md links rewritten to absolute .html URLs; 0 unresolved remain.`);
console.log(
  `SUMMARY.md links both generated artifacts (llms.txt, llms-full.txt); sidebar coverage verified.`,
);