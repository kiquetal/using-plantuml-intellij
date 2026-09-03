// ---------------------------------------------------------------------------
// spec.js — the ArchSpec contract.
//
// Every parser PRODUCES an ArchSpec; every renderer CONSUMES one. This is the
// single stable interface that decouples "where the diagram came from" (C4
// puml, hand-authored, Mermaid, …) from "how it's drawn" (graph, sequence).
//
// Roles are semantic, not visual. The theme maps role -> color/shape, so every
// project is styled identically by construction.
// ---------------------------------------------------------------------------

/** Semantic roles. Keep this list small and stable. */
export const ROLES = ['edge', 'service', 'data', 'async', 'control', 'external', 'person'];

/**
 * @typedef {Object} SpecNode
 * @property {string} id
 * @property {string} label
 * @property {string} role           one of ROLES
 * @property {string} [tech]         e.g. "Kong", "PostgreSQL 15"
 * @property {string} [description]
 * @property {boolean} [external]
 */

/**
 * @typedef {Object} SpecEdge
 * @property {string} from
 * @property {string} to
 * @property {string} [label]
 * @property {boolean} [async]       dashed edge, fire-and-forget
 */

/**
 * @typedef {Object} SpecStep
 * @property {string} from
 * @property {string} to
 * @property {string} label
 * @property {'call'|'return'} [kind]
 * @property {string} [branch]
 * @property {string} [note]
 */

/**
 * @typedef {Object} ArchSpec
 * @property {string} title
 * @property {SpecNode[]} nodes
 * @property {SpecEdge[]} edges
 * @property {SpecStep[]} [flow]
 */

/** Fallback role when a parser can't classify a node. */
export const DEFAULT_ROLE = 'service';

/**
 * Validate + normalize an ArchSpec. Throws on structural errors, warns (via the
 * returned `warnings` array) on soft issues so the renderer never hard-crashes.
 * @param {ArchSpec} spec
 * @returns {{ spec: ArchSpec, warnings: string[] }}
 */
export function validateSpec(spec) {
  const warnings = [];
  if (!spec || typeof spec !== 'object') throw new Error('Spec must be an object');
  if (!Array.isArray(spec.nodes)) throw new Error('Spec.nodes must be an array');
  if (!Array.isArray(spec.edges)) throw new Error('Spec.edges must be an array');

  const ids = new Set();
  for (const n of spec.nodes) {
    if (!n.id) throw new Error('Every node needs an id');
    if (ids.has(n.id)) warnings.push(`Duplicate node id: ${n.id}`);
    ids.add(n.id);
    if (!ROLES.includes(n.role)) {
      warnings.push(`Node "${n.id}" has unknown role "${n.role}" → defaulting to "${DEFAULT_ROLE}"`);
      n.role = DEFAULT_ROLE;
    }
    if (!n.label) n.label = n.id;
  }

  for (const e of spec.edges) {
    if (!ids.has(e.from)) warnings.push(`Edge references missing node: ${e.from}`);
    if (!ids.has(e.to)) warnings.push(`Edge references missing node: ${e.to}`);
  }

  if (spec.flow) {
    for (const s of spec.flow) {
      // Only message steps have from/to; frames, notes, and activation don't.
      if (s.from && !ids.has(s.from)) warnings.push(`Flow step references missing node: ${s.from}`);
      if (s.to && !ids.has(s.to)) warnings.push(`Flow step references missing node: ${s.to}`);
    }
  }

  return { spec: { title: spec.title ?? 'Untitled', view: 'auto', flow: [], ...spec }, warnings };
}
