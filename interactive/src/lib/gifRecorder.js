// ---------------------------------------------------------------------------
// gifRecorder.js — turn a sequence of DOM states into an animated GIF.
//
// How it works:
//   1. For each step, snapshot a DOM element to a PNG data URL (html-to-image).
//   2. Load that PNG into an <img> and hand it to gif.js as one frame.
//   3. gif.js encodes all frames (in a Web Worker) into a single .gif Blob.
//
// gif.js ships a separate worker script (gif.worker.js). With Vite we import
// it as a URL (?url) so it gets bundled and hashed correctly in production.
// ---------------------------------------------------------------------------
import GIF from 'gif.js';
import gifWorkerUrl from 'gif.js/dist/gif.worker.js?url';
import { toPng } from 'html-to-image';

/**
 * Load a data URL into an HTMLImageElement (gif.js needs a real image/canvas).
 * @param {string} src
 * @returns {Promise<HTMLImageElement>}
 */
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Record an animated GIF by stepping through states.
 *
 * @param {object}  opts
 * @param {HTMLElement} opts.element   DOM node to capture each frame from.
 * @param {number}  opts.steps         How many steps to advance through.
 * @param {(i:number)=>void|Promise<void>} opts.onStep  Called before each frame
 *        with the step index; should mutate app state to render that step.
 * @param {()=>Promise<void>} opts.afterRender  Await this so Svelte flushes the
 *        DOM before we snapshot (pass Svelte's `tick`).
 * @param {number}  [opts.width=900]   Output width in px.
 * @param {number}  [opts.height=600]  Output height in px.
 * @param {number}  [opts.delay=900]   Milliseconds each frame is shown.
 * @param {string}  [opts.filename='diagram.gif']
 * @param {(done:number,total:number)=>void} [opts.onProgress] capture progress.
 * @returns {Promise<Blob>} the encoded GIF (also triggers a download).
 */
export async function recordGif({
  element,
  steps,
  onStep,
  afterRender,
  width = 900,
  height = 600,
  delay = 900,
  filename = 'diagram.gif',
  onProgress,
}) {
  const gif = new GIF({
    workers: 2,
    quality: 10,          // lower = better quality, slower (1–30)
    width,
    height,
    workerScript: gifWorkerUrl,
    background: '#ffffff',
  });

  // Capture one frame per step (step 0 = initial state).
  for (let i = 0; i <= steps; i++) {
    await onStep(i);          // mutate state to reveal step i
    await afterRender();      // let Svelte re-render the DOM
    const dataUrl = await toPng(element, {
      backgroundColor: '#ffffff',
      width,
      height,
      style: { width: `${width}px`, height: `${height}px` },
    });
    const img = await loadImage(dataUrl);
    gif.addFrame(img, { delay });
    onProgress?.(i + 1, steps + 1);
  }

  // Encode (runs in the worker) and resolve with the finished Blob.
  return new Promise((resolve) => {
    gif.on('finished', (blob) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
      resolve(blob);
    });
    gif.render();
  });
}
