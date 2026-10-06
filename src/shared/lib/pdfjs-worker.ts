import { pdfjs } from 'react-pdf';

/**
 * Configure PDF.js worker source to point to local static assets in /public.
 * Ensures consistent worker configuration across all components rendering <Document>.
 */
export function setupPdfWorker(): void {
  if (typeof window !== 'undefined' && pdfjs?.GlobalWorkerOptions) {
    try {
      const origin = window.location?.origin;
      pdfjs.GlobalWorkerOptions.workerSrc = origin
        ? `${origin}/pdf.worker.min.mjs`
        : '/pdf.worker.min.mjs';
    } catch {
      pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
    }
  }
}

// Automatically invoke on module evaluation
setupPdfWorker();
