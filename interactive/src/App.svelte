<script>
  import { SvelteFlow, Background, Controls, MiniMap } from '@xyflow/svelte';
  import '@xyflow/svelte/dist/style.css';
  import DownloadButton from './lib/DownloadButton.svelte';
  import SequenceDiagram from './lib/SequenceDiagram.svelte';
  import ProteusMesh from './lib/ProteusMesh.svelte';

  // Interactive C4 Level-2 (Container) view of the E-Commerce platform,
  // mirroring c4_2_container.puml: API Gateway, Order/Payment services,
  // Postgres, Kafka, and external actors.
  const COLORS = {
    edge: '#2563eb',      // gateway / edge (blue)
    service: '#7c3aed',   // internal services (purple)
    data: '#15803d',      // datastore (green)
    async: '#b45309',     // messaging (amber)
    external: '#334155',  // external systems / actors (slate)
  };

  function nodeStyle(bg) {
    return `background:${bg};color:#fff;border:1px solid rgba(0,0,0,.25);` +
           `border-radius:10px;padding:8px 10px;font-size:12px;` +
           `font-weight:600;width:180px;text-align:center;`;
  }

  let nodes = $state([
    { id: 'customer', type: 'input', data: { label: 'Customer\n(Web / Mobile)' },
      position: { x: 40, y: 20 }, style: nodeStyle(COLORS.external) },
    { id: 'gateway', data: { label: 'API Gateway\n(Kong) — routing, auth' },
      position: { x: 40, y: 160 }, style: nodeStyle(COLORS.edge) },
    { id: 'order', data: { label: 'Order Service\n(Kubernetes)' },
      position: { x: 320, y: 160 }, style: nodeStyle(COLORS.service) },
    { id: 'payment', data: { label: 'Payment Service\n(Kubernetes)' },
      position: { x: 320, y: 320 }, style: nodeStyle(COLORS.service) },
    { id: 'db', data: { label: 'PostgreSQL\norders / payments' },
      position: { x: 600, y: 160 }, style: nodeStyle(COLORS.data) },
    { id: 'kafka', data: { label: 'Kafka\nevent bus' },
      position: { x: 600, y: 320 }, style: nodeStyle(COLORS.async) },
    { id: 'stripe', type: 'output', data: { label: 'Stripe\n(external payments)' },
      position: { x: 320, y: 480 }, style: nodeStyle(COLORS.external) },
    { id: 'notify', type: 'output', data: { label: 'Notification Svc\n(consumes events)' },
      position: { x: 600, y: 480 }, style: nodeStyle(COLORS.service) },
  ]);

  let edges = $state([
    { id: 'e-cust-gw', source: 'customer', target: 'gateway', label: 'HTTPS', animated: true,
      style: `stroke:${COLORS.edge};` },
    { id: 'e-gw-order', source: 'gateway', target: 'order', label: 'REST /orders', animated: true,
      style: `stroke:${COLORS.edge};` },
    { id: 'e-order-db', source: 'order', target: 'db', label: 'SQL',
      style: `stroke:${COLORS.data};` },
    { id: 'e-order-pay', source: 'order', target: 'payment', label: 'charge (sync)', animated: true,
      style: `stroke:${COLORS.service};` },
    { id: 'e-pay-stripe', source: 'payment', target: 'stripe', label: 'API (sync)', animated: true,
      style: `stroke:${COLORS.external};` },
    { id: 'e-pay-db', source: 'payment', target: 'db', label: 'SQL',
      style: `stroke:${COLORS.data};` },
    { id: 'e-order-kafka', source: 'order', target: 'kafka', label: 'OrderConfirmed (async)', animated: true,
      style: `stroke:${COLORS.async};stroke-dasharray:5 4;` },
    { id: 'e-kafka-notify', source: 'kafka', target: 'notify', label: 'consume (async)', animated: true,
      style: `stroke:${COLORS.async};stroke-dasharray:5 4;` },
  ]);

  // --- Click-to-show popup -------------------------------------------------
  let popup = $state(null);

  const NODE_HINTS = {
    gateway:  { title: 'API Gateway (Kong)', body: 'Single entry point: TLS termination, authentication, rate limiting, and routing to services.' },
    order:    { title: 'Order Service', body: 'Owns the order lifecycle. Persists to Postgres, calls Payment synchronously, emits async events to Kafka.' },
    payment:  { title: 'Payment Service', body: 'Wraps Stripe. Synchronous charge; writes payment records to Postgres.' },
    db:       { title: 'PostgreSQL', body: 'Shared relational store for orders and payments (see ADR-003 on DB-per-service tradeoffs).' },
    kafka:    { title: 'Kafka', body: 'Event bus for async fan-out. Order events are published fire-and-forget; consumers react independently.' },
    stripe:   { title: 'Stripe (external)', body: 'Third-party payment processor. Synchronous API call from the Payment Service.' },
    notify:   { title: 'Notification Service', body: 'Consumes OrderConfirmed events from Kafka to send emails/SMS. Decoupled from the order path.' },
    customer: { title: 'Customer', body: 'End user placing orders via web or mobile over HTTPS.' },
  };

  function onNodeClick({ node }) {
    popup = NODE_HINTS[node.id] ?? { title: node.data.label.split('\n')[0], body: '' };
  }
  function closePopup() { popup = null; }
</script>

<main>
  <h1>Interactive Architecture — E-Commerce Platform</h1>
  <p>
    An interactive companion to the static C4 <code>.puml</code> diagrams. Pan,
    zoom, drag nodes, and click a box for details. Export a PNG of the graph, or
    record an animated GIF of the sequence walkthrough below.
  </p>

  <section class="block">
    <h2>1. Container view (C4 Level 2)</h2>
    <div class="flow-wrapper export-scope-container">
      <SvelteFlow bind:nodes bind:edges onnodeclick={onNodeClick} fitView>
        <Background />
        <Controls />
        <MiniMap />
        <DownloadButton filename="container-view" scope="export-scope-container" />
      </SvelteFlow>

      {#if popup}
        <div class="popup">
          <button class="popup-close" onclick={closePopup} aria-label="Close">×</button>
          <div class="popup-title">{popup.title}</div>
          <div class="popup-body">{popup.body}</div>
        </div>
      {:else}
        <div class="hint">💡 Click a box (try <strong>Order Service</strong>) for details.</div>
      {/if}
    </div>

    <div class="legend-bar">
      <span class="legend-title">Legend:</span>
      <span><span class="swatch" style="background:#2563eb"></span> Edge / gateway</span>
      <span><span class="swatch" style="background:#7c3aed"></span> Service</span>
      <span><span class="swatch" style="background:#15803d"></span> Datastore</span>
      <span><span class="swatch" style="background:#b45309"></span> Messaging (async)</span>
      <span><span class="swatch" style="background:#334155"></span> External</span>
    </div>
  </section>

  <section class="block">
    <h2>2. Order flow — step through &amp; record a GIF</h2>
    <p class="sub">
      Toggle happy vs failed payment, step through the messages, then click
      <strong>Record GIF</strong> to download an animated walkthrough.
    </p>
    <SequenceDiagram />
  </section>

  <section class="block">
    <h2>3. Proteus zero-trust mesh — Dark vs Live</h2>
    <p class="sub">
      The SPIRE + Envoy mTLS request flow, shown as two graphs: when
      <code>service-a</code> is <strong>not admitted</strong> (dark, blocked at
      the SVID fetch) versus <strong>admitted</strong> (live, mTLS 200). Click a
      box in the dark graph to see where to act.
    </p>
    <ProteusMesh />
  </section>
</main>

<style>
  main { font-family: system-ui, sans-serif; padding: 1rem; max-width: 1000px; margin: 0 auto; }
  h1 { font-size: 1.4rem; margin: 0 0 0.25rem; }
  h2 { font-size: 1.1rem; margin: 0 0 0.5rem; }
  p { color: #555; margin: 0 0 1rem; }
  .sub { font-size: 0.85rem; }
  .block { margin-bottom: 2.5rem; }
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
    position: absolute; top: 10px; left: 10px; z-index: 5; max-width: 280px;
    font-size: 0.75rem; padding: 6px 10px; border-radius: 8px;
    background: rgba(255,255,255,0.92); border: 1px dashed #cbd5e1; color: #475569;
  }
</style>
