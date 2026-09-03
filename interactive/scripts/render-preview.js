#!/usr/bin/env node
// ---------------------------------------------------------------------------
// render-preview.js — render a sequence spec to a standalone SVG that mirrors
// SequenceView's geometry/colors, for README preview images.
//
//   node scripts/render-preview.js specs/login-alt.json images/login-alt.svg
//
// Then convert to PNG (needs ImageMagick or rsvg):  convert in.svg out.png
// This is a docs helper — the app itself renders live; this just freezes a
// full-reveal still for the README.
// ---------------------------------------------------------------------------
import { readFileSync, writeFileSync } from 'node:fs';
import { resolveColors } from '../src/core/theme.js';

const [, , specPath, outPath] = process.argv;
if (!specPath || !outPath) {
  console.error('Usage: node scripts/render-preview.js <spec.json> <out.svg>');
  process.exit(1);
}

const spec = JSON.parse(readFileSync(specPath, 'utf8'));
const colorById = resolveColors(spec.nodes);
const colorOf = (id) => colorById[id] ?? '#334155';

// Actors that appear in the flow, in declaration order.
const used = new Set();
for (const s of spec.flow ?? []) {
  if (s.from) used.add(s.from);
  if (s.to) used.add(s.to);
  if (s.over) for (const o of s.over) used.add(o);
}
const actors = spec.nodes.filter((n) => used.has(n.id)).map((n) => ({ id: n.id, label: n.label }));

const COL_W = 150, MARGIN_X = 85, HEAD_Y = 44, HEAD_H = 38, FIRST = 130, ROW = 60;
const WIDTH = MARGIN_X * 2 + COL_W * Math.max(actors.length - 1, 1);
const ax = Object.fromEntries(actors.map((a, i) => [a.id, MARGIN_X + i * COL_W]));

// Layout pass: rows for messages/notes; frames span rows.
const rows = [];
const frames = [];
const open = [];
let r = 0;
for (const it of spec.flow ?? []) {
  if (it.kind === 'frame-start') open.push({ type: it.type, label: it.label, start: r, elses: [] });
  else if (it.kind === 'frame-else') open[open.length - 1]?.elses.push({ label: it.label, row: r });
  else if (it.kind === 'frame-end') { const f = open.pop(); if (f) { f.end = r; frames.push(f); } }
  else if (it.kind === 'activate' || it.kind === 'deactivate') { /* skip */ }
  else { rows.push({ ...it, y: FIRST + r * ROW }); r += 1; }
}
const bottom = FIRST + r * ROW + 10;
const H = bottom + 20;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${H}" width="${WIDTH}" height="${H}" font-family="system-ui, sans-serif">`;
svg += `<rect width="${WIDTH}" height="${H}" fill="#ffffff"/>`;
svg += `<defs><marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="context-stroke"/></marker>`;
svg += `<marker id="ao" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10" fill="none" stroke="context-stroke" stroke-width="1.6"/></marker></defs>`;

// frame boxes (behind)
for (const f of frames) {
  const y1 = FIRST + f.start * ROW - 28;
  const y2 = FIRST + f.end * ROW - 8;
  svg += `<rect x="20" y="${y1}" width="${WIDTH - 40}" height="${y2 - y1}" rx="6" fill="rgba(84,153,199,0.05)" stroke="#5499c7" stroke-dasharray="4 3"/>`;
  svg += `<rect x="20" y="${y1}" width="52" height="18" fill="#5499c7"/><text x="46" y="${y1 + 13}" text-anchor="middle" fill="#fff" font-size="11" font-weight="700">${esc(f.type)}</text>`;
  if (f.label) svg += `<text x="80" y="${y1 + 13}" font-size="11" font-weight="700" fill="#21618c">${esc(f.label)}</text>`;
  for (const e of f.elses) {
    const ey = FIRST + e.row * ROW - 28;
    svg += `<line x1="20" y1="${ey}" x2="${WIDTH - 20}" y2="${ey}" stroke="#5499c7" stroke-dasharray="4 3"/>`;
    svg += `<text x="28" y="${ey + 13}" font-size="11" font-weight="700" fill="#21618c">else ${esc(e.label)}</text>`;
  }
}

// lifelines + actor heads
for (const a of actors) {
  const x = ax[a.id];
  svg += `<line x1="${x}" y1="${HEAD_Y + HEAD_H}" x2="${x}" y2="${bottom}" stroke="#cbd5e1" stroke-dasharray="4 4"/>`;
  svg += `<rect x="${x - 66}" y="${HEAD_Y}" width="132" height="${HEAD_H}" rx="8" fill="${colorOf(a.id)}"/>`;
  svg += `<text x="${x}" y="${HEAD_Y + HEAD_H / 2 + 5}" text-anchor="middle" fill="#fff" font-size="15" font-weight="700">${esc(a.label)}</text>`;
}

// messages + notes
for (const s of rows) {
  if (s.over) {
    const xs = s.over.map((o) => ax[o]).filter((v) => v != null);
    const nx = (Math.min(...xs) + Math.max(...xs)) / 2;
    svg += `<rect x="${nx - 90}" y="${s.y - 16}" width="180" height="30" rx="4" fill="#fff8dc" stroke="#d4ac0d"/>`;
    svg += `<text x="${nx}" y="${s.y + 4}" text-anchor="middle" font-size="11" fill="#7a5c00">${esc(s.label)}</text>`;
    continue;
  }
  const c = colorOf(s.from);
  const x1 = ax[s.from], x2 = ax[s.to];
  if (s.from === s.to) {
    svg += `<text x="${x1 + 12}" y="${s.y - 9}" text-anchor="start" font-size="14" font-weight="600" fill="${c}">${esc(s.label)}</text>`;
    svg += `<path d="M ${x1} ${s.y} h 26 v 18 h -26" fill="none" stroke="${c}" stroke-width="2" marker-end="url(#a)"/>`;
  } else {
    const dir = x2 >= x1 ? 1 : -1;
    const xEnd = x2 - dir * 6;
    const mid = (x1 + x2) / 2;
    const dash = s.kind === 'return' ? ' stroke-dasharray="5 4"' : '';
    const marker = s.kind === 'async' ? 'url(#ao)' : 'url(#a)';
    svg += `<text x="${mid}" y="${s.y - 9}" text-anchor="middle" font-size="14" font-weight="600" fill="${c}">${esc(s.label)}</text>`;
    svg += `<line x1="${x1}" y1="${s.y}" x2="${xEnd}" y2="${s.y}" stroke="${c}" stroke-width="2.2"${dash} marker-end="${marker}"/>`;
  }
}
svg += `</svg>`;
writeFileSync(outPath, svg);
console.log(`✓ ${outPath}  (${WIDTH}x${H}, ${actors.length} actors, ${rows.length} messages)`);
