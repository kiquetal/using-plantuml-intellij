<script>
  // ---------------------------------------------------------------------------
  // Interactive sequence diagram for the E-Commerce order-placement flow.
  // Pure SVG: actor lifelines + ordered message arrows revealed step by step.
  // A happy/failed toggle swaps the outcome at the payment branch point.
  // Includes a "Record GIF" button that walks the steps and encodes a GIF.
  // ---------------------------------------------------------------------------
  import { tick } from 'svelte';
  import { recordGif } from './gifRecorder.js';

  const COLORS = {
    fail: '#b91c1c',
    ok: '#15803d',
    async: '#7c3aed',
    neutral: '#334155',
    muted: '#cbd5e1',
  };

  // Actors, left-to-right. Index → column.
  const actors = [
    { id: 'customer', label: 'Customer' },
    { id: 'gateway', label: 'API Gateway' },
    { id: 'order', label: 'Order Svc' },
    { id: 'payment', label: 'Payment Svc' },
    { id: 'db', label: 'Postgres' },
    { id: 'kafka', label: 'Kafka' },
  ];

  // Ordered messages. `branch` = only shown in that mode. `kind: return` = dashed.
  const steps = [
    { from: 'customer', to: 'gateway', label: 'POST /orders', note: 'Customer submits the cart to the API Gateway.' },
    { from: 'gateway', to: 'order', label: 'createOrder(cart)', note: 'Gateway routes the request to the Order Service.' },
    { from: 'order', to: 'db', label: 'INSERT order (PENDING)', color: COLORS.neutral, note: 'Order persisted in a PENDING state.' },
    { from: 'db', to: 'order', label: 'orderId', kind: 'return', color: COLORS.neutral, note: 'Database returns the new order id.' },
    { from: 'order', to: 'payment', label: 'charge(orderId, amount)', note: 'Synchronous call to the Payment Service.' },

    // --- HAPPY branch ---
    { from: 'payment', to: 'order', label: 'paymentConfirmed', kind: 'return', branch: 'happy', color: COLORS.ok, note: 'Payment succeeded.' },
    { from: 'order', to: 'db', label: 'UPDATE order (CONFIRMED)', branch: 'happy', color: COLORS.ok, note: 'Order marked CONFIRMED.' },
    { from: 'order', to: 'kafka', label: 'publish OrderConfirmed', branch: 'happy', color: COLORS.async, note: 'Async event published — no waiting on consumers.' },
    { from: 'order', to: 'gateway', label: '201 Created', kind: 'return', branch: 'happy', color: COLORS.ok, note: 'Success response bubbles up.' },
    { from: 'gateway', to: 'customer', label: 'HTTP 201', kind: 'return', branch: 'happy', color: COLORS.ok, note: 'Customer sees order confirmed.' },

    // --- FAILED branch ---
    { from: 'payment', to: 'order', label: 'paymentDeclined', kind: 'return', branch: 'failed', color: COLORS.fail, note: 'Payment was declined.' },
    { from: 'order', to: 'db', label: 'UPDATE order (FAILED)', branch: 'failed', color: COLORS.fail, note: 'Order marked FAILED.' },
    { from: 'order', to: 'gateway', label: '402 Payment Required', kind: 'return', branch: 'failed', color: COLORS.fail, note: 'Failure response bubbles up.' },
    { from: 'gateway', to: 'customer', label: 'HTTP 402', kind: 'return', branch: 'failed', color: COLORS.fail, note: 'Customer is told payment failed.' },
  ];

  // --- Layout constants ----------------------------------------------------
  const COL_W = 150;
  const MARGIN_X = 80;
  const HEAD_Y = 40;
  const HEAD_H = 34;
  const FIRST_MSG_Y = 120;
  const ROW_H = 58;
  const WIDTH = MARGIN_X * 2 + COL_W * (actors.length - 1);

  const actorX = Object.fromEntries(
    actors.map((a, i) => [a.id, MARGIN_X + i * COL_W]),
  );

  // --- Interactive state ---------------------------------------------------
  let mode = $state('happy');     // 'happy' | 'failed'
  let currentStep = $state(0);    // how many messages revealed
  let playing = $state(false);
  let recording = $state(false);
  let recordMsg = $state('');
  let timer = null;

  const activeSteps = $derived(steps.filter((s) => !s.branch || s.branch === mode));
  const laidOut = $derived(
    activeSteps.map((s, i) => ({ ...s, y: FIRST_MSG_Y + i * ROW_H, idx: i })),
  );
  const total = $derived(laidOut.length);
  const visible = $derived(laidOut.slice(0, currentStep));
  const lifelineBottom = $derived(FIRST_MSG_Y + total * ROW_H + 10);
  const svgHeight = $derived(lifelineBottom + 20);

  const caption = $derived(
    currentStep === 0
      ? 'Press ▶ Play or Next to walk through the order flow.'
      : laidOut[currentStep - 1].note,
  );

  function setMode(m) { mode = m; currentStep = 0; stop(); }
  function next() { if (currentStep < total) currentStep += 1; if (currentStep >= total) stop(); }
  function prev() { if (currentStep > 0) currentStep -= 1; }
  function reset() { currentStep = 0; stop(); }
  function stop() { playing = false; if (timer) { clearInterval(timer); timer = null; } }
  function play() {
    if (playing) { stop(); return; }
    if (currentStep >= total) currentStep = 0;
    playing = true;
    timer = setInterval(() => {
      if (currentStep >= total) { stop(); return; }
      currentStep += 1;
    }, 1100);
  }

  let canvasEl; // .canvas wrapper (unused for capture)
  let svgEl;    // the actual SVG we snapshot for the GIF

  // Record a GIF: reset, then reveal each step and capture a frame.
  async function record() {
    if (recording) return;
    stop();
    recording = true;
    recordMsg = 'Recording…';
    try {
      await recordGif({
        element: svgEl,
        steps: total,
        onStep: (i) => { currentStep = i; },
        afterRender: tick,
        width: WIDTH,
        height: svgHeight,
        delay: 900,
        filename: `order-flow-${mode}.gif`,
        onProgress: (done, all) => { recordMsg = `Encoding frame ${done}/${all}…`; },
      });
      recordMsg = 'GIF downloaded ✓';
    } catch (e) {
      recordMsg = 'Recording failed: ' + e.message;
    } finally {
      recording = false;
      setTimeout(() => { recordMsg = ''; }, 2500);
    }
  }

  function arrowGeom(s) {
    const x1 = actorX[s.from];
    const x2 = actorX[s.to];
    const dir = x2 >= x1 ? 1 : -1;
    const xEnd = x2 - dir * 6;
    return { x1, xEnd, dir, mid: (x1 + x2) / 2 };
  }

  const activeActors = $derived(
    currentStep > 0
      ? new Set([laidOut[currentStep - 1].from, laidOut[currentStep - 1].to])
      : new Set(),
  );
</script>

<div class="seq">
  <div class="toolbar">
    <div class="modes">
      <button class:active={mode === 'happy'} class="mode ok" onclick={() => setMode('happy')}>✅ Happy path</button>
      <button class:active={mode === 'failed'} class="mode fail" onclick={() => setMode('failed')}>❌ Payment failed</button>
    </div>
    <div class="controls">
      <button onclick={prev} disabled={currentStep === 0 || recording}>◀ Prev</button>
      <button onclick={play} disabled={recording}>{playing ? '⏸ Pause' : '▶ Play'}</button>
      <button onclick={next} disabled={currentStep >= total || recording}>Next ▶</button>
      <button onclick={reset} disabled={recording}>⟲ Reset</button>
      <span class="counter">{currentStep} / {total}</span>
      <button class="rec" onclick={record} disabled={recording}>● Record GIF</button>
      {#if recordMsg}<span class="recmsg">{recordMsg}</span>{/if}
    </div>
  </div>

  <div class="canvas" class:ok={mode === 'happy'} class:fail={mode === 'failed'} bind:this={canvasEl}>
    <svg bind:this={svgEl} viewBox={`0 0 ${WIDTH} ${svgHeight}`} width="100%" preserveAspectRatio="xMidYMin meet">
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="context-stroke" />
        </marker>
      </defs>

      {#each actors as a}
        <line
          x1={actorX[a.id]} y1={HEAD_Y + HEAD_H}
          x2={actorX[a.id]} y2={lifelineBottom}
          stroke={COLORS.muted} stroke-dasharray="4 4"
        />
        <g class="actor" class:active={activeActors.has(a.id)}>
          <rect
            x={actorX[a.id] - 55} y={HEAD_Y}
            width="110" height={HEAD_H} rx="7"
            fill={activeActors.has(a.id) ? '#1e293b' : '#334155'}
          />
          <text x={actorX[a.id]} y={HEAD_Y + HEAD_H / 2 + 4} text-anchor="middle" fill="#fff" font-size="12" font-weight="600">
            {a.label}
          </text>
        </g>
      {/each}

      {#each visible as s (s.label + s.y)}
        {@const c = s.color ?? COLORS.neutral}
        {@const g = arrowGeom(s)}
        <g class="msg" class:current={s.idx === currentStep - 1}>
          <text x={g.mid} y={s.y - 8} text-anchor="middle" font-size="11" font-weight="600" fill={c}>
            {s.label}
          </text>
          <line
            x1={g.x1} y1={s.y} x2={g.xEnd} y2={s.y}
            stroke={c} stroke-width="2"
            stroke-dasharray={s.kind === 'return' ? '5 4' : 'none'}
            marker-end="url(#arrow)"
          />
        </g>
      {/each}
    </svg>
  </div>

  <p class="caption" class:ok={mode === 'happy'} class:fail={mode === 'failed'}>
    <strong>Step {currentStep}:</strong> {caption}
  </p>
</div>

<style>
  .seq { font-family: system-ui, sans-serif; }
  .toolbar {
    display: flex; justify-content: space-between; align-items: center;
    gap: 1rem; flex-wrap: wrap; margin-bottom: 0.5rem;
  }
  .modes, .controls { display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap; }
  button {
    cursor: pointer; border: 1px solid #cbd5e1; background: #fff;
    border-radius: 6px; padding: 5px 10px; font-size: 0.8rem;
    font-weight: 600; color: #1e293b;
  }
  button:disabled { opacity: 0.4; cursor: default; }
  button:hover:not(:disabled) { background: #f1f5f9; }
  .mode.fail.active { background: #b91c1c; color: #fff; border-color: #b91c1c; }
  .mode.ok.active { background: #15803d; color: #fff; border-color: #15803d; }
  .rec { border-color: #b91c1c; color: #b91c1c; }
  .rec:hover:not(:disabled) { background: #fef2f2; }
  .counter { font-size: 0.78rem; color: #64748b; margin-left: 0.3rem; }
  .recmsg { font-size: 0.76rem; color: #7c3aed; font-weight: 600; }

  .canvas {
    border: 1px solid #ddd; border-radius: 8px; background: #fff;
    padding: 4px; overflow-x: auto;
  }
  .canvas.fail { border-color: #fecaca; }
  .canvas.ok { border-color: #bbf7d0; }

  .msg.current { animation: appear 0.35s ease-out; transform-box: fill-box; }
  @keyframes appear { from { opacity: 0; } to { opacity: 1; } }

  .caption {
    margin: 0.6rem 0 0; font-size: 0.85rem; padding: 0.5rem 0.7rem;
    border-radius: 6px; background: #f8fafc; color: #334155;
  }
  .caption.fail { background: #fef2f2; color: #b91c1c; }
  .caption.ok { background: #f0fdf4; color: #15803d; }
</style>
