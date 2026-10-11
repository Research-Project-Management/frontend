import { pdfjs } from 'react-pdf';
import * as pdfjsDist from 'pdfjs-dist';

export function getPdfWorkerUrl(): string {
  if (typeof window === 'undefined') {
    return '/pdf.worker.min.mjs';
  }
  return `${window.location.origin}/pdf.worker.min.mjs`;
}

/**
 * Configure PDF.js worker source to point to local static assets in /public with full origin URL.
 * Sets workerSrc on both react-pdf and pdfjs-dist instances to prevent fake-worker fallback.
 */
export function setupPdfWorker(): void {
  if (typeof window === 'undefined') return;

  const workerUrl = getPdfWorkerUrl();

  if (pdfjs?.GlobalWorkerOptions) {
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  }
  if ((pdfjsDist as unknown as { GlobalWorkerOptions?: { workerSrc?: string } })?.GlobalWorkerOptions) {
    (pdfjsDist as unknown as { GlobalWorkerOptions: { workerSrc: string } }).GlobalWorkerOptions.workerSrc = workerUrl;
  }
  if ((window as unknown as { pdfjsLib?: { GlobalWorkerOptions?: { workerSrc?: string } } }).pdfjsLib?.GlobalWorkerOptions) {
    (window as unknown as { pdfjsLib: { GlobalWorkerOptions: { workerSrc: string } } }).pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
  }
}

// Automatically invoke on module evaluation
setupPdfWorker();

