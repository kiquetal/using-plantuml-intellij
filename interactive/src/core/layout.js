// ---------------------------------------------------------------------------
// layout.js — auto-position nodes into horizontal tiers by role.
//
// C4 container files have no coordinates, so we assign positions. Nodes are
// grouped into tiers (rows); each tier lays its nodes out left-to-right. This
// gives a consistent, readable default across every project without manual
// positioning. Users can drag nodes afterward in the interactive view.
// ---------------------------------------------------------------------------

// Which tier (row) each role sits in, top to bottom.
const TIER_BY_ROLE = {
  person:   0,
  edge:     1,
  service:  2,
  control:  2,
  data:     3,
  async:    3,
  external: 4,
};

const COL_W = 230;
const ROW_H = 150;
const X0 = 40;
const Y0 = 20;

/**
 * Assign { x, y } positions to nodes, grouped into tiers by role.
 * @param {import('./spec.js').SpecNode[]} nodes
 * @returns {Record<string, {x:number, y:number}>} id -> position
 */
export function autoLayout(nodes) {
  // Bucket nodes by tier.
  const tiers = {};
  for (const n of nodes) {
    const t = TIER_BY_ROLE[n.role] ?? 2;
    (tiers[t] ??= []).push(n);
  }

  const positions = {};
  for (const [tier, group] of Object.entries(tiers)) {
    const y = Y0 + Number(tier) * ROW_H;
    // Center each tier's row so rows look balanced.
    group.forEach((n, i) => {
      positions[n.id] = { x: X0 + i * COL_W, y };
    });
  }
  return positions;
}

/**
 * Order nodes left-to-right for a sequence diagram: people first, then edge,
 * services, data/async, external. Stable within a tier.
 * @param {import('./spec.js').SpecNode[]} nodes
 */
export function sequenceOrder(nodes) {
  const rank = (r) => TIER_BY_ROLE[r] ?? 2;
  return [...nodes].sort((a, b) => rank(a.role) - rank(b.role));
}
