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
