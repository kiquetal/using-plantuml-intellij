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

  let { spec } = $props();

  // Actors = nodes that appear in the flow (messages or notes), kept in the
  // spec's declaration order (sequence diagrams are order-sensitive).
  const actors = $derived.by(() => {
    const used = new Set();
    for (const s of spec.flow ?? []) {
      if (s.from) used.add(s.from);
      if (s.to) used.add(s.to);
      if (s.over) for (const o of s.over) used.add(o);
    }
    // preserve spec.nodes order; append any implicit ids not declared
    const ordered = spec.nodes.filter((n) => used.has(n.id));
    const declared = new Set(ordered.map((n) => n.id));
    for (const id of used) if (!declared.has(id)) ordered.push({ id, label: id, role: 'service' });
    return ordered.map((n) => ({ id: n.id, label: n.label, role: n.role }));
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

  // Assign vertical rows only to items that occupy space (messages + notes).
  // Frames (alt/loop) are overlays spanning their child rows; activate/
  // deactivate are metadata that don't consume a row.
  const layout = $derived.by(() => {
    const items = spec.flow ?? [];
    const rows = [];        // renderable rows in reveal order (messages + notes)
    const frames = [];      // { type, label, startRow, endRow, elses: [{label,row}] }
    const openFrames = [];
    let rowIdx = 0;
    for (const it of items) {
      if (it.kind === 'frame-start') {
        openFrames.push({ type: it.type, label: it.label, startRow: rowIdx, endRow: rowIdx, elses: [] });
      } else if (it.kind === 'frame-else') {
        const f = openFrames[openFrames.length - 1];
        if (f) f.elses.push({ label: it.label, row: rowIdx });
      } else if (it.kind === 'frame-end') {
        const f = openFrames.pop();
        if (f) { f.endRow = rowIdx; frames.push(f); }
      } else if (it.kind === 'activate' || it.kind === 'deactivate') {
        // metadata only
      } else {
        rows.push({ ...it, row: rowIdx, y: FIRST_MSG_Y + rowIdx * ROW_H });
        rowIdx += 1;
      }
    }
    return { rows, frames, rowCount: rowIdx };
  });

  const rows = $derived(layout.rows);
  const total = $derived(rows.length);
  const visible = $derived(rows.slice(0, currentStep));
  const lifelineBottom = $derived(FIRST_MSG_Y + layout.rowCount * ROW_H + 10);
  const svgHeight = $derived(lifelineBottom + 20);

  // Frames whose start row is already revealed (draw their box progressively).
  const visibleFrames = $derived(
    layout.frames.filter((f) => currentStep > f.startRow),
  );

  const caption = $derived(
    currentStep === 0
      ? 'Press ▶ Play or Next to walk through the flow.'
      : (rows[currentStep - 1]?.note || rows[currentStep - 1]?.label || ''),
  );

  function frameBox(f) {
    const y1 = FIRST_MSG_Y + f.startRow * ROW_H - 30;
    const yEnd = FIRST_MSG_Y + Math.min(f.endRow, currentStep) * ROW_H - 10;
    return { x: 20, y: y1, w: WIDTH - 40, h: Math.max(yEnd - y1, ROW_H) };
  }

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

  const activeActors = $derived.by(() => {
    if (currentStep === 0) return new Set();
    const r = rows[currentStep - 1];
    if (!r) return new Set();
    if (r.over) return new Set(r.over);
    return new Set([r.from, r.to]);
  });
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

      <!-- alt/loop/opt frame boxes (drawn behind messages) -->
      {#each visibleFrames as f}
        {@const b = frameBox(f)}
        <g class="frame">
          <rect x={b.x} y={b.y} width={b.w} height={b.h} rx="6" fill="rgba(84,153,199,0.05)" stroke="#5499c7" stroke-dasharray="4 3" />
          <rect x={b.x} y={b.y} width="52" height="18" fill="#5499c7" />
          <text x={b.x + 26} y={b.y + 13} text-anchor="middle" fill="#fff" font-size="11" font-weight="700">{f.type}</text>
          {#if f.label}<text x={b.x + 60} y={b.y + 13} font-size="11" font-weight="700" fill="#21618c">{f.label}</text>{/if}
          {#each f.elses as e}
            {#if currentStep > e.row}
              {@const ey = FIRST_MSG_Y + e.row * ROW_H - 30}
              <line x1={b.x} y1={ey} x2={b.x + b.w} y2={ey} stroke="#5499c7" stroke-dasharray="4 3" />
              <text x={b.x + 8} y={ey + 13} font-size="11" font-weight="700" fill="#21618c">else {e.label}</text>
            {/if}
          {/each}
        </g>
      {/each}

      {#each visible as s (s.kind + '-' + s.row)}
        {@const isCurrent = s.row === currentStep - 1}
        {#if s.over}
          <!-- note over participant(s) -->
          {@const xs = s.over.map((o) => actorX[o]).filter((v) => v != null)}
          {@const nx = (Math.min(...xs) + Math.max(...xs)) / 2}
          <g class="msg" class:current={isCurrent}>
            <rect x={nx - 90} y={s.y - 16} width="180" height="30" rx="4" fill="#fff8dc" stroke="#d4ac0d" />
            <text x={nx} y={s.y + 4} text-anchor="middle" font-size="11" fill="#7a5c00">{s.label}</text>
          </g>
        {:else}
          {@const c = arrowColor(roleById[s.from])}
          {@const g = arrowGeom(s)}
          <g class="msg" class:current={isCurrent}>
            {#if g.self}
              <text x={actorX[s.from] + 12} y={s.y - 9} text-anchor="start" font-size="13" font-weight="600" fill={c}>{s.label}</text>
              <path d={`M ${actorX[s.from]} ${s.y} h 26 v 18 h -26`} fill="none" stroke={c} stroke-width="2" marker-end="url(#arrow)" />
            {:else}
              <text x={g.mid} y={s.y - 9} text-anchor="middle" font-size="13" font-weight="600" fill={c}>{s.label}</text>
              <line x1={g.x1} y1={s.y} x2={g.xEnd} y2={s.y} stroke={c} stroke-width="2.2" stroke-dasharray={s.kind === 'return' ? '5 4' : 'none'} marker-end="url(#arrow)" />
            {/if}
          </g>
        {/if}
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
