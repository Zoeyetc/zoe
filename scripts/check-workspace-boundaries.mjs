import { readdir, readFile } from 'node:fs/promises';
import { dirname, extname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const engineRoot = resolve(repositoryRoot, 'packages/listening-engine');
const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const forbiddenSegments = new Set([
  'apps', 'rides', 'physics', 'signal-console', 'signal-player', 'experience',
  'audio-source-browser', 'zland',
]);
const importPattern = /(?:import|export)\s+(?:type\s+)?(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]|(?:import|require)\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async entry => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return sourceExtensions.has(extname(entry.name)) ? [path] : [];
  }));
  return files.flat();
}

function forbiddenReason(file, specifier) {
  const segments = specifier.split('/').filter(segment => segment && segment !== '.' && segment !== '..');
  const namedBoundary = segments.find(segment => forbiddenSegments.has(segment));
  if (namedBoundary) return `imports forbidden boundary "${namedBoundary}"`;

  if (specifier.startsWith('.')) {
    const target = resolve(dirname(file), specifier);
    const targetFromEngine = relative(engineRoot, target);
    if (targetFromEngine === '..' || targetFromEngine.startsWith('../')) {
      return 'escapes the listening-engine package boundary';
    }
    const targetFromRepository = relative(repositoryRoot, target).split('/');
    const escapedBoundary = targetFromRepository.find(segment => forbiddenSegments.has(segment));
    if (escapedBoundary) return `reaches forbidden boundary "${escapedBoundary}"`;
  }
  return null;
}

const violations = [];
for (const file of await sourceFiles(engineRoot)) {
  const source = await readFile(file, 'utf8');
  for (const match of source.matchAll(importPattern)) {
    const specifier = match[1] ?? match[2];
    const reason = forbiddenReason(file, specifier);
    if (reason) violations.push(`${relative(repositoryRoot, file)}: ${reason} via ${specifier}`);
  }
}

if (violations.length) {
  console.error(['Listening engine boundary violations:', ...violations.map(item => `- ${item}`)].join('\n'));
  process.exitCode = 1;
} else {
  console.log('Listening engine boundary guard passed.');
}
