import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const frontendDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const appDir = join(frontendDir, "app");

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

const sourceFiles = [
  ...walk(appDir),
  ...walk(join(frontendDir, "components")),
].filter((file) => /\.(ts|tsx)$/.test(file));

const routes = new Set(["/"]);
for (const file of sourceFiles.filter(
  (candidate) => candidate.endsWith("/page.tsx") || candidate.endsWith("/route.ts"),
)) {
  const segments = relative(appDir, dirname(file))
    .split("/")
    .filter((segment) => segment && !segment.startsWith("("));
  if (segments.some((segment) => segment.startsWith("["))) continue;
  routes.add(`/${segments.join("/")}`.replace(/\/$/, "") || "/");
}

const contentFamilies = [
  ["blog/content.ts", "/blog"],
  ["compare/content.ts", "/compare"],
  ["solutions/content.ts", "/solutions"],
  ["use-cases/content.ts", "/use-cases"],
  ["newsletters/content.ts", "/newsletters"],
];
for (const [file, prefix] of contentFamilies) {
  const source = readFileSync(join(appDir, file), "utf8");
  for (const match of source.matchAll(/slug:\s*["']([^"']+)["']/g)) {
    routes.add(`${prefix}/${match[1]}`);
  }
}

for (const category of ["comparisons", "guides", "ai-tools", "research"]) {
  routes.add(`/blog/category/${category}`);
}

const ignoredPrefixes = ["/api/", "/articles/", "/topics/", "/daily/", "/trending/"];
const broken = [];
for (const file of sourceFiles) {
  const source = readFileSync(file, "utf8");
  const links = [
    ...source.matchAll(/(?:href\s*=\s*|href:\s*)["'](\/[^"'#]*)["']/g),
    ...source.matchAll(/\]\((\/[^)#\s]+)(?:#[^)]+)?\)/g),
  ].map((match) => match[1].split("?")[0].replace(/\/$/, "") || "/");

  for (const href of links) {
    if (routes.has(href) || ignoredPrefixes.some((prefix) => href.startsWith(prefix))) continue;
    broken.push(`${relative(frontendDir, file)} -> ${href}`);
  }
}

if (broken.length) {
  console.error(`Broken internal links:\n${[...new Set(broken)].sort().join("\n")}`);
  process.exit(1);
}

console.log(`SEO link check passed: ${routes.size} routes, ${sourceFiles.length} source files.`);
