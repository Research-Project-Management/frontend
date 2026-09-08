import type { PdfMetadata, CrossrefWork } from '../types/preview.types';
import { extractDoiFromText, parseXmpMetadata, mergeCrossrefMetadata } from '../utils/preview.utils';
import { apiGet, apiPost } from '@/shared/lib/api';
import { logger } from '@/shared/lib/logger';
import { getFileArrayBuffer } from './file.service';

async function getPdfjs() {
  if (typeof window === 'undefined') return null;
  try {
    const pdfModule = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const pdfjs = (pdfModule as any).default || pdfModule;
    if (pdfjs?.GlobalWorkerOptions && !pdfjs.GlobalWorkerOptions.workerSrc) {
      pdfjs.GlobalWorkerOptions.workerSrc = `${window.location.origin}/pdf.worker.min.mjs`;
    }
    return pdfjs;
  } catch {
    try {
      const { pdfjs } = await import('react-pdf');
      if (pdfjs?.GlobalWorkerOptions && !pdfjs.GlobalWorkerOptions.workerSrc) {
        pdfjs.GlobalWorkerOptions.workerSrc = `${window.location.origin}/pdf.worker.min.mjs`;
      }
      return pdfjs;
    } catch {
      return null;
    }
  }
}

export const previewServices = {
  async extractMetadata(arrayBuffer: ArrayBuffer): Promise<{ metadata: PdfMetadata; doi?: string }> {
    try {
      const pdfjsLib = await getPdfjs();
      if (!pdfjsLib) {
        return { metadata: { pageCount: 1 } };
      }
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer.slice(0)) }).promise;
      const meta = await pdf.getMetadata();



    
    const info = (meta?.info || {}) as Record<string, any>;
    const xmpRaw = (meta?.metadata as any)?.getRaw?.() || '';
    const xmpFields = parseXmpMetadata(xmpRaw);

    const standardKeys = new Set([
      'Title', 'Author', 'Subject', 'Keywords', 'Creator', 'Producer',
      'CreationDate', 'ModDate', 'PDFFormatVersion', 'IsLinearized',
      'IsAcroFormPresent', 'IsXFAPresent', 'IsCollectionPresent',
      'MarkInfo', 'Tagged',
    ]);
    
    const extraFields: Record<string, string> = {};
    for (const [k, v] of Object.entries(info)) {
      if (!standardKeys.has(k) && v && typeof v === 'string' && v.trim()) {
        extraFields[k] = v;
      }
    }

    let doi = xmpFields.doi || undefined;
    if (!doi) {
      try {
        for (let i = 1; i <= Math.min(pdf.numPages, 2); i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const text = textContent.items
            .map((t: unknown) => (typeof t === 'object' && t !== null && 'str' in t ? String((t as { str: unknown }).str) : ''))
            .join(' ');
          const found = extractDoiFromText(text);
          if (found) { 
            doi = found; 
            break; 
          }
        }
      } catch { 
        // ignore text extraction errors 
      }
    }

    const baseMeta: PdfMetadata = {
      title: info.Title || xmpFields.title || undefined,
      author: info.Author || xmpFields.creator || undefined,
      subject: info.Subject || xmpFields.description || undefined,
      creator: info.Creator || undefined,
      producer: info.Producer || undefined,
      creationDate: info.CreationDate || undefined,
      modDate: info.ModDate || undefined,
      pageCount: pdf.numPages,
      keywords: info.Keywords || xmpFields.keywords || undefined,
      doi,
      journal: xmpFields.journal || xmpFields.publicationName || undefined,
      publisher: xmpFields.publisher || undefined,
      issn: xmpFields.issn || undefined,
      isbn: xmpFields.isbn || undefined,
      volume: xmpFields.volume || undefined,
      issue: xmpFields.issue || xmpFields.number || undefined,
      pages: xmpFields.pages || xmpFields.startPage
        ? (xmpFields.startPage && xmpFields.endPage
          ? `${xmpFields.startPage}–${xmpFields.endPage}`
          : xmpFields.startPage || xmpFields.pages)
        : undefined,
      publicationDate: xmpFields.date || xmpFields.publicationDate || undefined,
      abstract: xmpFields.abstract || xmpFields.description || undefined,
      language: xmpFields.language || undefined,
      copyright: xmpFields.rights || undefined,
      extraFields: Object.keys(extraFields).length > 0 ? extraFields : undefined,
    };

    return { metadata: baseMeta, doi };
  } catch (err) {
    logger.warn('[previewService] extractMetadata error', { error: err });
    return { metadata: { pageCount: 1 } };
  }
},


  /**
   * Generates a PNG thumbnail of the first page of a PDF.
   * Accepts a URL string and fetches a fresh ArrayBuffer internally,
   * because PDF.js transfers (detaches) the ArrayBuffer given to extractMetadata.
   */
  async generatePreview(url: string): Promise<string | null> {
    try {
      // Fetch a fresh buffer — cannot reuse the one passed to extractMetadata
      const arrayBuffer = await getFileArrayBuffer(url);
      const pdfjsLib = await getPdfjs();
      if (!pdfjsLib) return null;

      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer.slice(0)) }).promise;
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
      } as any).promise;
      return canvas.toDataURL('image/png');
    } catch (error) {
      console.error('Failed to generate PDF preview:', error);
      return null;
    }
  },


  async enrichWithCrossref(baseMeta: PdfMetadata, doi?: string): Promise<{ enrichedMeta: PdfMetadata; found: boolean }> {
    let crossrefWork: CrossrefWork | null = null;

    if (doi) {
      try {
        const result = await this.getCrossrefByDoi(doi);
        crossrefWork = result.work;
      } catch { 
        // DOI not found 
      }
    }

    if (!crossrefWork && baseMeta.title) {
      try {
        const result = await this.getCrossrefSearch(baseMeta.title, 1);
        if (result.works.length > 0 && result.works[0].score > 10) {
          crossrefWork = result.works[0];
        }
      } catch { 
        // Search failed 
      }
    }

    if (crossrefWork) {
      const enrichedMeta = mergeCrossrefMetadata(baseMeta, crossrefWork);
      return { enrichedMeta, found: true };
    }

    return { enrichedMeta: baseMeta, found: false };
  },

  async getCrossrefByDoi(doi: string) {
    return apiGet<{ work: CrossrefWork }>(`/api/library/references/doi/${encodeURIComponent(doi)}`);
  },

  async getCrossrefSearch(query: string, rows = 1) {
    return apiGet<{ works: CrossrefWork[]; totalResults: number }>(
      `/api/library/references/crossref/search?query=${encodeURIComponent(query)}&rows=${rows}`
    );
  },

  async getCollections(workspaceId: string) {
    return apiGet<{ collections: Array<{ id: string; name: string; color?: string; icon?: string }> }>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/collections`
    );
  },

  async ingestPaper(workspaceId: string, data: Record<string, unknown>) {
    return apiPost<{ message?: string; paper?: unknown; item?: unknown }>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/ingestion`,
      data
    );
  },
};
