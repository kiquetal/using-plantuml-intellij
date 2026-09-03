// ---------------------------------------------------------------------------
// sequence.js — parse a native PlantUML *sequence* diagram into an ArchSpec
// whose `flow` faithfully mirrors the source (respecting message order,
// returns, self-calls, activation, alt/else/loop/opt frames, and notes).
//
// Supported syntax:
//   Participants: actor/participant/boundary/control/entity/database/queue/
//                 collections  NAME  [as ALIAS]  [#color]
//                 (quoted display names supported: participant "API GW" as gw)
//   Boxes:        box "Label" [#color] ... end box     (grouping → node.group)
//   Messages:     A -> B : text        (sync call)
//                 A --> B : text       (return, dashed)
//                 A ->> B : text       (async)
//                 A -> A : text        (self-call)
//   Activation:   activate X / deactivate X   (marks step activation)
//   Frames:       alt/else, opt, loop, par, break, critical ... end
//   Notes:        note over X: text | note left/right of X: text
//
// Role inference reuses the same keyword logic idea as the C4 parser so colors
// stay unified across both.
// ---------------------------------------------------------------------------

function inferRole(name, kind) {
  const hay = name.toLowerCase();
  if (kind === 'actor') return 'person';
  if (kind === 'database') return 'data';
  if (kind === 'queue') return 'async';
  if (/api[_\s-]?gateway|gateway|krakend|kong|ingress|apigee|traefik|\bgw\b/.test(hay)) return 'edge';
  if (/kafka|rabbit|sqs|sns|nats|jetstream|broker|event bus|queue/.test(hay)) return 'async';
  if (/postgres|mysql|redis|mongo|dynamo|neo4j|\bcache\b|\bdb\b|database|store/.test(hay)) return 'data';
  if (/idp|auth0|keycloak|stripe|external|third[_\s-]?party|sendgrid|backend/.test(hay)) return 'external';
  return 'service';
}

const PARTICIPANT_KINDS = new Set([
  'actor', 'participant', 'boundary', 'control', 'entity',
  'database', 'queue', 'collections',
]);

const FRAME_OPENERS = new Set(['alt', 'opt', 'loop', 'par', 'break', 'critical', 'group']);

/**
 * Parse a PlantUML sequence diagram.
 * @param {string} source
 * @returns {{title:string, nodes:any[], edges:any[], flow:any[], groups:any[], warnings:string[]}}
 */
export function parseSequence(source) {
  const nodes = [];
  const flow = [];
  const groups = [];
  const warnings = [];
  let title = 'Imported sequence';
  const byAlias = new Map();       // alias -> node
  let currentBox = null;           // active box group id
  const frameStack = [];           // open frames, for pending 'end'
  let frameSeq = 0;
  let inSkinBlock = false;         // inside skinparam { ... } / note { ... }

  const ensure = (nameOrAlias) => {
    // Reference in a message may use alias or bare name.
    if (byAlias.has(nameOrAlias)) return byAlias.get(nameOrAlias);
    // implicit participant (first use without declaration)
    const node = { id: nameOrAlias, label: nameOrAlias, role: inferRole(nameOrAlias, 'participant') };
    byAlias.set(nameOrAlias, node);
    nodes.push(node);
    return node;
  };

  const stripComment = (s) => {
    // remove trailing ' comment (not inside quotes)
    let inQ = false, out = '';
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (c === '"') inQ = !inQ;
      if (c === "'" && !inQ) break;
      out += c;
    }
    return out.trimEnd();
  };

  for (let raw of source.split(/\r?\n/)) {
    let line = stripComment(raw.trim());
    if (!line) continue;
    if (line.startsWith('@') || line.startsWith('!')) continue;
    // Skip multi-line skinparam / note style blocks: `skinparam x {` ... `}`
    if (inSkinBlock) { if (line === '}' || /}\s*$/.test(line)) inSkinBlock = false; continue; }
    if (/^(skinparam|note)\b.*\{\s*$/i.test(line)) { inSkinBlock = true; continue; }
    if (/^skinparam\b/i.test(line) || /^autonumber\b/i.test(line) ||
        /^legend\b/i.test(line) || /^endlegend\b/i.test(line) ||
        line.startsWith('|') || line === '{' ) continue;

    // title
    let m = line.match(/^title\s+(.+)$/i);
    if (m) { title = m[1].trim(); continue; }

    // box "Label" [#color]  → start a group
    m = line.match(/^box\s+"?([^"#]+?)"?\s*(#[0-9a-fA-F]{3,8})?\s*$/);
    if (m) {
      const id = `box${groups.length}`;
      groups.push({ id, label: m[1].trim() });
      currentBox = id;
      continue;
    }
    if (/^end\s*box$/i.test(line)) { currentBox = null; continue; }

    // participant declaration
    m = line.match(/^(actor|participant|boundary|control|entity|database|queue|collections)\s+(.*)$/i);
    if (m && PARTICIPANT_KINDS.has(m[1].toLowerCase())) {
      const kind = m[1].toLowerCase();
      let rest = m[2].trim();
      // trailing #color
      let color;
      const cm = rest.match(/\s(#[0-9a-fA-F]{3,8})\s*$/);
      if (cm) { color = cm[1]; rest = rest.slice(0, cm.index).trim(); }
      // "Display Name" as alias  |  Name as alias  |  Name
      let label, alias;
      const asm = rest.match(/^(".*?"|\S+)\s+as\s+(\S+)$/i);
      if (asm) { label = asm[1].replace(/^"|"$/g, ''); alias = asm[2].replace(/^"|"$/g, ''); }
      else { label = rest.replace(/^"|"$/g, ''); alias = label; }
      const node = {
        id: alias,
        label,
        role: inferRole(label, kind),
        ...(color ? { color } : {}),
        ...(currentBox ? { group: currentBox } : {}),
      };
      byAlias.set(alias, node);
      if (alias !== label) byAlias.set(label, node); // allow ref by name too
      nodes.push(node);
      continue;
    }

    // note over X[, Y]: text   |  note left/right of X: text
    m = line.match(/^note\s+(over|left of|right of)\s+([^:]+):\s*(.+)$/i);
    if (m) {
      const targets = m[2].split(',').map((s) => s.trim());
      flow.push({ kind: 'note', over: targets, label: m[3].trim() });
      continue;
    }

    // frame openers: alt/opt/loop/... [#color] [label]
    m = line.match(/^(alt|opt|loop|par|break|critical|group)\b\s*(#[0-9a-fA-F]{3,8})?\s*(.*)$/i);
    if (m && FRAME_OPENERS.has(m[1].toLowerCase())) {
      const id = `f${frameSeq++}`;
      frameStack.push(id);
      flow.push({ kind: 'frame-start', frame: id, type: m[1].toLowerCase(), label: (m[3] || '').trim() });
      continue;
    }
    if (/^else\b/i.test(line)) {
      const label = line.replace(/^else\b/i, '').trim();
      flow.push({ kind: 'frame-else', frame: frameStack[frameStack.length - 1], label });
      continue;
    }
    if (/^end\b/i.test(line)) {
      const id = frameStack.pop();
      flow.push({ kind: 'frame-end', frame: id });
      continue;
    }

    // activate / deactivate
    m = line.match(/^(activate|deactivate)\s+(\S+)/i);
    if (m) {
      flow.push({ kind: m[1].toLowerCase(), actor: m[2] });
      continue;
    }

    // message:  A (arrow) B : text
    //   arrows: ->  -->  ->>  -->>  <-  <--
    m = line.match(/^(\S+)\s*(-+>>?|<-+)\s*(\S+)\s*:\s*(.*)$/);
    if (m) {
      let [, a, arrow, b, text] = m;
      // normalize reverse arrows (<-) to from->to
      let from = a, to = b, dashed = arrow.includes('--'), async = arrow.includes('>>');
      if (arrow.startsWith('<')) { from = b; to = a; }
      ensure(from); ensure(to);
      flow.push({
        from, to,
        label: text.trim(),
        kind: dashed ? 'return' : (async ? 'async' : 'call'),
        self: from === to,
      });
      continue;
    }

    warnings.push(`Unrecognized sequence line skipped: ${line}`);
  }

  // A sequence import is sequence-only: mark the view so the app renders just
  // the animated sequence (no container graph). No structural edges are
  // emitted — the ordered `flow` is the source of truth.
  return { title, view: 'sequence', nodes, edges: [], flow, groups, warnings };
}
