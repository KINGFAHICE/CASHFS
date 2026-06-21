// Center-crop + resize helpers (offline, canvas only).

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function loadImg(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

/** Center-crop to square and resize to `size` px. Returns JPEG data URL. */
export async function centerCropSquare(dataUrl: string, size = 256, quality = 0.9): Promise<string> {
  const img = await loadImg(dataUrl);
  const s = Math.min(img.width, img.height);
  const sx = (img.width - s) / 2;
  const sy = (img.height - s) / 2;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(img, sx, sy, s, s, 0, 0, size, size);
  return c.toDataURL("image/jpeg", quality);
}

/** Resize keeping aspect ratio so the longest edge equals maxEdge. */
export async function resizeMax(dataUrl: string, maxEdge = 900, quality = 0.85): Promise<string> {
  const img = await loadImg(dataUrl);
  const ratio = Math.min(1, maxEdge / Math.max(img.width, img.height));
  const w = Math.round(img.width * ratio);
  const h = Math.round(img.height * ratio);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, w, h);
  return c.toDataURL("image/jpeg", quality);
}

/** Pick a file then process via processor. */
export async function processUpload(
  file: File,
  processor: (dataUrl: string) => Promise<string>,
  maxBytes = 4 * 1024 * 1024,
): Promise<string> {
  if (file.size > maxBytes) {
    throw new Error(`Image is too large (max ${(maxBytes / 1024 / 1024).toFixed(1)} MB)`);
  }
  const raw = await fileToDataUrl(file);
  return processor(raw);
}
