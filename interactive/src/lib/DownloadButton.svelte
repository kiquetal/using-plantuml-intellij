<script>
  import { useSvelteFlow, getNodesBounds, getViewportForBounds } from '@xyflow/svelte';
  import { toPng } from 'html-to-image';

  // File name for the exported PNG (e.g. "container-view").
  let { filename = 'architecture', scope = '' } = $props();

  const { getNodes } = useSvelteFlow();

  const IMAGE_WIDTH = 1200;
  const IMAGE_HEIGHT = 800;

  function triggerDownload(dataUrl) {
    const a = document.createElement('a');
    a.setAttribute('download', `${filename}.png`);
    a.setAttribute('href', dataUrl);
    a.click();
  }

  async function onClick() {
    const nodes = getNodes();
    // Frame all nodes into the target image, ignoring current pan/zoom.
    const bounds = getNodesBounds(nodes);
    const viewport = getViewportForBounds(bounds, IMAGE_WIDTH, IMAGE_HEIGHT, 0.5, 2, 0.1);

    const selector = scope
      ? `.${scope} .svelte-flow__viewport`
      : '.svelte-flow__viewport';
    const viewportEl = document.querySelector(selector);
    if (!viewportEl) return;

    const dataUrl = await toPng(viewportEl, {
      backgroundColor: '#ffffff',
      width: IMAGE_WIDTH,
      height: IMAGE_HEIGHT,
      style: {
        width: `${IMAGE_WIDTH}px`,
        height: `${IMAGE_HEIGHT}px`,
        transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
      },
    });
    triggerDownload(dataUrl);
  }
</script>

<button class="download-btn" onclick={onClick} title="Download this diagram as PNG">
  ⬇ PNG
</button>

<style>
  .download-btn {
    position: absolute;
    top: 10px;
    right: 10px;
    z-index: 6;
    cursor: pointer;
    background: #1e293b;
    color: #fff;
    border: none;
    border-radius: 6px;
    padding: 6px 10px;
    font-size: 0.78rem;
    font-weight: 600;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
  }
  .download-btn:hover {
    background: #0f172a;
  }
</style>
