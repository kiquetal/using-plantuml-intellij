# Diagram Studio

Turn a **C4-PlantUML** file from *any* project into an **interactive** diagram —
a pan/zoom/clickable architecture graph plus an animated, step-through sequence
you can export as PNG or **animated GIF** — all in one unified style. You can
also render a **sequence-only** view from a native PlantUML sequence diagram
(see [Render ONLY a sequence](#render-only-a-sequence-no-container-graph)).

This repo is the single home for the tooling. Your other project repos only own
their `.puml` files; you point the studio at them.

```
C4 .puml  ──parse──▶  ArchSpec (JSON)  ──render──▶  interactive graph + sequence
```

## Architecture

One stable contract in the middle (`ArchSpec`) decouples *where a diagram comes
from* from *how it's drawn*. Parsers produce it; renderers consume it; the theme
styles it. Add a parser or a renderer without touching the other side.

```
interactive/
├── src/
│   ├── core/
│   │   ├── spec.js        ← the ArchSpec contract + validateSpec()
│   │   ├── theme.js       ← ONE source of truth: role → color/style
│   │   └── layout.js      ← auto-position nodes into role-based tiers
│   ├── parsers/
│   │   └── c4.js          ← C4-PlantUML macros → ArchSpec
│   ├── renderers/
│   │   ├── GraphView.svelte     ← interactive SvelteFlow graph
│   │   └── SequenceView.svelte  ← animated step-through + GIF recorder
│   ├── lib/
│   │   ├── gifRecorder.js       ← frame capture → animated GIF (gif.js)
│   │   └── DownloadButton.svelte← PNG export
│   └── App.svelte         ← loads specs/*.json, ?spec= picks one
├── specs/                 ← generated (or hand-authored) specs, one per project
│   ├── order-platform.json
│   └── order-platform-flow.json
└── cli/
    └── import-c4.js        ← .puml → specs/<name>.json
```

**Unified style by construction:** every node is classified into a semantic
**role** (`edge`, `service`, `data`, `async`, `control`, `external`, `person`).
The theme colors purely by role, so a "service" looks identical in every
project. Change `core/theme.js` once → all diagrams restyle.

## Run it

```bash
cd interactive
npm install
npm run dev            # http://localhost:5173
```

Pick a spec from the dropdown, or open `?spec=order-platform` directly.

## The workflow: import a C4 file from another repo

From this repo, point the CLI at any project's C4 `.puml`:

```bash
# 1. Container diagram → structure (nodes + edges)
node cli/import-c4.js ~/projects/foo/docs/c4_2_container.puml --name foo

# 2. (optional) Dynamic diagram → animated sequence, merged with the structure
node cli/import-c4.js ~/projects/foo/docs/c4_6_dynamic.puml \
    --name foo-flow --flow --merge ~/projects/foo/docs/c4_2_container.puml

# 3. View it
npm run dev            # then open ?spec=foo  (and ?spec=foo-flow)
```

That writes `specs/foo.json`. The app auto-discovers it — no code changes.

### CLI flags

| Flag | Meaning |
|------|---------|
| `--name <slug>` | output filename (default: derived from the `.puml` name) |
| `--seq` | parse a native **PlantUML sequence** diagram → **sequence-only** view |
| `--flow` | treat ordered `Rel()` as **sequence steps** (for C4 **Dynamic** files) |
| `--merge <container.puml>` | take nodes/edges from a container file, flow from this one |

### Render ONLY a sequence (no container graph)

If you just want the animated, colored sequence — nothing else — import a
**native PlantUML sequence diagram** with `--seq`:

```bash
# Point at any .puml sequence (participants + -> messages)
node cli/import-c4.js ~/projects/foo/diagrams/request-flow.puml --name foo-seq --seq

npm run dev            # then open ?spec=foo-seq  → sequence ONLY, no graph
```

`--seq` marks the spec `view: "sequence"`, so the app hides the container-graph
section entirely and renders just the step-through sequence.

What `--seq` parses from a real sequence file:

| Source syntax | Rendered as |
|---------------|-------------|
| `participant "X" as x` / `actor` / `database` / `queue` | actor lifeline (colored by role) |
| `participant "X" as x #2E86C1` | actor uses that **exact color** |
| `box "Label" ... end box` | groups those participants |
| `A -> B : text` | sync call — solid line, filled arrowhead |
| `A --> B : text` | return — **dashed** line |
| `A ->> B : text` | async — solid line, **open** arrowhead |
| `A -> A : text` | self-call loop |
| `alt / else / end`, `opt`, `loop` | frame box with label + divider |
| `note over X : text` | sticky note on the canvas |

Colors: an explicit `#hex` on a participant wins; otherwise the semantic role
color is used, and **multiple same-role participants get distinct shades** so
neighbouring services/datastores stay tellable apart.

Deep-link a point in the flow with `?step=N` — e.g. `?spec=foo-seq&step=6`
reveals the first 6 messages (handy for docs/screenshots).

Try the bundled examples: `?spec=login-alt` (alt/else frame), `?spec=seq-demo`,
`?spec=checkout-8` (8 actors).

### What the parser understands

- **Elements:** `Person`, `Person_Ext`, `Container`, `ContainerDb`,
  `ContainerQueue`, `Component*`, `System`, `System_Ext`, `SystemDb`.
- **Relations:** `Rel`, `Rel_U/D/L/R` (and `_Up/_Down/…`), `Rel_Back`, `BiRel`.
- **Ignored safely:** `!include`, `LAYOUT_*()`, boundaries are flattened.
- Unknown macros are **skipped with a warning**, never a crash. If a macro
  isn't handled, edit the one line in the generated `specs/<name>.json`.

Role inference: `Person*→person`, `*Db→data`, `*Queue→async`,
`*_Ext/System*→external`, names matching gateway/kong/envoy `→edge`, else
`service`. Wrong guess? Change the `role` field in the spec JSON.

## Hand-authored specs

You don't need a `.puml` — you can write a spec directly. See
[`src/core/spec.js`](src/core/spec.js) for the shape:

```json
{
  "title": "My System",
  "nodes": [
    { "id": "gw", "label": "API Gateway", "role": "edge", "tech": "Kong" },
    { "id": "svc", "label": "My Service", "role": "service" },
    { "id": "db", "label": "Postgres", "role": "data" }
  ],
  "edges": [
    { "from": "gw", "to": "svc", "label": "REST" },
    { "from": "svc", "to": "db", "label": "SQL" }
  ],
  "flow": [
    { "from": "gw", "to": "svc", "label": "POST /thing" },
    { "from": "svc", "to": "db", "label": "INSERT" }
  ]
}
```

Drop it in `specs/`, and it appears in the picker.

## How the animated GIF works (in code)

A GIF is a series of stills. The step-through is a runtime animation, so we
capture **one frame per step** and encode them (see
[`src/lib/gifRecorder.js`](src/lib/gifRecorder.js)):

```js
import GIF from 'gif.js';
import gifWorkerUrl from 'gif.js/dist/gif.worker.js?url'; // Vite bundles the worker
import { toPng } from 'html-to-image';

const gif = new GIF({ workers: 2, quality: 10, width, height, workerScript: gifWorkerUrl });

for (let i = 0; i <= steps; i++) {
  await onStep(i);        // reveal one more message
  await tick();           // let Svelte flush the DOM
  const url = await toPng(svgEl, { width, height, backgroundColor: '#fff' });
  gif.addFrame(await loadImage(url), { delay: 900 });
}
gif.on('finished', (blob) => /* download */);
gif.render();             // encodes in a Web Worker
```

The one Vite detail: gif.js runs its encoder in a Web Worker; importing it as
`gif.js/dist/gif.worker.js?url` lets Vite bundle it (`npm run build` emits
`dist/assets/gif.worker-*.js`).

Other ways to get a GIF (for the *continuously* animated graph edges rather
than discrete steps): screen-record + `ffmpeg`, a Puppeteer screenshot loop, or
render PlantUML per-step PNGs and stitch with ImageMagick
(`convert -delay 90 -loop 0 step_*.png out.gif`).

## Build

```bash
npm run build     # → dist/
npm run preview
```
