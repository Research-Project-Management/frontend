import { IngestionService, UploadService } from '@/features/library/sdk/library.client';
import { pollIngestionRunCompletion } from '@/features/library/sdk/queries/ingestion.queries';
import { cleanFilenameToTitle } from '@/features/library/domain/metadata';
import type {
  IngestionProgressItem,
  ProcessModalStoreApi,
} from '@/features/library/domain/types/batch-upload.types';

export type BibliographyTextFormat =
  | 'bibtex'
  | 'ris'
  | 'csl_json'
  | 'endnote_xml'
  | 'mods'
  | 'zotero_rdf'
  | 'medline'
  | 'csv';

const TEXT_BIBLIOGRAPHY_EXTENSIONS: ReadonlyArray<string> = [
  '.bib',
  '.bibtex',
  '.ris',
  '.csl.json',
  '.json',
  '.csl',
  '.mods',
  '.rdf',
  '.xml',
  '.nbib',
  '.medline',
  '.txt',
  '.csv',
];

/**
 * Pure format detector for bibliographic text files.
 * Inspects file extension first, and optionally sniffs `textSample` for XML root-tag
 * or content heuristics (e.g., `.xml` / `.txt` files containing BibTeX, RIS, MODS, RDF, or PubMed MEDLINE).
 */
export function detectBibliographyFileFormat(
  file: Pick<File, 'name'>,
  textSample?: string,
): BibliographyTextFormat | null {
  const lowerName = file.name.toLowerCase();

  if (lowerName.endsWith('.bib') || lowerName.endsWith('.bibtex')) {
    return 'bibtex';
  }
  if (lowerName.endsWith('.ris')) {
    return 'ris';
  }
  if (
    lowerName.endsWith('.csl.json') ||
    lowerName.endsWith('.json') ||
    lowerName.endsWith('.csl')
  ) {
    return 'csl_json';
  }
  if (lowerName.endsWith('.mods')) {
    return 'mods';
  }
  if (lowerName.endsWith('.rdf')) {
    return 'zotero_rdf';
  }
  if (lowerName.endsWith('.nbib') || lowerName.endsWith('.medline')) {
    return 'medline';
  }
  if (lowerName.endsWith('.csv')) {
    return 'csv';
  }
  if (lowerName.endsWith('.xml')) {
    if (textSample) {
      if (/<(?:mods:)?mods(?:Collection)?[\s>]/i.test(textSample)) {
        return 'mods';
      }
      if (/<rdf:RDF[\s>]/i.test(textSample)) {
        return 'zotero_rdf';
      }
    }
    return 'endnote_xml';
  }
  if (lowerName.endsWith('.txt')) {
    if (!textSample) return 'bibtex';
    const trimmed = textSample.trimStart();
    if (/^TY\s+-/m.test(trimmed)) return 'ris';
    if (/^PMID-\s*\d+/m.test(trimmed)) return 'medline';
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) return 'csl_json';
    return 'bibtex';
  }

  return null;
}

export interface FileIngestionStrategyContext {
  readonly scopeId: string;
  readonly index: number;
  readonly provisionalId: string;
  readonly effectiveCollection?: string;
  readonly store: ProcessModalStoreApi;
  readonly uploadedCache: Map<File, Awaited<ReturnType<typeof UploadService.uploadMultipart>>>;
  readonly signal?: AbortSignal;
  readonly markFileSucceeded: (
    file: File,
    index: number,
    provisionalId: string,
    extractedTitle: string,
    finalItemId?: string,
    updateProvisional?: boolean,
  ) => void;
}

/**
 * Strategy Contract for Client-Side File Ingestion Routing (Pattern FE-P2).
 */
export interface IFileIngestionStrategy {
  readonly id: string;
  canHandle(file: File): boolean;
  execute(file: File, ctx: FileIngestionStrategyContext): Promise<void>;
}

/**
 * Helper to ingest bibliographic text content and poll async run completion if queued.
 */
export async function ingestTextContent(
  file: File,
  source: BibliographyTextFormat,
  content: string,
  ctx: FileIngestionStrategyContext,
): Promise<{ extractedTitle: string; resolvedItemId?: string }> {
  const res = await IngestionService.ingest(ctx.scopeId, {
    source,
    content,
    collectionId: ctx.effectiveCollection,
  });

  const resRecord = res as {
    data?: {
      runId?: string;
      itemId?: string;
      item?: { title?: string; id?: string };
    };
    runId?: string;
    itemId?: string;
    item?: { title?: string; id?: string };
  } | null;

  const bibRunId = resRecord?.data?.runId || resRecord?.runId;
  const itemPayload = resRecord?.data?.item || resRecord?.item;
  let extractedTitle = itemPayload?.title || file.name;
  let resolvedItemId =
    itemPayload?.id || resRecord?.data?.itemId || resRecord?.itemId;

  if (bibRunId) {
    const pollOutcome = await pollIngestionRunCompletion(ctx.scopeId, bibRunId, {
      fallbackTitle: extractedTitle,
      initialItemId: resolvedItemId,
      signal: ctx.signal,
    });
    if (!pollOutcome.ok) {
      throw new Error(pollOutcome.error || 'Bibliography import failed');
    }
    extractedTitle = pollOutcome.title || extractedTitle;
    resolvedItemId = pollOutcome.itemId || resolvedItemId;
  }

  return { extractedTitle, resolvedItemId };
}

/**
 * Concrete Strategy 1: Textual Bibliography Files
 * Handles `.bib`, `.bibtex`, `.ris`, `.json`, `.csl`, `.mods`, `.rdf`, `.xml`, `.nbib`, `.medline`, `.txt`, `.csv`
 * with XML root-tag sniffing and dispatches `ingestTextContent`.
 */
export const TextBibliographyFileStrategy: IFileIngestionStrategy = {
  id: 'text-bibliography',
  canHandle(file: File): boolean {
    const lowerName = file.name.toLowerCase();
    return TEXT_BIBLIOGRAPHY_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
  },
  async execute(file: File, ctx: FileIngestionStrategyContext): Promise<void> {
    ctx.store.setState((s) => {
      const items = (s.state.data?.items || []).map((i: IngestionProgressItem) =>
        i.id === ctx.provisionalId ? { ...i, status: 'PROCESSING' as const } : i,
      );
      return {
        processingItems: s.processingItems.map((p) =>
          p.id === ctx.provisionalId ? { ...p, status: 'PROCESSING' } : p,
        ),
        state: s.state.data ? { ...s.state, data: { ...s.state.data, items } } : s.state,
      };
    });

    const content = await file.text();
    const source = detectBibliographyFileFormat(file, content) || 'bibtex';
    const { extractedTitle, resolvedItemId } = await ingestTextContent(
      file,
      source,
      content,
      ctx,
    );

    ctx.markFileSucceeded(
      file,
      ctx.index,
      ctx.provisionalId,
      extractedTitle,
      resolvedItemId,
      true,
    );
  },
};

/**
 * Concrete Strategy 2: Binary / PDF Attachment Upload & Metadata Extraction
 * Handles PDF/binary multipart upload with progress reporting, `uploadedCache` deduplication,
 * and extraction run tracking.
 */
export const BinaryAttachmentFileStrategy: IFileIngestionStrategy = {
  id: 'binary-attachment',
  canHandle(_file: File): boolean {
    return true;
  },
  async execute(file: File, ctx: FileIngestionStrategyContext): Promise<void> {
    let uploadRes = ctx.uploadedCache.get(file);
    if (!uploadRes) {
      uploadRes = await UploadService.uploadMultipart(ctx.scopeId, file, {
        onProgress: (percent: number) => {
          ctx.store.setState((s) => ({
            processingItems: s.processingItems.map((p) =>
              p.id === ctx.provisionalId ? { ...p, progress: percent } : p,
            ),
          }));
        },
        signal: ctx.signal,
      });
      if (uploadRes?.fileId) {
        ctx.uploadedCache.set(file, uploadRes);
      }
    }

    if (!uploadRes?.fileId) {
      throw new Error('Upload succeeded without file identifier');
    }

    ctx.store.setState((s) => {
      const items = s.state.data?.items.map((i: IngestionProgressItem) =>
        i.id === ctx.provisionalId ? { ...i, status: 'PROCESSING' as const } : i,
      );
      return {
        processingItems: s.processingItems.map((p) =>
          p.id === ctx.provisionalId
            ? {
                ...p,
                status: 'PROCESSING',
                fileId: uploadRes?.fileId,
                fileUrl: uploadRes?.url,
                progress: 100,
              }
            : p,
        ),
        state: s.state.data
          ? { ...s.state, data: { ...s.state.data, items: items || [] } }
          : s.state,
      };
    });

    const identifiedTitle = cleanFilenameToTitle(file.name);
    const ingestRes = await IngestionService.ingest(
      ctx.scopeId,
      {
        source: 'pdf',
        fileId: uploadRes.fileId,
        filename: file.name,
        collectionId: ctx.effectiveCollection,
      },
      { signal: ctx.signal },
    );

    const ingestPayload = ingestRes as {
      data?: { runId?: string; itemId?: string; status?: string };
      runId?: string;
      itemId?: string;
      status?: string;
    } | null;
    const runId = ingestPayload?.data?.runId || ingestPayload?.runId;
    const completedItemId = ingestPayload?.data?.itemId || ingestPayload?.itemId;

    let finalTitle = identifiedTitle;
    let finalItemId = completedItemId;

    if (runId) {
      const pollOutcome = await pollIngestionRunCompletion(ctx.scopeId, runId, {
        fallbackTitle: identifiedTitle,
        initialItemId: completedItemId,
        signal: ctx.signal,
      });
      if (!pollOutcome.ok) {
        throw new Error(pollOutcome.error || 'Extraction failed');
      }
      finalTitle = pollOutcome.title || identifiedTitle;
      finalItemId = pollOutcome.itemId || completedItemId;
    }

    ctx.markFileSucceeded(
      file,
      ctx.index,
      ctx.provisionalId,
      finalTitle,
      finalItemId,
      true,
    );
  },
};

export const FILE_INGESTION_STRATEGY_REGISTRY: ReadonlyArray<IFileIngestionStrategy> = [
  TextBibliographyFileStrategy,
  BinaryAttachmentFileStrategy,
];

/**
 * Resolves the appropriate `IFileIngestionStrategy` from the strategy registry.
 */
export function resolveFileIngestionStrategy(file: File): IFileIngestionStrategy {
  return (
    FILE_INGESTION_STRATEGY_REGISTRY.find((strategy) => strategy.canHandle(file)) ||
    BinaryAttachmentFileStrategy
  );
}
