#!/usr/bin/env node
// ---------------------------------------------------------------------------
// import-c4.js — convert a C4-PlantUML file into a studio spec.
//
// Usage:
//   node cli/import-c4.js <path-to.puml> [--name <slug>] [--flow] [--merge <container.puml>]
//
//   --name   output slug (default: derived from filename)
//   --flow   treat ordered Rel() as sequence flow steps (for C4 Dynamic files)
//   --merge  also parse a container file for structure, using THIS file's flow
//
// Typical calls from another repo:
//   node cli/import-c4.js ~/projects/foo/c4_2_container.puml --name foo
//   node cli/import-c4.js ~/projects/foo/c4_6_dynamic.puml --name foo --flow \
//        --merge ~/projects/foo/c4_2_container.puml
//
// Writes: specs/<name>.json
// ---------------------------------------------------------------------------
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { basename, resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseC4 } from '../src/parsers/c4.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SPECS_DIR = resolve(__dirname, '..', 'specs');

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--flow') args.flow = true;
    else if (a === '--name') args.name = argv[++i];
    else if (a === '--merge') args.merge = argv[++i];
    else args._.push(a);
  }
  return args;
}

function slug(p) {
  return basename(p).replace(/\.puml$/i, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
}

const args = parseArgs(process.argv.slice(2));
const input = args._[0];
if (!input) {
  console.error('Usage: node cli/import-c4.js <file.puml> [--name slug] [--flow] [--merge container.puml]');
  process.exit(1);
}

const name = args.name ? slug(args.name) : slug(input);
const source = readFileSync(resolve(input), 'utf8');
const parsed = parseC4(source, { asFlow: !!args.flow });

let spec = {
  title: parsed.title,
  nodes: parsed.nodes,
  edges: parsed.edges,
  flow: parsed.flow,
  groups: parsed.groups,
};

// If --flow and --merge: take structure (nodes/edges) from the container file
// and the ordered flow from the dynamic file — the ideal combined spec.
if (args.flow && args.merge) {
  const mergeSrc = readFileSync(resolve(args.merge), 'utf8');
  const structure = parseC4(mergeSrc, { asFlow: false });
  spec = {
    title: parsed.title || structure.title,
    nodes: structure.nodes,
    edges: structure.edges,
    flow: parsed.flow,
    groups: structure.groups,
  };
  parsed.warnings.push(...structure.warnings.map((w) => `[merge] ${w}`));
}

mkdirSync(SPECS_DIR, { recursive: true });
const outPath = join(SPECS_DIR, `${name}.json`);
writeFileSync(outPath, JSON.stringify(spec, null, 2) + '\n', 'utf8');

console.log(`✓ Wrote ${outPath}`);
console.log(`  nodes: ${spec.nodes.length}  edges: ${spec.edges.length}  flow: ${spec.flow.length}`);
if (parsed.warnings.length) {
  console.log(`  warnings (${parsed.warnings.length}):`);
  for (const w of parsed.warnings) console.log(`    - ${w}`);
}
