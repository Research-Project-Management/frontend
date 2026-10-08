import { pdfjs } from 'react-pdf';

/**
 * Configure PDF.js worker source to point to local static assets in /public.
 * Follows the official React-PDF standard configuration pattern.
 */
export function setupPdfWorker(): void {
  if (typeof window !== 'undefined' && pdfjs?.GlobalWorkerOptions) {
    pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
  }
}

// Automatically invoke on module evaluation
setupPdfWorker();
