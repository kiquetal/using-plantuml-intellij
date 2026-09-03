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
 * Assign { x, y } positions to nodes. If nodes carry `group` (from C4
 * boundaries), lay each group out as a vertical stack in its own column band,
 * with ungrouped nodes (people, external systems) in flanking columns. This
 * preserves the cluster structure of the source diagram. Falls back to
 * role-tiering when there are no groups.
 * @param {import('./spec.js').SpecNode[]} nodes
 * @param {{id:string,label:string}[]} [groups]
 * @returns {Record<string, {x:number, y:number}>} id -> position
 */
export function autoLayout(nodes, groups = []) {
  const hasGroups = groups.length > 0 && nodes.some((n) => n.group);
  if (!hasGroups) return tierLayout(nodes);

  const positions = {};
  const GROUP_GAP = 320;   // horizontal space per group band
  const NODE_GAP = 140;    // vertical space between nodes in a group
  const TOP = 70;          // leave room for group label

  // Column order: ungrouped "person" first, then each group, then ungrouped externals.
  const persons = nodes.filter((n) => !n.group && n.role === 'person');
  const externals = nodes.filter((n) => !n.group && n.role !== 'person');

  let col = 0;
  // people column
  persons.forEach((n, i) => { positions[n.id] = { x: X0 + col * GROUP_GAP, y: TOP + i * NODE_GAP }; });
  if (persons.length) col += 1;

  // one band per group
  for (const g of groups) {
    const members = nodes.filter((n) => n.group === g.id);
    members.forEach((n, i) => { positions[n.id] = { x: X0 + col * GROUP_GAP, y: TOP + i * NODE_GAP }; });
    col += 1;
  }

  // trailing externals column
  externals.forEach((n, i) => { positions[n.id] = { x: X0 + col * GROUP_GAP, y: TOP + i * NODE_GAP }; });

  return positions;
}

/** Original role-tiered layout (used when there are no group boundaries). */
function tierLayout(nodes) {
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
