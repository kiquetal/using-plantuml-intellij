<script>
  // ---------------------------------------------------------------------------
  // GraphView.svelte — render ANY ArchSpec as an interactive SvelteFlow graph.
  // Pure consumer of the spec: colors come from core/theme, positions from
  // core/layout. Knows nothing about C4 or any specific project.
  // ---------------------------------------------------------------------------
  import { SvelteFlow, Background, Controls, MiniMap } from '@xyflow/svelte';
  import '@xyflow/svelte/dist/style.css';
  import DownloadButton from '../lib/DownloadButton.svelte';
  import { legendFor, resolveColors } from '../core/theme.js';
  import { autoLayout } from '../core/layout.js';

  let { spec, scope = 'export-scope-graph' } = $props();

  // role lookup for edge coloring (edge takes its SOURCE node's role color)
  const roleById = $derived(Object.fromEntries(spec.nodes.map((n) => [n.id, n.role])));
  // resolved colors: explicit wins, else role color varied per same-role index
  const colorById = $derived(resolveColors(spec.nodes));
  const positions = $derived(autoLayout(spec.nodes, spec.groups ?? []));

  // Inline node style from a concrete hex (mirrors theme.nodeStyle).
  const nodeStyleHex = (bg) =>
    `background:${bg};color:#fff;border:1px solid rgba(0,0,0,.25);` +
    `border-radius:10px;padding:8px 10px;font-size:12px;` +
    `font-weight:600;width:180px;text-align:center;`;

  let nodes = $state([]);
  let edges = $state([]);

  // Rebuild flow nodes/edges whenever the spec changes.
  $effect(() => {
    const memberNodes = spec.nodes.map((n) => ({
      id: n.id,
      data: { label: n.tech ? `${n.label}\n(${n.tech})` : n.label },
      position: positions[n.id] ?? { x: 0, y: 0 },
      style: nodeStyleHex(colorById[n.id]),
    }));

    // Group boundary boxes: a background rectangle enclosing each group's
    // members, drawn behind them with the cluster label. Preserves the
    // System_Boundary structure from the source C4 file.
    const NODE_W = 180, NODE_H = 56, PAD = 26;
    const groupBoxes = (spec.groups ?? [])
      .map((g) => {
        const pts = spec.nodes
          .filter((n) => n.group === g.id)
          .map((n) => positions[n.id])
          .filter(Boolean);
        if (!pts.length) return null;
        const minX = Math.min(...pts.map((p) => p.x)) - PAD;
        const minY = Math.min(...pts.map((p) => p.y)) - PAD - 18;
        const maxX = Math.max(...pts.map((p) => p.x)) + NODE_W + PAD;
        const maxY = Math.max(...pts.map((p) => p.y)) + NODE_H + PAD;
        return {
          id: `group-${g.id}`,
          data: { label: g.label },
          position: { x: minX, y: minY },
          style: `width:${maxX - minX}px;height:${maxY - minY}px;` +
                 `background:rgba(100,116,139,0.06);border:1.5px dashed #94a3b8;` +
                 `border-radius:12px;color:#475569;font-size:12px;font-weight:700;` +
                 `text-align:left;padding:4px 8px;`,
          selectable: false,
          draggable: false,
          zIndex: -1,
        };
      })
      .filter(Boolean);

    nodes = [...groupBoxes, ...memberNodes];
    edges = spec.edges.map((e, i) => ({
      id: `e${i}-${e.from}-${e.to}`,
      source: e.from,
      target: e.to,
      label: e.label,
      animated: !!e.async,
      style: `stroke:${colorById[e.from]};` + (e.async ? 'stroke-dasharray:5 4;' : ''),
    }));
  });

  const legend = $derived(legendFor(spec.nodes));

  let popup = $state(null);
  function onNodeClick({ node }) {
    const n = spec.nodes.find((x) => x.id === node.id);
    popup = n ? { title: n.label, body: n.description ?? (n.tech ? `Tech: ${n.tech}` : '') } : null;
  }
  function closePopup() { popup = null; }
</script>

<div class="flow-wrapper {scope}">
  <SvelteFlow bind:nodes bind:edges onnodeclick={onNodeClick} fitView>
    <Background />
    <Controls />
    <MiniMap />
    <DownloadButton filename="graph" {scope} />
  </SvelteFlow>

  {#if popup}
    <div class="popup">
      <button class="popup-close" onclick={closePopup} aria-label="Close">×</button>
      <div class="popup-title">{popup.title}</div>
      {#if popup.body}<div class="popup-body">{popup.body}</div>{/if}
    </div>
  {:else}
    <div class="hint">💡 Click a node for details. Drag to rearrange, scroll to zoom.</div>
  {/if}
</div>

<div class="legend-bar">
  <span class="legend-title">Legend:</span>
  {#each legend as l}
    <span><span class="swatch" style="background:{l.color}"></span> {l.label}</span>
  {/each}
</div>

<style>
  :global(.svelte-flow__node) { white-space: pre-line; }
  .flow-wrapper {
    position: relative; width: 100%; height: 60vh;
    border: 1px solid #ddd; border-radius: 8px; overflow: hidden;
  }
  .legend-bar {
    display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem 1.1rem;
    margin-top: 0.5rem; padding: 6px 10px; background: #fafafa;
    border: 1px solid #eee; border-radius: 6px; font-size: 0.74rem; color: #333;
  }
  .legend-title { font-weight: 700; }
  .swatch { display: inline-block; width: 12px; height: 12px; border-radius: 3px; vertical-align: middle; margin-right: 4px; }
  .popup {
    position: absolute; top: 10px; left: 10px; z-index: 5; max-width: 300px;
    font-size: 0.8rem; padding: 10px 26px 10px 12px; border-radius: 8px;
    background: #fff; border: 1px solid #cbd5e1; box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  }
  .popup-title { font-weight: 700; margin-bottom: 3px; }
  .popup-body { line-height: 1.4; color: #475569; }
  .popup-close {
    position: absolute; top: 4px; right: 6px; border: none; background: transparent;
    font-size: 1.1rem; line-height: 1; cursor: pointer; padding: 2px 4px; opacity: 0.6;
  }
  .popup-close:hover { opacity: 1; }
  .hint {
    position: absolute; top: 10px; left: 10px; z-index: 5; max-width: 300px;
    font-size: 0.75rem; padding: 6px 10px; border-radius: 8px;
    background: rgba(255,255,255,0.92); border: 1px dashed #cbd5e1; color: #475569;
  }
</style>
