/**
 * doc-export.ts
 *
 * Data-driven single-document formatted export (`POST /api/v1/pages/docs/:pageId/export`)
 * with native zero-copy `Uint8Array.fromBase64` binary decoding when supported by runtime.
 */

import { exportDocs } from '../pages/export.client';
import type { DocumentExportFormat } from '@/features/editor/domain/types/export.types';
import { sanitizeDocExportSlug, triggerFileDownload } from './download';

export interface ExportSingleDocOptions {
  docId: string;
  projectTitle?: string;
  includeChildren?: boolean;
}

interface DocFormatSpec {
  extension: string;
  mimeType: string;
  binary: boolean;
}

const DOC_FORMATS: Partial<Record<DocumentExportFormat, DocFormatSpec>> = {
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

export async function exportFormattedDocument(
  format: DocumentExportFormat,
  { docId, projectTitle, includeChildren = true }: ExportSingleDocOptions,
): Promise<string> {
  const spec = DOC_FORMATS[format];
  if (!spec) {
    throw new Error(`Unsupported document export format: "${format}"`);
  }

  const res = await exportDocs.exportDocument(docId, format, includeChildren);
  const payload = spec.binary ? decodeBase64ToBytes(res.content) : res.content;
  const blob = new Blob([payload], { type: spec.mimeType });
  const filename =
    res.filename || `${sanitizeDocExportSlug(projectTitle)}.${spec.extension}`;

  triggerFileDownload(blob, filename);
  return filename;
}

export function exportDocumentAsWord(options: ExportSingleDocOptions): Promise<string> {
  return exportFormattedDocument('docx', options);
}

export function exportDocumentAsMarkdown(options: ExportSingleDocOptions): Promise<string> {
  return exportFormattedDocument('md', options);
}

export function exportDocumentAsHtml(options: ExportSingleDocOptions): Promise<string> {
  return exportFormattedDocument('html', options);
}
