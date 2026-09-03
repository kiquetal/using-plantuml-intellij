<script>
  // ---------------------------------------------------------------------------
  // App.svelte — the diagram studio shell.
  // Auto-loads every spec in /specs, lets you pick one (dropdown or ?spec=),
  // and renders it through the generic GraphView + SequenceView renderers.
  // ---------------------------------------------------------------------------
  import GraphView from './renderers/GraphView.svelte';
  import SequenceView from './renderers/SequenceView.svelte';
  import { validateSpec } from './core/spec.js';

  // Eagerly import all committed specs. Key = filename slug.
  const modules = import.meta.glob('../specs/*.json', { eager: true });
  const specs = {};
  for (const [path, mod] of Object.entries(modules)) {
    const slug = path.split('/').pop().replace(/\.json$/, '');
    specs[slug] = mod.default ?? mod;
  }
  const slugs = Object.keys(specs).sort();

  // Initial selection from ?spec=, else first available.
  const params = new URLSearchParams(location.search);
  let selected = $state(params.get('spec') && specs[params.get('spec')] ? params.get('spec') : slugs[0]);

  const result = $derived(selected ? validateSpec(structuredClone(specs[selected])) : null);
  const spec = $derived(result?.spec);
  const warnings = $derived(result?.warnings ?? []);

  function onSelect(e) {
    selected = e.target.value;
    const url = new URL(location.href);
    url.searchParams.set('spec', selected);
    history.replaceState({}, '', url);
  }
</script>

<main>
  <header>
    <h1>Diagram Studio</h1>
    <p>Interactive C4 views generated from <code>.puml</code> files. Pick a spec, explore the graph, and step through / record the flow.</p>
    <div class="picker">
      <label for="spec">Spec:</label>
      <select id="spec" value={selected} onchange={onSelect}>
        {#each slugs as s}<option value={s}>{s}</option>{/each}
      </select>
      <span class="hintlink">or use <code>?spec={selected}</code> in the URL</span>
    </div>
  </header>

  {#if !spec}
    <p class="empty">No specs found in <code>/specs</code>. Import one: <code>node cli/import-c4.js path/to/c4.puml</code></p>
  {:else}
    {#if warnings.length}
      <details class="warn">
        <summary>{warnings.length} spec warning(s)</summary>
        <ul>{#each warnings as w}<li>{w}</li>{/each}</ul>
      </details>
    {/if}

    <section class="block">
      <h2>{spec.title}</h2>
      <h3>Container graph</h3>
      {#key selected}
        <GraphView {spec} scope="export-scope-graph" />
      {/key}
    </section>

    <section class="block">
      <h3>Flow — step through &amp; record a GIF</h3>
      {#key selected}
        <SequenceView {spec} />
      {/key}
    </section>
  {/if}
</main>

<style>
  main { font-family: system-ui, sans-serif; padding: 1rem; max-width: 1000px; margin: 0 auto; }
  header { margin-bottom: 1.5rem; }
  h1 { font-size: 1.5rem; margin: 0 0 0.25rem; }
  h2 { font-size: 1.15rem; margin: 0 0 0.75rem; }
  h3 { font-size: 1rem; margin: 0 0 0.5rem; color: #334155; }
  p { color: #555; margin: 0 0 1rem; }
  .picker { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
  .picker label { font-weight: 600; font-size: 0.85rem; }
  select { padding: 4px 8px; border-radius: 6px; border: 1px solid #cbd5e1; font-size: 0.85rem; }
  .hintlink { font-size: 0.75rem; color: #64748b; }
  .block { margin-bottom: 2.5rem; }
  .empty { font-size: 0.9rem; color: #64748b; background: #f8fafc; padding: 1rem; border-radius: 8px; }
  .warn { font-size: 0.78rem; background: #fffbeb; border: 1px solid #f59e0b; border-radius: 6px; padding: 6px 10px; margin-bottom: 1rem; color: #92400e; }
  .warn ul { margin: 0.4rem 0 0; padding-left: 1.2rem; }
</style>
