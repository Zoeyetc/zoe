import { access, readdir, readFile } from 'node:fs/promises';
import { dirname, extname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const importPattern = /(?:import|export)\s+(?:type\s+)?(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]|(?:import|require)\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(async entry => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : sourceExtensions.has(extname(entry.name)) ? [path] : [];
  }))).flat();
}
const boundaries = [
  { name: 'listening-engine', root: resolve(repositoryRoot, 'packages/listening-engine'),
    forbidEscape: true,
    forbidden: new Set(['apps','rides','physics','signal-console','signal-player','experience','audio-source-browser','zland','zoe']) },
  { name: 'audio-source-browser', root: resolve(repositoryRoot, 'packages/audio-source-browser'),
    forbidEscape: true,
    forbidden: new Set(['apps','rides','physics','signal-console','signal-player','experience','instrument-ui','instrument-app','zland','zoe']) },
  { name: 'listening-instrument-ui', root: resolve(repositoryRoot, 'packages/listening-instrument-ui'),
    forbidEscape: true,
    forbidden: new Set(['apps','rides','physics','experience','zland','@zland','zoe','ZlandAuthoredOverlay','ZlandListeningAdapter','AudioWorld']) },
  { name: 'zoe', root: resolve(repositoryRoot, 'apps/zoe'),
    forbidEscape: false,
    forbidden: new Set(['zland','@zland','rides','physics','experience','ZlandAuthoredOverlay','ZlandListeningAdapter','AudioWorld']) },
  { name: 'zland', root: resolve(repositoryRoot, 'apps/zland'),
    forbidEscape: false,
    forbidden: new Set(['zoe','instrument-ui','signal-console','signal-player']) },
];
const violations = [];
try {
  await access(resolve(repositoryRoot, 'src'));
  violations.push('src/: legacy root production tree must not exist after Batch E');
} catch { /* Expected final state. */ }
for (const boundary of boundaries) for (const file of await sourceFiles(boundary.root)) {
  const source = await readFile(file, 'utf8');
  for (const match of source.matchAll(importPattern)) {
    const specifier = match[1] ?? match[2];
    const segments = specifier.split('/').filter(segment => segment && segment !== '.' && segment !== '..');
    const named = segments.find(segment => boundary.forbidden.has(segment));
    if (named) { violations.push(`${relative(repositoryRoot,file)}: imports forbidden boundary "${named}" via ${specifier}`); continue; }
    if (boundary.forbidEscape && specifier.startsWith('.')) {
      const target = resolve(dirname(file), specifier);
      const rel = relative(boundary.root, target);
      if (rel === '..' || rel.startsWith('../')) violations.push(`${relative(repositoryRoot,file)}: escapes ${boundary.name} via ${specifier}`);
    }
  }
}
if (violations.length) { console.error(['Workspace boundary violations:', ...violations.map(v => `- ${v}`)].join('\n')); process.exitCode = 1; }
else console.log('Engine, browser source, instrument UI, Zoë, and Z.land boundary guards passed.');
