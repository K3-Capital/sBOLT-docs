import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const outputDirectory = process.argv[2] ?? "_book";
const siteTitle = "sBOLD";
const titlePattern = /<title>([^<]*)<\/title>/;
const honkitSuffixPattern = /\s+(?:·|-)\s+HonKit$/;

async function findHtmlFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory()
        ? findHtmlFiles(path)
        : Promise.resolve(entry.name.endsWith(".html") ? [path] : []);
    }),
  );

  return files.flat();
}

const htmlFiles = await findHtmlFiles(outputDirectory);

if (htmlFiles.length === 0) {
  throw new Error(`No HTML files found in ${outputDirectory}`);
}

for (const file of htmlFiles) {
  const html = await readFile(file, "utf8");
  const match = html.match(titlePattern);

  if (!match) {
    throw new Error(`Missing <title> in ${file}`);
  }

  const currentTitle = match[1];
  const pageTitle = currentTitle.startsWith(`${siteTitle} - `)
    ? currentTitle.slice(siteTitle.length + 3)
    : currentTitle.replace(honkitSuffixPattern, "");

  if (pageTitle === currentTitle && !currentTitle.startsWith(`${siteTitle} - `)) {
    throw new Error(`Unexpected HonKit title format in ${file}: ${currentTitle}`);
  }

  const expectedTitle = `${siteTitle} - ${pageTitle}`;
  const updatedHtml = html.replace(titlePattern, `<title>${expectedTitle}</title>`);
  await writeFile(file, updatedHtml);
}

console.log(`Updated ${htmlFiles.length} page titles to "${siteTitle} - <page title>".`);
