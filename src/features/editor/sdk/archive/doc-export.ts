/**
 * doc-export.ts
 *
 * Single-document formatted export (`POST /api/v1/pages/docs/:pageId/export`)
 * with native zero-copy `Uint8Array.fromBase64` binary decoding when supported.
 */

import { exportDocs } from '../pages/export.client';
import type { DocumentExportFormat } from '../pages/types';
import { sanitizeSlug, triggerFileDownload } from './download';

export interface ExportDocOptions {
  docId: string;
  title?: string;
  includeChildren?: boolean;
}

interface DocFormatSpec {
  extension: string;
  mimeType: string;
  binary: boolean;
}

const DOC_FORMATS: Record<DocumentExportFormat, DocFormatSpec> = {
  docx: {
    extension: 'docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    binary: true,
  },
  md: {
    extension: 'md',
    mimeType: 'text/markdown;charset=utf-8',
    binary: false,
  },
  html: {
    extension: 'html',
    mimeType: 'text/html;charset=utf-8',
    binary: false,
  },
  tex: {
    extension: 'tex',
    mimeType: 'application/x-tex;charset=utf-8',
    binary: false,
  },
};

type Uint8ArrayWithFromBase64 = typeof Uint8Array & {
  fromBase64?: (b64: string) => Uint8Array<ArrayBuffer>;
};

function decodeBase64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const ctor = Uint8Array as Uint8ArrayWithFromBase64;
  if (typeof ctor.fromBase64 === 'function') {
    return ctor.fromBase64(base64);
  }

  const binaryStr = window.atob(base64);
  const len = binaryStr.length;
  const bytes = new Uint8Array(new ArrayBuffer(len));
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return bytes;
}

async function exportDoc(
  format: DocumentExportFormat,
  { docId, title, includeChildren = true }: ExportDocOptions,
): Promise<string> {
  const spec = DOC_FORMATS[format];
  if (!spec) {
    throw new Error(`Unsupported document export format: "${format}"`);
  }

  const res = await exportDocs.exportDocument(docId, format, includeChildren);
  const isBase64 = res.isBase64 ?? spec.binary;
  const payload = isBase64 ? decodeBase64ToBytes(res.content) : res.content;
  const blob = new Blob([payload], { type: res.mimeType || spec.mimeType });
  const filename = res.filename || `${sanitizeSlug(title)}.${spec.extension}`;

  triggerFileDownload(blob, filename);
  return filename;
}

export function exportDocx(options: ExportDocOptions): Promise<string> {
  return exportDoc('docx', options);
}

export function exportMarkdown(options: ExportDocOptions): Promise<string> {
  return exportDoc('md', options);
}

export function exportHtml(options: ExportDocOptions): Promise<string> {
  return exportDoc('html', options);
}
