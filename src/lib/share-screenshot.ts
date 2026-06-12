import { domToBlob, waitUntilLoad } from "modern-screenshot";

const CAPTURE_WIDTH = 1024;
const TILE_CSS_HEIGHT = 1800;
const MAX_CANVAS_PX = 16_384;

function waitForPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

function computePixelRatio(cssHeight: number): number {
  const dpr = window.devicePixelRatio || 1;
  let ratio = Math.min(dpr, 1.5);
  const totalPx = cssHeight * ratio;
  if (totalPx > MAX_CANVAS_PX) {
    ratio = Math.max(0.45, MAX_CANVAS_PX / cssHeight);
  }
  return ratio;
}

function shouldIncludeNode(node: Node): boolean {
  if (!(node instanceof HTMLElement)) return true;
  return node.dataset.captureExclude !== "true";
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  if (!blob.size) throw new Error("screenshot_empty");
  return blob;
}

async function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  const fromBlob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), "image/png");
  });
  if (fromBlob?.size) return fromBlob;
  return dataUrlToBlob(canvas.toDataURL("image/png"));
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function preloadImages(root: HTMLElement): Promise<void> {
  const urls = new Set<string>();
  root.querySelectorAll("img").forEach((img) => {
    if (img.src) urls.add(img.src);
  });
  await Promise.all(
    [...urls].map(
      (url) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => resolve();
          img.onerror = () => resolve();
          img.src = url;
        }),
    ),
  );
}

/** 等待布局高度稳定（展开比赛卡片后 DOM 会继续长高） */
async function waitForStableHeight(
  element: HTMLElement,
  timeoutMs = 3500,
): Promise<void> {
  let last = 0;
  let stable = 0;
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const h = element.scrollHeight || element.offsetHeight;
    if (h > 80 && h === last) {
      stable += 1;
      if (stable >= 4) return;
    } else {
      stable = 0;
      last = h;
    }
    await new Promise((r) => setTimeout(r, 120));
  }
}

type Html2CanvasFn = (
  element: HTMLElement,
  options?: Record<string, unknown>,
) => Promise<HTMLCanvasElement>;

/** 用 overflow 裁剪 + 负 margin 分块，避免 html2canvas 的 y 偏移失效 */
async function captureWithClipTiles(
  element: HTMLElement,
  pixelRatio: number,
): Promise<HTMLCanvasElement> {
  const html2canvas = (await import("html2canvas")).default;
  const width = element.scrollWidth || element.offsetWidth || CAPTURE_WIDTH;
  const totalHeight = element.scrollHeight || element.offsetHeight;

  const clipHost = document.createElement("div");
  clipHost.setAttribute("data-capture-clip-host", "true");
  clipHost.style.cssText = [
    "position:fixed",
    "left:-25000px",
    "top:0",
    `width:${width}px`,
    "overflow:hidden",
    "background:#07111d",
    "pointer-events:none",
    "z-index:-1",
  ].join(";");

  const parent = element.parentNode;
  if (!parent) throw new Error("screenshot_no_parent");

  const anchor = element.nextSibling;
  parent.removeChild(element);
  clipHost.appendChild(element);
  document.body.appendChild(clipHost);

  const savedMarginTop = element.style.marginTop;

  try {
    const out = document.createElement("canvas");
    out.width = Math.ceil(width * pixelRatio);
    out.height = Math.ceil(totalHeight * pixelRatio);
    const ctx = out.getContext("2d");
    if (!ctx) throw new Error("screenshot_canvas_context");

    ctx.fillStyle = "#07111d";
    ctx.fillRect(0, 0, out.width, out.height);

    let offsetY = 0;
    while (offsetY < totalHeight) {
      const tileHeight = Math.min(TILE_CSS_HEIGHT, totalHeight - offsetY);
      clipHost.style.height = `${tileHeight}px`;
      element.style.marginTop = `${-offsetY}px`;
      await waitForPaint();

      const tile = await html2canvas(clipHost, {
        backgroundColor: "#07111d",
        scale: pixelRatio,
        useCORS: true,
        allowTaint: true,
        logging: false,
        imageTimeout: 15_000,
        width,
        height: tileHeight,
        windowWidth: width,
        windowHeight: tileHeight,
        ignoreElements: (node: Element) => shouldIncludeNode(node),
      });

      if (!tile.width || !tile.height) {
        throw new Error("screenshot_blank_tile");
      }

      ctx.drawImage(tile, 0, Math.round(offsetY * pixelRatio));
      offsetY += tileHeight;
    }

    return out;
  } finally {
    element.style.marginTop = savedMarginTop;
    parent.insertBefore(element, anchor);
    clipHost.remove();
  }
}

async function captureWithModernScreenshot(
  element: HTMLElement,
  pixelRatio: number,
): Promise<Blob> {
  const width = element.scrollWidth || element.offsetWidth;
  const height = element.scrollHeight || element.offsetHeight;

  const blob = await domToBlob(element, {
    width,
    height,
    scale: pixelRatio,
    backgroundColor: "#07111d",
    filter: shouldIncludeNode,
    timeout: 35_000,
  });

  if (!blob.size) throw new Error("screenshot_empty");
  return blob;
}

async function captureWithHtmlToImage(
  element: HTMLElement,
  pixelRatio: number,
): Promise<Blob> {
  const { toBlob } = await import("html-to-image");
  const width = element.scrollWidth || element.offsetWidth;
  const height = element.scrollHeight || element.offsetHeight;

  const blob = await toBlob(element, {
    cacheBust: true,
    pixelRatio,
    width,
    height,
    backgroundColor: "#07111d",
    filter: (node) => shouldIncludeNode(node),
  });

  if (!blob?.size) throw new Error("screenshot_empty");
  return blob;
}

/** 将报告区域导出为完整长图 PNG */
export async function captureElementAsPng(
  element: HTMLElement,
  filename: string,
): Promise<{ downloaded: boolean; copied: boolean }> {
  window.scrollTo({ top: 0, behavior: "instant" });
  await waitForPaint();

  const saved = {
    minWidth: element.style.minWidth,
    width: element.style.width,
    overflow: element.style.overflow,
    background: element.style.background,
  };

  element.style.minWidth = `${CAPTURE_WIDTH}px`;
  element.style.width = "100%";
  element.style.overflow = "visible";
  element.style.background = "#07111d";

  await waitForPaint();
  await waitForStableHeight(element);
  await waitUntilLoad(element, { timeout: 20_000 }).catch(() => undefined);
  await preloadImages(element);
  await waitForPaint();

  const height = element.scrollHeight || element.offsetHeight;
  const width = element.scrollWidth || element.offsetWidth;

  try {
    if (width < 10 || height < 10) throw new Error("screenshot_zero_size");

    const pixelRatio = computePixelRatio(height);
    let blob: Blob | null = null;
    let lastError: unknown;

    try {
      blob = await captureWithModernScreenshot(element, pixelRatio);
    } catch (err) {
      lastError = err;
      try {
        const canvas = await captureWithClipTiles(element, pixelRatio);
        if (!canvas.width || !canvas.height) {
          throw new Error("screenshot_blank_canvas");
        }
        blob = await canvasToBlob(canvas);
      } catch (err2) {
        lastError = err2;
        blob = await captureWithHtmlToImage(element, pixelRatio);
      }
    }

    if (!blob?.size) {
      console.error("screenshot failed", lastError);
      throw new Error("screenshot_empty");
    }

    downloadBlob(blob, filename);

    let copied = false;
    try {
      if (navigator.clipboard?.write && typeof ClipboardItem !== "undefined") {
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": blob }),
        ]);
        copied = true;
      }
    } catch {
      copied = false;
    }

    return { downloaded: true, copied };
  } finally {
    element.style.minWidth = saved.minWidth;
    element.style.width = saved.width;
    element.style.overflow = saved.overflow;
    element.style.background = saved.background;
  }
}
