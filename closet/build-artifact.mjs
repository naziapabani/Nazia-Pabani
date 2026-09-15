#!/usr/bin/env node
// Flattens the app into one self-contained HTML page for publishing as a Claude
// Artifact, where the page is a single document rather than a folder of modules.
//
//   node build-artifact.mjs            -> writes dist/closet-artifact.html
//
// The multi-file source in js/ stays the thing you edit; this is the output.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = (name) => path.join(here, 'js', name);

// Dependency order: a module may only use what is already above it.
const MODULES = [
  'catalog.js', 'color.js', 'capabilities.js', 'imaging.js',
  'store.js', 'cropbox.js', 'vision.js', 'stylist.js', 'app.js',
];

const IMPORT_RE = /^import\s+([\s\S]*?)\s+from\s+['"]\.\/(.+?)['"];?\s*$/gm;
const EXPORT_DECL_RE = /^export\s+(?:async\s+)?(?:function|const|let|var|class)\s+([A-Za-z_$][\w$]*)/gm;

function exportedNames(code) {
  const names = [];
  for (const match of code.matchAll(EXPORT_DECL_RE)) names.push(match[1]);
  // `export const a = 1, b = 2;` — pick up the trailing declarators too.
  for (const match of code.matchAll(/^export\s+const\s+([^=;]+)=/gm)) {
    const head = match[1];
    if (head.includes(',')) head.split(',').forEach((part) => {
      const name = part.trim().split(/[\s=]/)[0];
      if (name && !names.includes(name)) names.push(name);
    });
  }
  return names;
}

/** Bindings a flat scope loses: `x as y` aliases and `* as ns` namespaces. */
function collectBindings(code, exportsByModule) {
  const extras = new Map(); // source module -> lines to append after its body
  const add = (source, line) => {
    if (!extras.has(source)) extras.set(source, []);
    if (!extras.get(source).includes(line)) extras.get(source).push(line);
  };

  for (const match of code.matchAll(IMPORT_RE)) {
    const [, clause, source] = match;
    const namespace = clause.match(/^\*\s+as\s+([A-Za-z_$][\w$]*)$/);
    if (namespace) {
      const names = exportsByModule.get(source);
      if (!names?.length) throw new Error(`No exports found for namespace import of ${source}`);
      add(source, `const ${namespace[1]} = { ${names.join(', ')} };`);
      continue;
    }
    const named = clause.replace(/^\{|\}$/g, '');
    for (const entry of named.split(',')) {
      const alias = entry.trim().match(/^([A-Za-z_$][\w$]*)\s+as\s+([A-Za-z_$][\w$]*)$/);
      if (alias) add(source, `const ${alias[2]} = ${alias[1]};`);
    }
  }
  return extras;
}

const stripModuleSyntax = (code) => code
  .replace(IMPORT_RE, '')
  .replace(/^export\s+(?=(?:async\s+)?(?:function|const|let|var|class)\s)/gm, '')
  .trimStart();

async function build() {
  const sources = new Map();
  for (const name of MODULES) sources.set(name, await readFile(src(name), 'utf8'));

  const exportsByModule = new Map(
    [...sources].map(([name, code]) => [name, exportedNames(code)]),
  );

  // A flat scope means one namespace: catch collisions here rather than in the browser.
  const seen = new Map();
  for (const [name, code] of sources) {
    for (const match of code.matchAll(/^(?:export\s+)?(?:async\s+)?(?:function|const|let|var|class)\s+([A-Za-z_$][\w$]*)/gm)) {
      const symbol = match[1];
      if (seen.has(symbol)) {
        throw new Error(`Name collision when flattening: "${symbol}" is declared in both ${seen.get(symbol)} and ${name}. Rename one.`);
      }
      seen.set(symbol, name);
    }
  }

  const extras = new Map();
  for (const code of sources.values()) {
    for (const [source, lines] of collectBindings(code, exportsByModule)) {
      extras.set(source, [...new Set([...(extras.get(source) ?? []), ...lines])]);
    }
  }

  const parts = [];
  for (const name of MODULES) {
    parts.push(`/* ---------- ${name} ---------- */`);
    parts.push(stripModuleSyntax(sources.get(name)));
    const bindings = extras.get(name);
    if (bindings?.length) parts.push(bindings.join('\n'));
  }
  const bundle = parts.join('\n\n');

  const css = await readFile(path.join(here, 'styles.css'), 'utf8');
  const shell = await readFile(path.join(here, 'index.html'), 'utf8');
  const body = shell.slice(shell.indexOf('<body>') + 6, shell.lastIndexOf('</body>'))
    .replace(/\n\s*<script type="module"[\s\S]*?<\/script>/, '')
    .trim();

  // The published page carries no charset declaration of its own, so anything
  // non-ASCII is escaped: the page then renders identically however the host
  // decodes the bytes. JS gets \uXXXX per UTF-16 unit (surrogate pairs included),
  // markup gets numeric character references per code point.
  const escapeJs = (code) => code.replace(/[^\x00-\x7F]/gu, (char) => [...char]
    .flatMap((cp) => [...cp].length && cp.codePointAt(0) > 0xffff
      ? [cp.charCodeAt(0), cp.charCodeAt(1)]
      : [cp.charCodeAt(0)])
    .map((unit) => `\\u${unit.toString(16).padStart(4, '0')}`)
    .join(''));
  const escapeMarkup = (markup) => markup.replace(/[^\x00-\x7F]/gu,
    (char) => `&#x${char.codePointAt(0).toString(16)};`);

  // An artifact page is content only — the platform supplies doctype, head and body.
  const page = `<title>Closet</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700&family=Archivo+Narrow:wght@500;600;700&display=swap">
<style>
${escapeMarkup(css.trim())}
</style>

${escapeMarkup(body)}

<script type="module">
${escapeJs(bundle)}
</script>
`;

  await mkdir(path.join(here, 'dist'), { recursive: true });
  const out = path.join(here, 'dist', 'closet-artifact.html');
  await writeFile(out, page);
  console.log(`wrote ${path.relative(here, out)} — ${(page.length / 1024).toFixed(0)} KB`);
}

build().catch((err) => { console.error(err.message); process.exit(1); });
