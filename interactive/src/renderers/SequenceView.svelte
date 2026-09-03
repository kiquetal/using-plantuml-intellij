<script>
  // ---------------------------------------------------------------------------
  // SequenceView.svelte — render ANY ArchSpec.flow as an animated step-through.
  // SVG lifelines + ordered arrows, Play/Prev/Next/Reset, and Record GIF.
  // Actor order and colors come from core (sequenceOrder + theme), so every
  // project's sequence looks unified.
  // ---------------------------------------------------------------------------
  import { tick } from 'svelte';
  import { recordGif } from '../lib/gifRecorder.js';
  import { arrowColor } from '../core/theme.js';
  import { sequenceOrder } from '../core/layout.js';

  let { spec } = $props();

  // Actors = only the nodes that participate in the flow, in role order.
  const actors = $derived.by(() => {
    const used = new Set();
    for (const s of spec.flow ?? []) { used.add(s.from); used.add(s.to); }
    return sequenceOrder(spec.nodes.filter((n) => used.has(n.id)))
      .map((n) => ({ id: n.id, label: n.label, role: n.role }));
  });

  const roleById = $derived(Object.fromEntries(spec.nodes.map((n) => [n.id, n.role])));

  // --- Layout constants ----------------------------------------------------
  const COL_W = 190;
  const MARGIN_X = 110;
  const HEAD_Y = 44;
  const HEAD_H = 40;
  const FIRST_MSG_Y = 140;
  const ROW_H = 66;

  const WIDTH = $derived(MARGIN_X * 2 + COL_W * Math.max(actors.length - 1, 1));
  const actorX = $derived(Object.fromEntries(actors.map((a, i) => [a.id, MARGIN_X + i * COL_W])));

  // --- Interactive state ---------------------------------------------------
  let currentStep = $state(0);
  let playing = $state(false);
  let recording = $state(false);
  let recordMsg = $state('');
  let timer = null;
  let svgEl = $state();

  const laidOut = $derived((spec.flow ?? []).map((s, i) => ({ ...s, y: FIRST_MSG_Y + i * ROW_H, idx: i })));
  const total = $derived(laidOut.length);
  const visible = $derived(laidOut.slice(0, currentStep));
  const lifelineBottom = $derived(FIRST_MSG_Y + total * ROW_H + 10);
  const svgHeight = $derived(lifelineBottom + 20);
  const caption = $derived(
    currentStep === 0
      ? 'Press ▶ Play or Next to walk through the flow.'
      : (laidOut[currentStep - 1].note || laidOut[currentStep - 1].label),
  );

  function next() { if (currentStep < total) currentStep += 1; if (currentStep >= total) stop(); }
  function prev() { if (currentStep > 0) currentStep -= 1; }
  function reset() { currentStep = 0; stop(); }
  function stop() { playing = false; if (timer) { clearInterval(timer); timer = null; } }
  function play() {
    if (playing) { stop(); return; }
    if (currentStep >= total) currentStep = 0;
    playing = true;
    timer = setInterval(() => { if (currentStep >= total) { stop(); return; } currentStep += 1; }, 1100);
  }

  async function record() {
    if (recording) return;
    stop();
    recording = true;
    recordMsg = 'Recording…';
    try {
      await recordGif({
        element: svgEl, steps: total,
        onStep: (i) => { currentStep = i; },
        afterRender: tick,
        width: WIDTH, height: svgHeight, delay: 900,
        filename: `${(spec.title || 'flow').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.gif`,
        onProgress: (done, all) => { recordMsg = `Encoding ${done}/${all}…`; },
      });
      recordMsg = 'GIF downloaded ✓';
    } catch (e) {
      recordMsg = 'Failed: ' + e.message;
    } finally {
      recording = false;
      setTimeout(() => { recordMsg = ''; }, 2500);
    }
  }

  function arrowGeom(s) {
    const x1 = actorX[s.from], x2 = actorX[s.to];
    const dir = x2 >= x1 ? 1 : -1;
    return { x1, xEnd: x2 - dir * 6, dir, mid: (x1 + x2) / 2, self: s.from === s.to };
  }

  const activeActors = $derived(
    currentStep > 0 ? new Set([laidOut[currentStep - 1].from, laidOut[currentStep - 1].to]) : new Set(),
  );
</script>

{#if total === 0}
  <p class="empty">This spec has no <code>flow</code> steps. Import a C4 Dynamic diagram with <code>--flow</code> to add a sequence.</p>
{:else}
<div class="seq">
  <div class="controls">
    <button onclick={prev} disabled={currentStep === 0 || recording}>◀ Prev</button>
    <button onclick={play} disabled={recording}>{playing ? '⏸ Pause' : '▶ Play'}</button>
    <button onclick={next} disabled={currentStep >= total || recording}>Next ▶</button>
    <button onclick={reset} disabled={recording}>⟲ Reset</button>
    <span class="counter">{currentStep} / {total}</span>
    <button class="rec" onclick={record} disabled={recording}>● Record GIF</button>
    {#if recordMsg}<span class="recmsg">{recordMsg}</span>{/if}
  </div>

  <div class="canvas">
    <svg bind:this={svgEl} viewBox={`0 0 ${WIDTH} ${svgHeight}`} width={WIDTH} height={svgHeight} style="min-width:{WIDTH}px;display:block;">
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="context-stroke" />
        </marker>
      </defs>

      {#each actors as a}
        <line x1={actorX[a.id]} y1={HEAD_Y + HEAD_H} x2={actorX[a.id]} y2={lifelineBottom} stroke="#cbd5e1" stroke-dasharray="4 4" />
        <g class:active={activeActors.has(a.id)}>
          <rect x={actorX[a.id] - 75} y={HEAD_Y} width="150" height={HEAD_H} rx="8" fill={activeActors.has(a.id) ? '#1e293b' : arrowColor(a.role)} />
          <text x={actorX[a.id]} y={HEAD_Y + HEAD_H / 2 + 5} text-anchor="middle" fill="#fff" font-size="14" font-weight="600">{a.label}</text>
        </g>
      {/each}

      {#each visible as s (s.label + s.y)}
        {@const c = arrowColor(roleById[s.from])}
        {@const g = arrowGeom(s)}
        <g class="msg" class:current={s.idx === currentStep - 1}>
          {#if g.self}
            <text x={actorX[s.from] + 12} y={s.y - 9} text-anchor="start" font-size="13" font-weight="600" fill={c}>{s.label}</text>
            <path d={`M ${actorX[s.from]} ${s.y} h 26 v 18 h -26`} fill="none" stroke={c} stroke-width="2" marker-end="url(#arrow)" />
          {:else}
            <text x={g.mid} y={s.y - 9} text-anchor="middle" font-size="13" font-weight="600" fill={c}>{s.label}</text>
            <line x1={g.x1} y1={s.y} x2={g.xEnd} y2={s.y} stroke={c} stroke-width="2.2" stroke-dasharray={s.kind === 'return' ? '5 4' : 'none'} marker-end="url(#arrow)" />
          {/if}
        </g>
      {/each}
    </svg>
  </div>

  <p class="caption"><strong>Step {currentStep}:</strong> {caption}</p>
</div>
{/if}

<style>
  .seq { font-family: system-ui, sans-serif; }
  .empty { font-size: 0.85rem; color: #64748b; background: #f8fafc; padding: 0.7rem; border-radius: 6px; }
  .controls { display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap; margin-bottom: 0.5rem; }
  button {
    cursor: pointer; border: 1px solid #cbd5e1; background: #fff; border-radius: 6px;
    padding: 5px 10px; font-size: 0.8rem; font-weight: 600; color: #1e293b;
  }
  button:disabled { opacity: 0.4; cursor: default; }
  button:hover:not(:disabled) { background: #f1f5f9; }
  .rec { border-color: #b91c1c; color: #b91c1c; }
  .rec:hover:not(:disabled) { background: #fef2f2; }
  .counter { font-size: 0.78rem; color: #64748b; margin-left: 0.3rem; }
  .recmsg { font-size: 0.76rem; color: #7c3aed; font-weight: 600; }
  .canvas { border: 1px solid #ddd; border-radius: 8px; background: #fff; padding: 4px; overflow-x: auto; }
  .msg.current { animation: appear 0.35s ease-out; }
  @keyframes appear { from { opacity: 0; } to { opacity: 1; } }
  .caption { margin: 0.6rem 0 0; font-size: 0.85rem; padding: 0.5rem 0.7rem; border-radius: 6px; background: #f8fafc; color: #334155; }
</style>
