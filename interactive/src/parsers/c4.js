// ---------------------------------------------------------------------------
// c4.js — parse C4-PlantUML source into an ArchSpec.
//
// Handles the element + relationship macros used in this repo's diagrams:
//   Elements:  Person, Person_Ext, Container, ContainerDb, ContainerQueue,
//              Component, ComponentDb, ComponentQueue, System, System_Ext,
//              SystemDb, System_Boundary{...}, Container_Boundary{...}
//   Relations: Rel, Rel_U/D/L/R, Rel_Up/Down/Left/Right, Rel_Back, BiRel
//
// It is deliberately forgiving: unknown macros are skipped (recorded as
// warnings), boundaries are flattened, and !include / layout directives are
// ignored. When a macro isn't recognized, the spec still renders — you fix the
// one line rather than the whole pipeline breaking.
//
// Role inference maps each macro to a semantic role (see core/spec.js ROLES):
//   Person*         -> person
//   *Db             -> data
//   *Queue          -> async
//   *_Ext / System* -> external
//   name ~ gateway  -> edge
//   otherwise       -> service
// ---------------------------------------------------------------------------

/** Split a C4 macro's argument list, respecting quoted commas. */
function splitArgs(inner) {
  const args = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (ch === '"') { inQuote = !inQuote; cur += ch; continue; }
    if (ch === ',' && !inQuote) { args.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim()) args.push(cur.trim());
  return args.map((a) => a.replace(/^"|"$/g, ''));
}

/** Classify a C4 element macro name + alias into a semantic role. */
function roleFor(macro, alias, label) {
  const m = macro.toLowerCase();
  if (m.startsWith('person')) return 'person';
  if (m.endsWith('queue')) return 'async';
  if (m.endsWith('db')) return 'data';
  if (m.includes('_ext') || m.startsWith('system')) return 'external';

  const hay = `${alias} ${label}`.toLowerCase();
  if (/gateway|api[_\s-]?gw|ingress|proxy|edge|kong|envoy/.test(hay)) return 'edge';
  if (/kafka|queue|broker|event|bus|rabbit|sqs|sns|pubsub/.test(hay)) return 'async';
  if (/postgres|mysql|redis|mongo|dynamo|cache|db|database|store/.test(hay)) return 'data';
  return 'service';
}

// Element macros → whether they take a "tech" arg in position 2.
// C4 element signature: Macro(alias, "Label", "Tech"?, "Description"?)
const ELEMENT_MACROS = new Set([
  'Person', 'Person_Ext',
  'Container', 'ContainerDb', 'ContainerQueue',
  'Component', 'ComponentDb', 'ComponentQueue',
  'System', 'System_Ext', 'SystemDb', 'SystemQueue',
]);

const REL_MACROS = new Set([
  'Rel', 'Rel_U', 'Rel_D', 'Rel_L', 'Rel_R',
  'Rel_Up', 'Rel_Down', 'Rel_Left', 'Rel_Right',
  'Rel_Back', 'Rel_Back_Neighbor', 'Rel_Neighbor', 'BiRel',
]);

/**
 * Parse C4-PlantUML source into an ArchSpec.
 * @param {string} source  raw .puml contents
 * @param {object} [opts]
 * @param {boolean} [opts.asFlow=false]  if true, ordered Rel() become flow steps
 *                                        (for C4 Dynamic diagrams)
 * @returns {{ title:string, nodes:any[], edges:any[], flow:any[], warnings:string[] }}
 */
export function parseC4(source, { asFlow = false } = {}) {
  const nodes = [];
  const edges = [];
  const flow = [];
  const warnings = [];
  let title = 'Imported C4 diagram';
  const seen = new Set();

  const lines = source.split(/\r?\n/);
  for (let raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("'") || line.startsWith('!') || line.startsWith('@')) continue;

    // title
    const tm = line.match(/^title\s+(.+)$/i);
    if (tm) { title = tm[1].trim(); continue; }

    // Match  Macro(...)  — grab macro name + the paren body.
    const mm = line.match(/^([A-Za-z_]+)\s*\((.*)\)\s*\{?\s*$/);
    if (!mm) continue;
    const macro = mm[1];
    const args = splitArgs(mm[2]);

    if (ELEMENT_MACROS.has(macro)) {
      const [alias, label, third, fourth] = args;
      if (!alias) continue;
      if (seen.has(alias)) continue; // dynamic files re-declare containers
      seen.add(alias);
      // Person(alias,label,desc) and System*(alias,label,desc) have no tech;
      // Container*/Component* are (alias,label,tech,desc).
      const noTech = macro.toLowerCase().startsWith('person') ||
                     macro.toLowerCase().startsWith('system');
      const tech = noTech ? undefined : third;
      const description = noTech ? third : fourth;
      nodes.push({
        id: alias,
        label: label ?? alias,
        role: roleFor(macro, alias, label ?? ''),
        ...(tech ? { tech } : {}),
        ...(description ? { description } : {}),
        ...(macro.includes('_Ext') ? { external: true } : {}),
      });
      continue;
    }

    if (REL_MACROS.has(macro)) {
      const [from, to, label] = args;
      if (!from || !to) continue;
      const isBack = macro.includes('Back');
      const src = isBack ? to : from;
      const dst = isBack ? from : to;
      const async = /kafka|event|consume|publish|async|producer|consumer|queue/i.test(label ?? '');
      if (asFlow) {
        flow.push({
          from: src, to: dst,
          label: label ?? '',
          kind: isBack ? 'return' : 'call',
        });
      } else {
        edges.push({ from: src, to: dst, label: label ?? '', async });
      }
      if (macro === 'BiRel') edges.push({ from: dst, to: src, label: label ?? '' });
      continue;
    }

    // Boundary wrappers (System_Boundary/Container_Boundary) — flatten: their
    // children are declared as normal elements on following lines.
    if (/_Boundary$/.test(macro) || macro === 'Boundary' || macro === 'Enterprise_Boundary') {
      continue;
    }

    warnings.push(`Unrecognized macro skipped: ${macro}(...)`);
  }

  return { title, nodes, edges, flow, warnings };
}
