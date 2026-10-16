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

/**
 * Configure PDF.js worker source to point to local static assets in /public with full origin URL.
 * Sets workerSrc on both react-pdf and pdfjs-dist instances to prevent fake-worker fallback.
 */
export function setupPdfWorker(): void {
  if (typeof window === 'undefined') return;

  const workerUrl = getPdfWorkerUrl();

  // Configure react-pdf asynchronously on client
  import('react-pdf')
    .then(({ pdfjs }) => {
      if (pdfjs?.GlobalWorkerOptions) {
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
      }
    })
    .catch(() => {});

  // Configure pdfjs-dist asynchronously on client
  import('pdfjs-dist')
    .then((dist) => {
      const gwo = (dist as unknown as { GlobalWorkerOptions?: { workerSrc?: string } })?.GlobalWorkerOptions;
      if (gwo) {
        gwo.workerSrc = workerUrl;
      }
    })
    .catch(() => {});

  // Configure global window.pdfjsLib if present
  if (
    (window as unknown as { pdfjsLib?: { GlobalWorkerOptions?: { workerSrc?: string } } })
      .pdfjsLib?.GlobalWorkerOptions
  ) {
    (
      window as unknown as { pdfjsLib: { GlobalWorkerOptions: { workerSrc: string } } }
    ).pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
  }
}

// Automatically invoke on module evaluation in client context
if (typeof window !== 'undefined') {
  setupPdfWorker();
}
