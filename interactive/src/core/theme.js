// ---------------------------------------------------------------------------
// theme.js — the ONE source of truth for visual style.
//
// Every diagram, every project, is styled by role through this file. Change a
// color here and all projects restyle. Renderers never hardcode colors.
// ---------------------------------------------------------------------------

/** role -> palette entry */
export const ROLE_STYLE = {
  edge:     { color: '#2563eb', label: 'Edge / gateway' },
  service:  { color: '#7c3aed', label: 'Service' },
  data:     { color: '#15803d', label: 'Datastore' },
  async:    { color: '#b45309', label: 'Messaging (async)' },
  control:  { color: '#0891b2', label: 'Control plane' },
  external: { color: '#334155', label: 'External system' },
  person:   { color: '#be185d', label: 'Person / actor' },
};

export const FALLBACK = ROLE_STYLE.service;

/** Inline style string for a SvelteFlow node, by role. */
export function nodeStyle(role) {
  const bg = (ROLE_STYLE[role] ?? FALLBACK).color;
  return `background:${bg};color:#fff;border:1px solid rgba(0,0,0,.25);` +
         `border-radius:10px;padding:8px 10px;font-size:12px;` +
         `font-weight:600;width:180px;text-align:center;`;
}

/** Inline style for an edge, by role of its SOURCE node + async flag. */
export function edgeStyle(role, async = false) {
  const stroke = (ROLE_STYLE[role] ?? FALLBACK).color;
  return `stroke:${stroke};` + (async ? 'stroke-dasharray:5 4;' : '');
}

/** Color for a sequence arrow, by source role. */
export function arrowColor(role) {
  return (ROLE_STYLE[role] ?? FALLBACK).color;
}

/**
 * Shift a hex color's lightness. amount in [-1,1]; negative darkens, positive
 * lightens. Keeps hue/saturation so it stays recognizably the same role color.
 */
export function shade(hex, amount) {
  const h = hex.replace('#', '');
  const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  let r = parseInt(n.slice(0, 2), 16);
  let g = parseInt(n.slice(2, 4), 16);
  let b = parseInt(n.slice(4, 6), 16);
  const mix = (c) => amount < 0
    ? Math.round(c * (1 + amount))            // toward black
    : Math.round(c + (255 - c) * amount);     // toward white
  r = Math.max(0, Math.min(255, mix(r)));
  g = Math.max(0, Math.min(255, mix(g)));
  b = Math.max(0, Math.min(255, mix(b)));
  return '#' + [r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('');
}

// Distinct lightness offsets applied to same-role siblings, in order.
// index 0 = base color, then alternate darker/lighter so neighbours differ.
const SHADE_STEPS = [0, -0.22, 0.24, -0.4, 0.42, -0.55];

/**
 * Resolve a final color for every node:
 *   1. explicit node.color always wins (from .puml #hex or hand-authored spec)
 *   2. otherwise the role base color, VARIED per same-role index so multiple
 *      services / datastores / etc. are visually distinct while staying in
 *      the same color family.
 * @param {{id:string, role:string, color?:string}[]} nodes
 * @returns {Record<string,string>} id -> hex color
 */
export function resolveColors(nodes) {
  const roleCount = {};
  const out = {};
  for (const n of nodes) {
    if (n.color) { out[n.id] = n.color; continue; }
    const base = (ROLE_STYLE[n.role] ?? FALLBACK).color;
    const i = roleCount[n.role] = (roleCount[n.role] ?? 0);
    roleCount[n.role] = i + 1;
    const step = SHADE_STEPS[i % SHADE_STEPS.length];
    out[n.id] = step === 0 ? base : shade(base, step);
  }
  return out;
}

/** Legend entries actually used by a spec (dedup by role, preserve order). */
export function legendFor(nodes) {
  const seen = new Set();
  const out = [];
  for (const n of nodes) {
    if (seen.has(n.role)) continue;
    seen.add(n.role);
    const s = ROLE_STYLE[n.role] ?? FALLBACK;
    out.push({ role: n.role, color: s.color, label: s.label });
  }
  return out;
}
