'use client';

export interface ExifStrippedBlob {
  blob: Blob;
  width: number;
  height: number;
}

export interface ProcessedImage {
  full: Blob;
  fullWidth: number;
  fullHeight: number;
  thumbnail: Blob;
  thumbnailWidth: number;
  thumbnailHeight: number;
}

const TARGET_MAX_FULL_DIMENSION = 2048;
const TARGET_MAX_THUMB_DIMENSION = 480;
const JPEG_QUALITY_FULL = 0.9;
const JPEG_QUALITY_THUMB = 0.85;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not load image'));
    };
    img.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Could not create blob from canvas'));
          return;
        }
        resolve(blob);
      },
      type,
      quality,
    );
  });
}

function resizeImage(
  img: HTMLImageElement,
  maxDimension: number,
): { canvas: HTMLCanvasElement; width: number; height: number } {
  const longest = Math.max(img.naturalWidth, img.naturalHeight);
  const scale = longest > maxDimension ? maxDimension / longest : 1;
  const width = Math.round(img.naturalWidth * scale);
  const height = Math.round(img.naturalHeight * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not get canvas context');
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, width, height);
  return { canvas, width, height };
}

/**
 * Re-encode the file through a canvas to drop EXIF / orientation metadata.
 * Keeps original dimensions; re-encodes at the given quality using the
 * source file's MIME type (falls back to image/jpeg when unknown).
 *
 * Used by the featured-image uploader, which preserves the photographer's
 * chosen resolution. Gallery uploads use {@link processImageForUpload}
 * which additionally normalises dimensions and produces a thumbnail.
 */
export async function stripExifFromFile(file: File): Promise<ExifStrippedBlob> {
  const img = await loadImage(file);

  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not get canvas context');
  }
  ctx.drawImage(img, 0, 0);

  const outputType = file.type && file.type.startsWith('image/') ? file.type : 'image/jpeg';
  const quality = outputType === 'image/png' ? undefined : 0.95;

  const blob = await canvasToBlob(canvas, outputType, quality ?? 0.95);
  return {
    blob,
    width: img.naturalWidth,
    height: img.naturalHeight,
  };
}

/**
 * Normalise a photo for gallery storage. Produces two JPEG blobs:
 *
 * - `full`: resized so the longest edge is at most
 *   {@link TARGET_MAX_FULL_DIMENSION}px. Re-encoded at quality 0.9 so
 *   every gallery photo shares a common format and reasonable file
 *   size, regardless of what the user uploaded (HEIC, 12 MP phone
 *   shot, 4K landscape, etc.).
 * - `thumbnail`: same source resized to
 *   {@link TARGET_MAX_THUMB_DIMENSION}px on the longest edge at
 *   quality 0.85. Stored as a separate S3 object so the gallery grid
 *   only fetches a small image instead of the full one.
 *
 * EXIF is dropped as a side-effect of the canvas re-encode. Runs in
 * the browser via the Canvas API — no server-side image library
 * required.
 */
export async function processImageForUpload(file: File): Promise<ProcessedImage> {
  const img = await loadImage(file);

  const full = resizeImage(img, TARGET_MAX_FULL_DIMENSION);
  const fullBlob = await canvasToBlob(full.canvas, 'image/jpeg', JPEG_QUALITY_FULL);

  const thumb = resizeImage(img, TARGET_MAX_THUMB_DIMENSION);
  const thumbBlob = await canvasToBlob(thumb.canvas, 'image/jpeg', JPEG_QUALITY_THUMB);

  return {
    full: fullBlob,
    fullWidth: full.width,
    fullHeight: full.height,
    thumbnail: thumbBlob,
    thumbnailWidth: thumb.width,
    thumbnailHeight: thumb.height,
  };
}

export function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not load image'));
    };

    img.src = url;
  });
}
