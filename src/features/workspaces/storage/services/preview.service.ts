import type { PdfMetadata, CrossrefWork } from '../types/preview.types';
import { extractDoiFromText, parseXmpMetadata, mergeCrossrefMetadata } from '../utils/preview.utils';
import { apiGet } from '@/shared/lib/api';
import { getFileArrayBuffer } from './file.service';

let pdfjsLibPromise: Promise<any> | null = null;

const getPdfjsLib = () => {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = import('pdfjs-dist').then((pdfjsLib) => {
      // Serve worker from /public to avoid CDN dependency in prod
      pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
      return pdfjsLib;
    });
  }
  return pdfjsLibPromise;
};

export const previewServices = {
  async extractMetadata(arrayBuffer: ArrayBuffer): Promise<{ metadata: PdfMetadata; doi?: string }> {
    const pdfjsLib = await getPdfjsLib();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
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
          const text = textContent.items.map((t: any) => t.str).join(' ');
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
      const pdfjsLib = await getPdfjsLib();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const page = await pdf.getPage(1);
      
      const viewport = page.getViewport({ scale: 1 });
      const scale = 280 / viewport.width;
      const scaledViewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      canvas.width = scaledViewport.width;
      canvas.height = scaledViewport.height;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      await page.render({ canvasContext: ctx, viewport: scaledViewport, canvas } as any).promise;
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
};
