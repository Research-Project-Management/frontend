import { getFileArrayBuffer } from './file.service';

interface PdfJsModule {
  GlobalWorkerOptions?: { workerSrc: string };
  getDocument: (params: { data: Uint8Array }) => {
    promise: Promise<{
      getPage: (pageNum: number) => Promise<{
        getViewport: (params: { scale: number }) => { width: number; height: number };
        render: (params: { canvasContext: CanvasRenderingContext2D; viewport: unknown }) => { promise: Promise<void> };
      }>;
    }>;
  };
}

async function getPdfjs(): Promise<PdfJsModule | null> {
  if (typeof window === 'undefined') return null;
  try {
    const pdfModule = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const pdfjs = (('default' in pdfModule ? pdfModule.default : pdfModule) as unknown as PdfJsModule);
    if (pdfjs?.GlobalWorkerOptions) {
      pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
    }
    return pdfjs;
  } catch {
    try {
      const { pdfjs } = await import('react-pdf');
      if (pdfjs?.GlobalWorkerOptions) {
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
      }
      return (pdfjs as unknown as PdfJsModule);
    } catch {
      return null;
    }
  }
}

export const previewServices = {
  /**
   * Generates a PNG thumbnail of the first page of a PDF for visual file preview.
   */
  async generatePreview(url: string): Promise<string | null> {
    try {
      const arrayBuffer = await getFileArrayBuffer(url);
      const pdfjsLib = await getPdfjs();
      if (!pdfjsLib) return null;

      const pdf = await pdfjsLib.getDocument({
        data: new Uint8Array(arrayBuffer.slice(0)),
      }).promise;
      const page = await pdf.getPage(1);

      const viewport = page.getViewport({ scale: 1 });
      const targetWidth = 280;
      const scale = targetWidth / viewport.width;
      const scaledViewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(scaledViewport.width);
      canvas.height = Math.floor(scaledViewport.height);

      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      await page.render({
        canvasContext: ctx,
        viewport: scaledViewport,
      }).promise;

      return canvas.toDataURL('image/png');
    } catch (error) {
      console.warn('Failed to generate PDF preview:', error);
      return null;
    }
  },
};
