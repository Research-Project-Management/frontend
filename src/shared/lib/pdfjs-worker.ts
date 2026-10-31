import '@/shared/lib/dom-polyfill';

/**
 * pdfjs-worker.ts
 *
 * Configures PDF.js worker source to point to local static assets in /public with full origin URL.
 * Sets workerSrc on both react-pdf and pdfjs-dist instances to prevent fake-worker fallback.
 * Strictly executes on client (browser) only to prevent Node.js SSR DOMMatrix ReferenceErrors.
 */

export function getPdfWorkerUrl(): string {
  if (typeof window === 'undefined') {
    return '/pdf.worker.min.mjs';
  }
  return `${window.location.origin}/pdf.worker.min.mjs`;
}

let isWorkerConfigured = false;

/**
 * Configure PDF.js worker source to point to local static assets in /public with full origin URL.
 * Sets workerSrc synchronously on react-pdf and global window.pdfjsLib, and pdfjs-dist.
 */
export function setupPdfWorker(): void {
  if (typeof window === 'undefined' || isWorkerConfigured) return;
  isWorkerConfigured = true;

  const workerUrl = getPdfWorkerUrl();

  // Try to configure synchronously if react-pdf or pdfjs-dist has already been required/imported
  try {
    const reactPdf = require('react-pdf');
    if (reactPdf?.pdfjs?.GlobalWorkerOptions) {
      reactPdf.pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    }
  } catch {
    // Fall back to async import
    import('react-pdf')
      .then(({ pdfjs }) => {
        if (pdfjs?.GlobalWorkerOptions) {
          pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
        }
      })
      .catch(() => {});
  }

  try {
    const pdfjsDist = require('pdfjs-dist');
    const gwo = (pdfjsDist as unknown as { GlobalWorkerOptions?: { workerSrc?: string } })?.GlobalWorkerOptions;
    if (gwo) {
      gwo.workerSrc = workerUrl;
    }
  } catch {
    import('pdfjs-dist')
      .then((dist) => {
        const gwo = (dist as unknown as { GlobalWorkerOptions?: { workerSrc?: string } })?.GlobalWorkerOptions;
        if (gwo) {
          gwo.workerSrc = workerUrl;
        }
      })
      .catch(() => {});
  }

  // Configure global window.pdfjsLib if present
  if (
    (window as unknown as { pdfjsLib?: { GlobalWorkerOptions?: { workerSrc?: string } } })
      ?.pdfjsLib?.GlobalWorkerOptions
  ) {
    (
      window as unknown as { pdfjsLib: { GlobalWorkerOptions: { workerSrc: string } } }
    ).pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
  }
}

export interface SharedPdfDocumentOptions {
  cMapUrl: string;
  cMapPacked: boolean;
  standardFontDataUrl: string;
  isEvalSupported: boolean;
}

let cachedDocumentOptions: SharedPdfDocumentOptions | null = null;
let cachedVersionKey = '';

/**
 * Returns a stable, pre-allocated PDF.js document options object shared across Editor and Reader.
 * Enables packed binary CMaps (cMapPacked: true) and disables eval for faster, safer font decoding.
 */
export function getSharedPdfDocumentOptions(pdfjsVersion = '5.4.296'): SharedPdfDocumentOptions {
  if (cachedDocumentOptions && cachedVersionKey === pdfjsVersion) {
    return cachedDocumentOptions;
  }
  const cdnBase =
    (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_PDFJS_CDN_BASE) ||
    `https://unpkg.com/pdfjs-dist@${pdfjsVersion}`;
  const normalizedBase = cdnBase.replace(/\/+$/, '');
  cachedVersionKey = pdfjsVersion;
  cachedDocumentOptions = {
    cMapUrl: `${normalizedBase}/cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${normalizedBase}/standard_fonts/`,
    isEvalSupported: false,
  };
  return cachedDocumentOptions;
}

/**
 * Returns a bounded devicePixelRatio (default max 2x for main pages, 1x-1.5x for thumbnails)
 * to prevent VRAM exhaustion on 3x/4x Retina displays while keeping text crisp.
 */
export function getCappedDevicePixelRatio(maxDpr = 2): number {
  if (typeof window === 'undefined') return 1;
  return Math.min(maxDpr, Math.max(1, window.devicePixelRatio || 1));
}

/**
 * Deterministically releases GPU backing store memory for all <canvas> elements inside a container.
 */
export function releaseCanvasMemory(container: HTMLElement | null | undefined): void {
  if (!container) return;
  const canvases = container.querySelectorAll('canvas');
  for (let i = 0; i < canvases.length; i++) {
    const canvas = canvases[i];
    canvas.width = 0;
    canvas.height = 0;
  }
}

// Automatically invoke on module evaluation in client context
if (typeof window !== 'undefined') {
  setupPdfWorker();
}

