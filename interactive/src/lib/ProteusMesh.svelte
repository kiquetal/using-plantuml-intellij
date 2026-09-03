<script>
  // ---------------------------------------------------------------------------
  // Proteus zero-trust mesh — Dark vs Live (allow) request flow.
  // Ported from proteus-oss/svelte-flow-test: two independent SvelteFlow graphs
  // showing the SPIRE + Envoy mTLS handshake when a workload is NOT admitted
  // (dark) vs admitted (live). Same node layout; only the edges differ.
  // ---------------------------------------------------------------------------
  import { SvelteFlow, Background, Controls, MiniMap } from '@xyflow/svelte';
  import '@xyflow/svelte/dist/style.css';
  import DownloadButton from './DownloadButton.svelte';

  const COLORS = {
    dark: '#b91c1c',      // blocked / not authorized (red)
    allow: '#15803d',     // authorized / live (green)
    control: '#7c3aed',   // control plane (purple)
    neutral: '#334155',   // data plane (slate)
  };

  function nodeStyle(bg) {
    return `background:${bg};color:#fff;border:1px solid rgba(0,0,0,.25);` +
           `border-radius:10px;padding:8px 10px;font-size:12px;` +
           `font-weight:600;width:170px;text-align:center;`;
  }

  function actionNodeStyle(bg) {
    return nodeStyle(bg) +
      `outline:3px solid #f59e0b;outline-offset:2px;` +
      `box-shadow:0 0 0 4px rgba(245,158,11,.35);`;
  }

  // Node layout — identical for both diagrams. Fresh copy per diagram so the
  // two <SvelteFlow> instances don't share mutable state.
  function buildNodes() {
    return [
      { id: 'spire-server', data: { label: 'SPIRE Server\n:8081 (signs SVIDs)' },
        position: { x: 300, y: 0 }, style: nodeStyle(COLORS.control) },
      { id: 'gatekeeper', data: { label: 'Gatekeeper\nAdmission Controller :8090' },
        position: { x: 560, y: 0 }, style: nodeStyle(COLORS.control) },
      { id: 'app-a', type: 'input', data: { label: 'service-a\nGo App :8080' },
        position: { x: 40, y: 150 }, style: nodeStyle(COLORS.neutral) },
      { id: 'envoy-a', data: { label: 'Envoy (service-a)\negress :9903' },
        position: { x: 40, y: 300 }, style: nodeStyle(COLORS.neutral) },
      { id: 'agent-a', data: { label: 'SPIRE Agent (a)\nSDS provider' },
        position: { x: 40, y: 450 }, style: nodeStyle(COLORS.control) },
      { id: 'envoy-b', data: { label: 'Envoy (service-b)\nmTLS ingress :9902' },
        position: { x: 560, y: 300 }, style: nodeStyle(COLORS.neutral) },
      { id: 'app-b', type: 'output', data: { label: 'service-b\nGo App :8080' },
        position: { x: 560, y: 150 }, style: nodeStyle(COLORS.neutral) },
      { id: 'agent-b', data: { label: 'SPIRE Agent (b)\nSDS provider' },
        position: { x: 560, y: 450 }, style: nodeStyle(COLORS.control) },
    ];
  }

  // Edges shared by both diagrams: plain-HTTP hops, node attestation (always
  // succeeds), and the Gatekeeper driving the SPIRE Server.
  function baseEdges() {
    return [
      { id: 'a-app-envoy', source: 'app-a', target: 'envoy-a',
        label: 'HTTP localhost:9903', animated: true, style: `stroke:${COLORS.neutral};` },
      { id: 'b-envoy-app', source: 'envoy-b', target: 'app-b',
        label: 'HTTP localhost:8080', style: `stroke:${COLORS.neutral};` },
      { id: 'agenta-spire', source: 'agent-a', target: 'spire-server',
        label: 'node attest :8081 (OK)', animated: true,
        style: `stroke:${COLORS.control};stroke-dasharray:4 3;` },
      { id: 'agentb-spire', source: 'agent-b', target: 'spire-server',
        label: 'node attest :8081 (OK)', animated: true,
        style: `stroke:${COLORS.control};stroke-dasharray:4 3;` },
      { id: 'gk-spire', source: 'gatekeeper', target: 'spire-server',
        label: 'admit / revoke (gRPC)', animated: true, style: `stroke:${COLORS.control};` },
    ];
  }

  // DARK: SPIRE Server refuses the SVID fetch, no cert, mTLS 503.
  function darkEdges() {
    return [
      ...baseEdges(),
      { id: 'd-spire-agenta', source: 'spire-server', target: 'agent-a',
        label: 'SVID fetch → NOT AUTHORIZED (no entry)', animated: true,
        style: `stroke:${COLORS.dark};stroke-width:2;stroke-dasharray:6 4;`,
        labelStyle: `fill:${COLORS.dark};font-weight:800;` },
      { id: 'd-agenta-envoya', source: 'agent-a', target: 'envoy-a',
        label: 'SDS — no SVID to deliver', animated: false,
        style: `stroke:${COLORS.dark};stroke-width:2;stroke-dasharray:2 3;`,
        labelStyle: `fill:${COLORS.dark};font-weight:700;` },
      { id: 'd-agentb-envoyb', source: 'agent-b', target: 'envoy-b',
        label: 'SDS — no SVID to deliver', animated: false,
        style: `stroke:${COLORS.dark};stroke-width:2;stroke-dasharray:2 3;`,
        labelStyle: `fill:${COLORS.dark};font-weight:700;` },
      { id: 'd-envoya-envoyb', source: 'envoy-a', target: 'envoy-b',
        label: 'mTLS :9902 — 503 UF (no cert)', animated: true,
        style: `stroke:${COLORS.dark};stroke-width:3;stroke-dasharray:6 4;`,
        labelStyle: `fill:${COLORS.dark};font-weight:800;` },
    ];
  }

  // ALLOW / LIVE: server signs SVID, mTLS 200.
  function allowEdges() {
    return [
      ...baseEdges(),
      { id: 'a-spire-agenta', source: 'spire-server', target: 'agent-a',
        label: 'SVID fetch → X.509 signed ✅', animated: true,
        style: `stroke:${COLORS.allow};stroke-width:2;`,
        labelStyle: `fill:${COLORS.allow};font-weight:800;` },
      { id: 'a-agenta-envoya', source: 'agent-a', target: 'envoy-a',
        label: 'SDS — X.509 SVID delivered', animated: true,
        style: `stroke:${COLORS.allow};stroke-width:2;`,
        labelStyle: `fill:${COLORS.allow};font-weight:700;` },
      { id: 'a-agentb-envoyb', source: 'agent-b', target: 'envoy-b',
        label: 'SDS — X.509 SVID delivered', animated: true,
        style: `stroke:${COLORS.allow};stroke-width:2;`,
        labelStyle: `fill:${COLORS.allow};font-weight:700;` },
      { id: 'a-envoya-envoyb', source: 'envoy-a', target: 'envoy-b',
        label: 'mTLS :9902 — 200 OK ✅', animated: true,
        style: `stroke:${COLORS.allow};stroke-width:3;`,
        labelStyle: `fill:${COLORS.allow};font-weight:800;` },
    ];
  }

  // Dark nodes: flag the boxes where admission must happen.
  function buildDarkNodes() {
    return buildNodes().map((n) => {
      if (n.id === 'gatekeeper') {
        return { ...n,
          data: { label: n.data.label + '\n⚠️ ADMIT HERE to allow the flow' },
          style: actionNodeStyle(COLORS.control) };
      }
      if (n.id === 'spire-server') {
        return { ...n,
          data: { label: n.data.label + '\n⛔ No entry → NOT AUTHORIZED' },
          style: actionNodeStyle(COLORS.control) };
      }
      return n;
    });
  }

  let darkNodes = $state(buildDarkNodes());
  let darkEdgeList = $state(darkEdges());
  let allowNodes = $state(buildNodes());
  let allowEdgeList = $state(allowEdges());

  // Click-to-show popup (dark diagram).
  let popup = $state(null);
  const NODE_HINTS = {
    gatekeeper: { title: '⚠️ Gatekeeper — action needed here',
      body: 'Call POST /admit {service_name} here. This creates the SPIRE registration entry that unblocks the flow.' },
    'spire-server': { title: '⛔ SPIRE Server — returns NOT AUTHORIZED',
      body: 'No workload entry exists, so the SVID fetch is refused. Once the Gatekeeper admits the service, the server signs the X.509 SVID.' },
    'envoy-a': { title: 'Envoy (service-a)',
      body: 'Has no certificate to present, so outbound mTLS fails with 503 UF.' },
    'agent-a': { title: 'SPIRE Agent (a)',
      body: 'Attested as a node, but has no workload SVID to deliver over SDS.' },
  };
  function onDarkNodeClick({ node }) {
    popup = NODE_HINTS[node.id] ?? {
      title: node.data.label.split('\n')[0],
      body: 'Part of the blocked path. Admit at the Gatekeeper to allow the flow.',
    };
  }
  function closePopup() { popup = null; }
</script>

<div class="proteus">
  <div class="diagram-block">
    <h3 class="dark">🔒 Dark — not admitted</h3>
    <p class="caption dark">
      Gatekeeper has NOT admitted <code>service-a</code>, so no workload
      registration entry exists. Node attestation succeeds, but when the Agent
      requests the workload SVID the <strong>SPIRE Server returns NOT AUTHORIZED</strong>.
      With no cert to deliver over SDS, Envoy can't complete mTLS and egress fails
      with <strong>503 UF</strong>. The service is invisible to the mesh.
    </p>
    <div class="flow-wrapper export-scope-proteus-dark">
      <SvelteFlow bind:nodes={darkNodes} bind:edges={darkEdgeList} onnodeclick={onDarkNodeClick} fitView>
        <Background />
        <Controls />
        <MiniMap />
        <DownloadButton filename="proteus-dark" scope="export-scope-proteus-dark" />
      </SvelteFlow>

      {#if popup}
        <div class="popup dark-popup">
          <button class="popup-close" onclick={closePopup} aria-label="Close">×</button>
          <div class="popup-title">{popup.title}</div>
          <div class="popup-body">{popup.body}</div>
        </div>
      {:else}
        <div class="hint">💡 Click a box (try <strong>Gatekeeper</strong>) to see why the flow is blocked.</div>
      {/if}
    </div>
    <div class="legend-bar">
      <span class="legend-title">Legend:</span>
      <span><span class="swatch" style="background:#7c3aed"></span> Control plane</span>
      <span><span class="swatch" style="background:#334155"></span> Data plane</span>
      <span><span class="line dashed red"></span> Not authorized / no cert</span>
      <span><span class="ring"></span> ⚠️ Action needed</span>
    </div>
  </div>

  <div class="diagram-block">
    <h3 class="allow">✅ Live — admitted</h3>
    <p class="caption allow">
      Gatekeeper admitted <code>service-a</code>. SPIRE Server signs an X.509 SVID,
      the Agent delivers it to Envoy via SDS, the mTLS handshake succeeds and the
      request returns <strong>200 OK</strong>.
    </p>
    <div class="flow-wrapper export-scope-proteus-allow">
      <SvelteFlow bind:nodes={allowNodes} bind:edges={allowEdgeList} fitView>
        <Background />
        <Controls />
        <MiniMap />
        <DownloadButton filename="proteus-live" scope="export-scope-proteus-allow" />
      </SvelteFlow>
    </div>
    <div class="legend-bar">
      <span class="legend-title">Legend:</span>
      <span><span class="swatch" style="background:#7c3aed"></span> Control plane</span>
      <span><span class="swatch" style="background:#334155"></span> Data plane</span>
      <span><span class="line solid green"></span> Authorized / SVID issued</span>
      <span><span class="line solid green"></span> mTLS 200 OK</span>
    </div>
  </div>
</div>

<style>
  .proteus { font-family: system-ui, sans-serif; }
  .diagram-block { margin-bottom: 2rem; }
  h3 { font-size: 1rem; margin: 0 0 0.25rem; }
  h3.dark { color: #b91c1c; }
  h3.allow { color: #15803d; }
  .caption {
    font-size: 0.82rem; padding: 0.5rem 0.7rem; border-radius: 6px; margin: 0 0 0.6rem;
  }
  .caption.dark { color: #b91c1c; background: #fef2f2; }
  .caption.allow { color: #15803d; background: #f0fdf4; }
  :global(.svelte-flow__node) { white-space: pre-line; }
  .flow-wrapper {
    position: relative; width: 100%; height: 55vh;
    border: 1px solid #ddd; border-radius: 8px; overflow: hidden;
  }
  .legend-bar {
    display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem 1.1rem;
    margin-top: 0.5rem; padding: 6px 10px; background: #fafafa;
    border: 1px solid #eee; border-radius: 6px; font-size: 0.74rem; color: #333;
  }
  .legend-title { font-weight: 700; }
  .swatch { display: inline-block; width: 12px; height: 12px; border-radius: 3px; vertical-align: middle; margin-right: 4px; }
  .line { display: inline-block; width: 22px; height: 0; vertical-align: middle; margin-right: 4px; }
  .line.solid { border-top: 3px solid; }
  .line.dashed { border-top: 3px dashed; }
  .line.red { border-color: #b91c1c; }
  .line.green { border-color: #15803d; }
  .ring {
    display: inline-block; width: 12px; height: 12px; border-radius: 3px;
    vertical-align: middle; margin-right: 4px; outline: 2px solid #f59e0b; outline-offset: 1px;
  }
  .popup {
    position: absolute; top: 10px; left: 10px; z-index: 5; max-width: 280px;
    font-size: 0.78rem; padding: 10px 26px 10px 12px; border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }
  .dark-popup {
    background: #fffbeb; border: 1px solid #f59e0b; color: #92400e;
    animation: pulse 1.8s ease-in-out infinite;
  }
  .popup-title { font-weight: 700; margin-bottom: 3px; }
  .popup-body { line-height: 1.4; }
  .popup-close {
    position: absolute; top: 4px; right: 6px; border: none; background: transparent;
    color: #92400e; font-size: 1.1rem; line-height: 1; cursor: pointer; padding: 2px 4px; opacity: 0.7;
  }
  .popup-close:hover { opacity: 1; }
  .hint {
    position: absolute; top: 10px; left: 10px; z-index: 5; max-width: 280px;
    font-size: 0.75rem; padding: 6px 10px; border-radius: 8px;
    background: rgba(255, 255, 255, 0.92); border: 1px dashed #cbd5e1; color: #475569;
  }
  @keyframes pulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.5); }
    50% { box-shadow: 0 0 0 6px rgba(245, 158, 11, 0); }
  }
</style>
