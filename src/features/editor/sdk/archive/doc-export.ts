/**
 * doc-export.ts
 *
 * GoF Strategy + Registry + Template Method for single-document formatted exports
 * (`POST /api/v1/pages/docs/:pageId/export`).
 */

import { exportDocs } from '../pages/export.client';
import type { DocumentExportFormat } from '@/features/editor/domain/types/export.types';
import { sanitizeDocExportSlug, triggerFileDownload } from './download';

export interface ExportSingleDocOptions {
  docId: string;
  projectTitle?: string;
  includeChildren?: boolean;
}

/**
 * GoF Strategy Pattern: Decodes transport payload (`base64` binary vs `utf8` text) into a `Blob`.
 */
interface IPayloadDecoderStrategy {
  toBlob(rawContent: string, mimeType: string): Blob;
}

class Base64BinaryPayloadDecoder implements IPayloadDecoderStrategy {
  public toBlob(rawContent: string, mimeType: string): Blob {
    const binaryStr = window.atob(rawContent);
    const bytes = new Uint8Array(new ArrayBuffer(binaryStr.length));
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    return new Blob([bytes], { type: mimeType });
  }
}

class Utf8TextPayloadDecoder implements IPayloadDecoderStrategy {
  public toBlob(rawContent: string, mimeType: string): Blob {
    return new Blob([rawContent], { type: mimeType });
  }
}

interface IDocExportFormatDescriptor {
  readonly format: DocumentExportFormat;
  readonly extension: string;
  readonly mimeType: string;
  readonly decoder: IPayloadDecoderStrategy;
}

const BINARY_DECODER = new Base64BinaryPayloadDecoder();
const TEXT_DECODER = new Utf8TextPayloadDecoder();

/**
 * GoF Registry Pattern (Open/Closed Principle) for supported single-document export formats.
 */
class DocExportFormatRegistry {
  private readonly formats = new Map<DocumentExportFormat, IDocExportFormatDescriptor>();

  constructor(descriptors: ReadonlyArray<IDocExportFormatDescriptor>) {
    for (const d of descriptors) {
      this.formats.set(d.format, d);
    }
  }

  public resolve(format: DocumentExportFormat): IDocExportFormatDescriptor {
    const found = this.formats.get(format);
    if (!found) {
      throw new Error(`Unsupported document export format: "${format}"`);
    }
    return found;
  }
}

const DOC_EXPORT_REGISTRY = new DocExportFormatRegistry([
  {
    format: 'docx',
    extension: 'docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    decoder: BINARY_DECODER,
  },
  {
    format: 'md',
    extension: 'md',
    mimeType: 'text/markdown;charset=utf-8',
    decoder: TEXT_DECODER,
  },
  {
    format: 'html',
    extension: 'html',
    mimeType: 'text/html;charset=utf-8',
    decoder: TEXT_DECODER,
  },
  {
    format: 'tex',
    extension: 'tex',
    mimeType: 'application/x-tex;charset=utf-8',
    decoder: TEXT_DECODER,
  },
]);

/**
 * GoF Template Method: Executes the unified single-document export lifecycle.
 */
export async function exportFormattedDocument(
  format: DocumentExportFormat,
  { docId, projectTitle, includeChildren = true }: ExportSingleDocOptions,
): Promise<string> {
  const descriptor = DOC_EXPORT_REGISTRY.resolve(format);
  const res = await exportDocs.exportDocument(docId, descriptor.format, includeChildren);
  const blob = descriptor.decoder.toBlob(res.content, descriptor.mimeType);
  const filename =
    res.filename || `${sanitizeDocExportSlug(projectTitle)}.${descriptor.extension}`;
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
