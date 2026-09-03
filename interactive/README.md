# Interactive Architecture (Svelte Flow)

An interactive, browser-based companion to the static C4 `.puml` diagrams in
the repo root. Where PlantUML gives you portable, versioned images, this app
gives you a **live, pan/zoom/clickable** view of the same E-Commerce
architecture — plus **PNG export** and **animated GIF recording**.

The two views are complementary: keep the `.puml` files for docs and PRs, use
this app for demos and walkthroughs.

## Stack

- [Svelte 5](https://svelte.dev/) + [Vite](https://vite.dev/)
- [@xyflow/svelte](https://svelteflow.dev/) — the node/edge graph ("Svelte Flow")
- [html-to-image](https://github.com/bubkoo/html-to-image) — DOM → PNG snapshots
- [gif.js](https://github.com/jnordberg/gif.js) — encode frames into an animated GIF

## Run it

```bash
cd interactive
npm install
npm run dev      # http://localhost:5173
```

Build a static bundle:

```bash
npm run build    # outputs to interactive/dist
npm run preview  # serve the built bundle
```

## What's in the app

1. **Container view (C4 Level 2)** — an interactive `<SvelteFlow>` graph of the
   platform (API Gateway → Order/Payment services → Postgres/Kafka → external
   Stripe & Notification). Pan, zoom, drag nodes, and **click any box** for a
   detail popup. Animated edges show request flow; dashed edges are async.
   The **⬇ PNG** button (top-right of the canvas) exports the graph.
2. **Order flow (step-through)** — an SVG sequence diagram of the order-placement
   flow with a **happy vs. failed payment** toggle and Play/Prev/Next/Reset.
   The **● Record GIF** button turns the walkthrough into a downloadable GIF.

## How the animated GIF is created (in code)

A GIF is just a series of still frames. Svelte Flow's animated edges and the
sequence step-through are *runtime* animations — a single screenshot can't
capture motion. So we **capture one frame per step** and encode them.

The flow (see [`src/lib/gifRecorder.js`](src/lib/gifRecorder.js)):

1. **Advance state** to step `i` (reveal one more message).
2. **Wait for Svelte to re-render** with `await tick()`.
3. **Snapshot the DOM** to a PNG data URL with `html-to-image`'s `toPng`.
4. **Add it as a frame** to a `gif.js` encoder with a per-frame `delay`.
5. After the last step, **`gif.render()`** encodes everything (in a Web Worker)
   and hands back a `Blob` we trigger as a download.

The core loop, simplified:

```js
import GIF from 'gif.js';
import gifWorkerUrl from 'gif.js/dist/gif.worker.js?url';
import { toPng } from 'html-to-image';

const gif = new GIF({
  workers: 2,
  quality: 10,               // 1–30, lower = better/slower
  width, height,
  workerScript: gifWorkerUrl // Vite bundles the worker via ?url
});

for (let i = 0; i <= steps; i++) {
  await onStep(i);           // mutate app state to show step i
  await afterRender();       // Svelte's tick() — flush the DOM
  const dataUrl = await toPng(element, { width, height, backgroundColor: '#fff' });
  const img = await loadImage(dataUrl);
  gif.addFrame(img, { delay: 900 });   // 900ms per frame
}

gif.on('finished', (blob) => {         // download when encoding completes
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'order-flow.gif';
  a.click();
});
gif.render();
```

The one Vite-specific detail: `gif.js` runs its encoder in a **Web Worker**,
shipped as a separate `gif.worker.js`. Importing it as `gif.js/dist/gif.worker.js?url`
lets Vite bundle and hash it, and we pass that URL as `workerScript`. You can
confirm it's bundled — `npm run build` emits `dist/assets/gif.worker-*.js`.

In this app, `SequenceDiagram.svelte` wires the button to the helper:

```js
await recordGif({
  element: canvasEl,                 // the SVG canvas to snapshot
  steps: total,                      // number of messages
  onStep: (i) => { currentStep = i; },
  afterRender: tick,
  delay: 900,
  filename: `order-flow-${mode}.gif`,
});
```

### Other ways to get a GIF

| Approach | Best for | Notes |
|----------|----------|-------|
| **gif.js in-app** (this app) | discrete step-throughs | deterministic, one click, repeatable |
| **Screen recorder + ffmpeg** | the continuously animated graph edges | `ffmpeg -i rec.mp4 -vf "fps=15,scale=900:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse" out.gif` |
| **Puppeteer screenshot loop** | automated/CI capture of continuous motion | drive the running app headlessly, screenshot on an interval, encode with `gifencoder` |
| **PlantUML per-step PNGs + ImageMagick** | GIFs from the `.puml` side | render each step to PNG, then `convert -delay 90 -loop 0 step_*.png out.gif` |

The in-app gif.js path captures **discrete steps** (perfect for the sequence
walkthrough). For the *continuously* animated graph edges, a screen recorder or
Puppeteer captures the smooth motion better.

## Adapt it to your architecture

- **Nodes/edges** live at the top of [`src/App.svelte`](src/App.svelte) — edit
  the `nodes` and `edges` arrays and the `NODE_HINTS` popup text.
- **Sequence steps** live in the `steps` array in
  [`src/lib/SequenceDiagram.svelte`](src/lib/SequenceDiagram.svelte); each entry
  is `{ from, to, label, kind?, branch?, color?, note }`.
- **Colors** are defined once per file in a `COLORS` map — recolor there.
