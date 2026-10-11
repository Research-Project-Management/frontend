/**
 * pdf-resolver.ts
 *
 * Pure domain resolver for PDF data resolution (Layer 1: Domain Core).
 * Converts raw ASCII (%PDF-), Base64, Data URIs, or URLs into a standardized { url, blob } structure.
 * Clean Architecture Guarantee: ZERO dependencies on Coordinators, Stores, or UI.
 */

export interface PdfBlobResult {
  url: string;
  blob: Blob | null;
}

export function createPdfBlobAndUrl(input: string | null | undefined): PdfBlobResult | null {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Direct HTTP, HTTPS, or Blob URLs
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('blob:')
  ) {
    return { url: trimmed, blob: null };
  }

  try {
    let uint8Array: Uint8Array;

    if (trimmed.startsWith('%PDF-')) {
      // Raw ASCII string representation of PDF
      uint8Array = new Uint8Array(trimmed.length);
      for (let i = 0; i < trimmed.length; i++) {
        uint8Array[i] = trimmed.charCodeAt(i) & 0xff;
      }
    } else {
      // Strip data URI scheme if present
      let base64 = trimmed;
      if (base64.startsWith('data:application/pdf;base64,')) {
        base64 = base64.slice('data:application/pdf;base64,'.length);
      } else if (base64.startsWith('data:')) {
        const commaIdx = base64.indexOf(',');
        if (commaIdx !== -1) {
          base64 = base64.slice(commaIdx + 1);
        }
      }
      base64 = base64.replace(/\s+/g, '');

      if (typeof atob === 'function') {
        const binary = atob(base64);
        uint8Array = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          uint8Array[i] = binary.charCodeAt(i);
        }
      } else if (typeof Buffer !== 'undefined') {
        const buf = Buffer.from(base64, 'base64');
        uint8Array = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
      } else {
        return null;
      }
    }

    const blob = new Blob([uint8Array.buffer as ArrayBuffer], { type: 'application/pdf' });
    let url: string;
    try {
      if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
        url = URL.createObjectURL(blob);
      } else {
        url = `blob:http://localhost/${Math.random().toString(36).slice(2)}`;
      }
    } catch {
      url = `blob:http://localhost/${Math.random().toString(36).slice(2)}`;
    }

    return { url, blob };
  } catch {
    return null;
  }
}

export function extractDoiFromText(text?: string | null): string | null {
  if (!text) return null;
  const match = text.match(/\b(10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+)\b/);
  if (!match) return null;
  let doi = match[1];
  // Clean trailing punctuation
  doi = doi.replace(/[.,;:)\]]+$/, '');
  return doi;
}

export function parsePdfDate(dateStr?: string | null): string | undefined {
  if (!dateStr) return undefined;
  // Format: D:YYYYMMDDHHmmSS... -> YYYY-MM-DD
  const match = dateStr.match(/^D:(\d{4})(\d{2})(\d{2})/);
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}`;
  }
  return undefined;
}
