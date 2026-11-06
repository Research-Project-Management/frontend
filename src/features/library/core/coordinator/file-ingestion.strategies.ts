import {
  executeLibraryIngestion,
  pollIngestionRunCompletion,
  lookupAcademicIdentifierDirect,
  fetchIngestionRunProgress,
} from '@/features/library/sdk/queries/ingestion.queries';
import {
  uploadLibraryFileMultipart,
  type UploadedMultipartFile,
} from '@/features/library/sdk/queries/extraction.queries';
import { cleanFilenameToTitle } from '@/features/library/domain/metadata.mapper';
import {
  computeEdgeFileSha256,
  sniffPdfEdgeIdentifier,
} from '@/features/library/domain/identifiers.domain';
import type { ProcessModalStoreApi } from '@/features/library/types/ingestion.types';

interface BatchTask<TInput = unknown, TOutput = unknown> {
  id: string;
  name: string;
  data: TInput;
  execute: (input: TInput, signal: AbortSignal) => Promise<TOutput>;
  retries?: number;
}

interface BatchFlowOptions {
  concurrency?: number;
  maxRetries?: number;
  retryBaseDelayMs?: number;
  abortSignal?: AbortSignal;
}

interface BatchFlowProgress<TOutput = unknown> {
  total: number;
  completed: number;
  succeeded: number;
  failed: number;
  percentage: number;
  results: Map<string, TOutput>;
  errors: Map<string, Error>;
}

type BatchFlowEventListener<TOutput = unknown> = (
  progress: BatchFlowProgress<TOutput>,
) => void;

export class BatchFlowManager<TInput = unknown, TOutput = unknown> {
  private readonly concurrency: number;
  private readonly maxRetries: number;
  private readonly retryBaseDelayMs: number;
  private readonly abortController: AbortController;
  private readonly progressListeners = new Set<BatchFlowEventListener<TOutput>>();
  private readonly externalSignal?: AbortSignal;
  private isRunning = false;
  private isCancelled = false;

  constructor(options: BatchFlowOptions = {}) {
    this.concurrency = Math.max(1, options.concurrency ?? 4);
    this.maxRetries = options.maxRetries ?? 2;
    this.retryBaseDelayMs = options.retryBaseDelayMs ?? 500;
    this.abortController = new AbortController();
    this.externalSignal = options.abortSignal;
    if (this.externalSignal?.aborted) this.cancel();
  }

  onProgress(listener: BatchFlowEventListener<TOutput>): () => void {
    this.progressListeners.add(listener);
    return () => this.progressListeners.delete(listener);
  }

  cancel(): void {
    if (this.isCancelled) return;
    this.isCancelled = true;
    this.abortController.abort();
  }

  async execute(tasks: BatchTask<TInput, TOutput>[]): Promise<BatchFlowProgress<TOutput>> {
    if (this.isRunning) throw new Error('BatchFlowManager is already running an active task flow.');
    this.isRunning = true;
    const onExternalAbort = () => this.cancel();
    if (this.externalSignal) {
      if (this.externalSignal.aborted) this.cancel();
      else this.externalSignal.addEventListener('abort', onExternalAbort, { once: true });
    }
    const total = tasks.length;
    const results = new Map<string, TOutput>();
    const errors = new Map<string, Error>();
    let completed = 0;
    let succeeded = 0;
    let failed = 0;

    const notify = () => {
      const percentage = total > 0 ? Math.round((completed / total) * 100) : 100;
      const snapshot: BatchFlowProgress<TOutput> = { total, completed, succeeded, failed, percentage, results, errors };
      this.progressListeners.forEach((l) => { try { l(snapshot); } catch { /* ignore */ } });
    };

    try {
      if (total === 0) return { total: 0, completed: 0, succeeded: 0, failed: 0, percentage: 100, results, errors };
      const queue = [...tasks];
      const runWorker = async (): Promise<void> => {
        while (queue.length > 0 && !this.isCancelled) {
          const task = queue.shift();
          if (!task) break;
          let attempt = 0;
          const taskMaxRetries = task.retries ?? this.maxRetries;
          let lastError: Error = new Error(`Task ${task.id} failed without execution.`);
          while (attempt <= taskMaxRetries && !this.isCancelled) {
            try {
              const res = await task.execute(task.data, this.abortController.signal);
              results.set(task.id, res);
              succeeded++;
              completed++;
              notify();
              lastError = undefined as unknown as Error;
              break;
            } catch (err: unknown) {
              lastError = err instanceof Error ? err : new Error(String(err));
              attempt++;
              if (attempt <= taskMaxRetries && !this.isCancelled) {
                const delay = this.retryBaseDelayMs * Math.pow(2, attempt - 1) + Math.random() * 100;
                await new Promise<void>((resolve) => {
                  if (this.abortController.signal.aborted) { resolve(); return; }
                  const onAbort = () => { clearTimeout(timer); resolve(); };
                  const timer = setTimeout(() => {
                    this.abortController.signal.removeEventListener('abort', onAbort);
                    resolve();
                  }, delay);
                  this.abortController.signal.addEventListener('abort', onAbort, { once: true });
                });
              }
            }
          }
          if (lastError && !this.isCancelled) {
            errors.set(task.id, lastError);
            failed++;
            completed++;
            notify();
          }
        }
      };
      const workerCount = Math.min(this.concurrency, total);
      await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
      return { total, completed, succeeded, failed, percentage: total > 0 ? Math.round((completed / total) * 100) : 100, results, errors };
    } finally {
      this.isRunning = false;
      this.externalSignal?.removeEventListener('abort', onExternalAbort);
    }
  }
}

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
  '.bib', '.bibtex', '.ris', '.csl.json', '.json', '.csl', '.mods', '.rdf', '.xml', '.nbib', '.medline', '.txt', '.csv',
];

export function detectBibliographyFileFormat(
  file: Pick<File, 'name'>,
  textSample?: string,
): BibliographyTextFormat | null {
  const lowerName = file.name.toLowerCase();

  if (lowerName.endsWith('.bib') || lowerName.endsWith('.bibtex')) return 'bibtex';
  if (lowerName.endsWith('.ris')) return 'ris';
  if (lowerName.endsWith('.csl.json') || lowerName.endsWith('.json') || lowerName.endsWith('.csl')) return 'csl_json';
  if (lowerName.endsWith('.mods')) return 'mods';
  if (lowerName.endsWith('.rdf')) return 'zotero_rdf';
  if (lowerName.endsWith('.nbib') || lowerName.endsWith('.medline')) return 'medline';
  if (lowerName.endsWith('.csv')) return 'csv';
  if (lowerName.endsWith('.xml')) {
    if (textSample) {
      if (/<(?:mods:)?mods(?:Collection)?[\s>]/i.test(textSample)) return 'mods';
      if (/<rdf:RDF[\s>]/i.test(textSample)) return 'zotero_rdf';
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
  readonly uploadedCache: Map<File, UploadedMultipartFile>;
  readonly signal?: AbortSignal;
  readonly registerBackgroundExtraction?: (promise: Promise<void>) => void;
  readonly markFileSucceeded: (
    file: File,
    index: number,
    provisionalId: string,
    extractedTitle: string,
    finalItemId?: string,
    updateProvisional?: boolean,
  ) => void;
  readonly markFileFailed?: (
    file: File,
    index: number,
    provisionalId: string,
    errorMsg: string,
  ) => void;
}

export interface IFileIngestionStrategy {
  readonly id: string;
  canHandle(file: File): boolean;
  execute(file: File, ctx: FileIngestionStrategyContext): Promise<void>;
}

async function ingestTextContent(
  file: File,
  source: BibliographyTextFormat,
  content: string,
  ctx: FileIngestionStrategyContext,
): Promise<{ extractedTitle: string; resolvedItemId?: string; runId?: string }> {
  const res = await executeLibraryIngestion(ctx.scopeId, {
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

  return { extractedTitle, resolvedItemId, runId: bibRunId };
}

export const TextBibliographyFileStrategy: IFileIngestionStrategy = {
  id: 'text-bibliography',
  canHandle(file: File): boolean {
    const lowerName = file.name.toLowerCase();
    return TEXT_BIBLIOGRAPHY_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
  },
  async execute(file: File, ctx: FileIngestionStrategyContext): Promise<void> {
    ctx.store.patchBatchItemAndRecalculate(
      ctx.provisionalId,
      { status: 'PROCESSING' },
      { processingPatch: { status: 'PROCESSING' } },
    );

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

export interface QueuedIngestionFileEntry {
  file: File;
  index: number;
  provisionalId: string;
}

export interface BundledTextFileBatch {
  source: BibliographyTextFormat;
  entries: QueuedIngestionFileEntry[];
  mergedContent: string;
  totalBytes: number;
}

const TEXT_BUNDLE_MAX_BYTES = 384 * 1024; // 384 KB byte budget per HTTP request
const TEXT_BUNDLE_MAX_FILES = 150; // Cap files per bundle

/**
 * Computes adaptive upload concurrency from exact byte sizes (KB -> MB) using a 16MB in-flight budget.
 * - Tiny files (< 256 KB avg): scales up to 8-10 concurrent workers
 * - Standard PDFs (1 MB - 4 MB avg): 4-6 concurrent workers
 * - Heavy scans (> 15 MB avg): scales down to 2 concurrent workers to prevent TCP/timeout stalls
 */
export function computeAdaptiveUploadConcurrency(
  files: ReadonlyArray<Pick<File, 'size'>>,
): number {
  if (!files || files.length === 0) return 4;
  const totalBytes = files.reduce((sum, f) => sum + Math.max(0, f.size || 0), 0);
  const avgBytes = totalBytes / files.length;
  const targetBytesInFlight = 16 * 1024 * 1024; // 16 MB
  if (avgBytes <= 256 * 1024) {
    return Math.min(10, Math.max(4, files.length));
  }
  if (avgBytes >= 15 * 1024 * 1024) {
    return 2;
  }
  const computed = Math.round(targetBytesInFlight / Math.max(avgBytes, 1));
  return Math.max(2, Math.min(8, computed));
}

/**
 * Coalesces lightweight text bibliography files (.csv, .bib, .ris, .medline, .txt)
 * by KB byte budget (384 KB) and file count (150 files) so 1,000 tiny CSV/BibTeX files
 * are sent in 7-10 bulk HTTP requests instead of 1,000 individual HTTP requests.
 */
export async function bundleLightweightTextFiles(
  entries: ReadonlyArray<QueuedIngestionFileEntry>,
): Promise<{
  bundles: BundledTextFileBatch[];
  passthroughEntries: QueuedIngestionFileEntry[];
}> {
  const bundles: BundledTextFileBatch[] = [];
  const passthroughEntries: QueuedIngestionFileEntry[] = [];
  const activeBuckets = new Map<
    string,
    {
      source: BibliographyTextFormat;
      csvHeader?: string;
      entries: QueuedIngestionFileEntry[];
      chunks: string[];
      totalBytes: number;
    }
  >();

  const flushBucket = (key: string) => {
    const bucket = activeBuckets.get(key);
    if (!bucket || bucket.entries.length === 0) return;
    activeBuckets.delete(key);
    if (bucket.entries.length === 1) {
      passthroughEntries.push(bucket.entries[0]!);
      return;
    }
    const mergedContent =
      bucket.source === 'csl_json'
        ? `[${bucket.chunks.join(',')}]`
        : bucket.source === 'csv' && bucket.csvHeader
          ? `${bucket.csvHeader}\n${bucket.chunks.join('\n')}`
          : bucket.chunks.join('\n\n');
    bundles.push({
      source: bucket.source,
      entries: bucket.entries,
      mergedContent,
      totalBytes: bucket.totalBytes,
    });
  };

  for (const entry of entries) {
    const { file } = entry;
    // Only bundle lightweight text files (<= 128 KB each)
    if (
      !TextBibliographyFileStrategy.canHandle(file) ||
      file.size > 128 * 1024 ||
      file.size === 0
    ) {
      passthroughEntries.push(entry);
      continue;
    }

    let rawText = '';
    try {
      rawText = (await file.text()).trim();
    } catch {
      passthroughEntries.push(entry);
      continue;
    }
    if (!rawText) {
      passthroughEntries.push(entry);
      continue;
    }

    const format = detectBibliographyFileFormat(file, rawText);
    if (
      format !== 'csv' &&
      format !== 'bibtex' &&
      format !== 'ris' &&
      format !== 'medline' &&
      format !== 'csl_json'
    ) {
      passthroughEntries.push(entry);
      continue;
    }

    let bucketKey: string = format;
    let payloadChunk = rawText;
    let csvHeader: string | undefined;

    if (format === 'csl_json') {
      try {
        const parsed = JSON.parse(rawText) as unknown;
        const arr = Array.isArray(parsed) ? parsed : [parsed];
        const validObjs = arr.filter(
          (item) => item && typeof item === 'object' && !Array.isArray(item),
        );
        if (validObjs.length === 0) {
          passthroughEntries.push(entry);
          continue;
        }
        payloadChunk = validObjs.map((o) => JSON.stringify(o)).join(',');
      } catch {
        passthroughEntries.push(entry);
        continue;
      }
    } else if (format === 'csv') {
      const lines = rawText.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length < 2) {
        passthroughEntries.push(entry);
        continue;
      }
      csvHeader = lines[0]!.trim();
      payloadChunk = lines.slice(1).join('\n');
      bucketKey = `csv:${csvHeader.toLowerCase()}`;
    }

    const byteLen = payloadChunk.length;
    const existing = activeBuckets.get(bucketKey);
    if (
      existing &&
      (existing.totalBytes + byteLen > TEXT_BUNDLE_MAX_BYTES ||
        existing.entries.length >= TEXT_BUNDLE_MAX_FILES)
    ) {
      flushBucket(bucketKey);
    }

    let target = activeBuckets.get(bucketKey);
    if (!target) {
      target = {
        source: format,
        csvHeader,
        entries: [],
        chunks: [],
        totalBytes: csvHeader ? csvHeader.length + 1 : 0,
      };
      activeBuckets.set(bucketKey, target);
    }

    target.entries.push(entry);
    target.chunks.push(payloadChunk);
    target.totalBytes += byteLen + 2;
  }

  for (const key of Array.from(activeBuckets.keys())) {
    flushBucket(key);
  }

  return { bundles, passthroughEntries };
}

const MAX_CONCURRENT_BACKGROUND_POLLS = 4;
let activeBackgroundPolls = 0;
const backgroundPollWaiters: Array<() => void> = [];

async function withBoundedBackgroundPoll<T>(fn: () => Promise<T>): Promise<T> {
  if (activeBackgroundPolls >= MAX_CONCURRENT_BACKGROUND_POLLS) {
    await new Promise<void>((resolve) => backgroundPollWaiters.push(resolve));
  }
  activeBackgroundPolls++;
  try {
    return await fn();
  } finally {
    activeBackgroundPolls--;
    const next = backgroundPollWaiters.shift();
    if (next) next();
  }
}

const EDGE_UPLOAD_HASH_TTL_MS = 60_000;
const edgeUploadHashInFlight = new Map<
  string,
  { expiresAt: number; promise: Promise<UploadedMultipartFile> }
>();

export const BinaryAttachmentFileStrategy: IFileIngestionStrategy = {
  id: 'binary-attachment',
  canHandle(_file: File): boolean {
    return true;
  },
  async execute(file: File, ctx: FileIngestionStrategyContext): Promise<void> {
    // 1. Surgical 128KB PDF Sniffing + Direct Browser-IP Resolution IN PARALLEL with network upload
    const edgeResolutionPromise = sniffPdfEdgeIdentifier(file)
      .then((sniffed) => {
        if (!sniffed) return null;
        if (sniffed.type === 'doi') return lookupAcademicIdentifierDirect({ source: 'doi', doi: sniffed.value });
        if (sniffed.type === 'arxiv') return lookupAcademicIdentifierDirect({ source: 'arxiv', arxivId: sniffed.value });
        if (sniffed.type === 'pmid') return lookupAcademicIdentifierDirect({ source: 'pmid', pmid: sniffed.value });
        return lookupAcademicIdentifierDirect({ source: 'url', url: sniffed.value });
      })
      .catch(() => null);

    // 2. WebCrypto SHA-256 Pre-Flight Upload Deduplication (TTL-bounded to 60s to prevent stale fileId)
    let uploadRes = ctx.uploadedCache.get(file);
    if (!uploadRes) {
      const contentHash = await computeEdgeFileSha256(file);
      const hashCacheKey = contentHash ? `${ctx.scopeId}:${contentHash}` : null;
      const now = Date.now();
      const cachedEntry = hashCacheKey ? edgeUploadHashInFlight.get(hashCacheKey) : undefined;

      if (cachedEntry && cachedEntry.expiresAt > now) {
        uploadRes = await cachedEntry.promise;
      } else {
        if (hashCacheKey && cachedEntry) edgeUploadHashInFlight.delete(hashCacheKey);
        const uploadTask = uploadLibraryFileMultipart(ctx.scopeId, file, {
          onProgress: (percent: number) => {
            ctx.store.updateProcessingItem(ctx.provisionalId, { progress: percent });
          },
          signal: ctx.signal,
        });
        if (hashCacheKey) {
          edgeUploadHashInFlight.set(hashCacheKey, {
            expiresAt: now + EDGE_UPLOAD_HASH_TTL_MS,
            promise: uploadTask,
          });
        }
        try {
          uploadRes = await uploadTask;
        } catch (err) {
          if (hashCacheKey) edgeUploadHashInFlight.delete(hashCacheKey);
          throw err;
        }
      }
      if (uploadRes?.fileId) {
        ctx.uploadedCache.set(file, uploadRes);
      }
    }

    if (!uploadRes?.fileId) {
      throw new Error('Upload succeeded without file identifier');
    }

    const edgeOverrides = await edgeResolutionPromise;
    const edgeTitle =
      typeof edgeOverrides?.title === 'string' && edgeOverrides.title.trim()
        ? edgeOverrides.title.trim()
        : undefined;
    const identifiedTitle = edgeTitle || cleanFilenameToTitle(file.name);

    ctx.store.patchBatchItemAndRecalculate(
      ctx.provisionalId,
      { status: 'PROCESSING', ...(edgeTitle ? { itemName: edgeTitle } : {}) },
      {
        ...(edgeTitle ? { currentTitle: edgeTitle } : {}),
        processingPatch: {
          status: 'PROCESSING',
          fileId: uploadRes.fileId,
          fileUrl: uploadRes.url,
          ...(edgeTitle ? { extractedTitle: edgeTitle } : {}),
          progress: 100,
        },
      },
    );

    const ingestRes = await executeLibraryIngestion(
      ctx.scopeId,
      {
        source: 'pdf',
        fileId: uploadRes.fileId,
        filename: file.name,
        collectionId: ctx.effectiveCollection,
        ...(edgeOverrides
          ? { overrides: { ...edgeOverrides, _clientResolved: true } }
          : {}),
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

    if (runId) {
      ctx.store.patchBatchItemAndRecalculate(
        ctx.provisionalId,
        { status: 'PROCESSING', itemName: identifiedTitle, itemId: completedItemId },
        {
          currentTitle: identifiedTitle,
          processingPatch: {
            status: 'PROCESSING',
            extractedTitle: identifiedTitle,
            ...(completedItemId ? { itemId: completedItemId } : {}),
            progress: 95,
          },
        },
      );

      const extractionPromise = withBoundedBackgroundPoll(() =>
        pollIngestionRunCompletion(ctx.scopeId, runId, {
          fallbackTitle: identifiedTitle,
          initialItemId: completedItemId,
          signal: ctx.signal,
        }),
      )
        .then((pollOutcome) => {
          if (pollOutcome.ok) {
            ctx.markFileSucceeded(file, ctx.index, ctx.provisionalId, pollOutcome.title || identifiedTitle, pollOutcome.itemId || completedItemId, true);
          } else {
            ctx.markFileFailed?.(file, ctx.index, ctx.provisionalId, pollOutcome.error || 'Extraction failed');
          }
        })
        .catch((err: unknown) => {
          ctx.markFileFailed?.(file, ctx.index, ctx.provisionalId, err instanceof Error ? err.message : String(err));
        });

      if (ctx.registerBackgroundExtraction) ctx.registerBackgroundExtraction(extractionPromise);
      else await extractionPromise;
      return;
    }

    ctx.markFileSucceeded(file, ctx.index, ctx.provisionalId, identifiedTitle, completedItemId, true);
  },
};

const FILE_INGESTION_STRATEGY_REGISTRY: ReadonlyArray<IFileIngestionStrategy> = [
  TextBibliographyFileStrategy,
  BinaryAttachmentFileStrategy,
];

export function resolveFileIngestionStrategy(file: File): IFileIngestionStrategy {
  return (
    FILE_INGESTION_STRATEGY_REGISTRY.find((strategy) => strategy.canHandle(file)) ||
    BinaryAttachmentFileStrategy
  );
}

export async function executeBundledTextBatch(
  bundle: BundledTextFileBatch,
  ctx: {
    scopeId: string;
    effectiveCollection?: string;
    store: ProcessModalStoreApi;
    signal?: AbortSignal;
    markFileSucceeded: FileIngestionStrategyContext['markFileSucceeded'];
    markFileFailed: NonNullable<FileIngestionStrategyContext['markFileFailed']>;
  },
): Promise<void> {
  if (ctx.signal?.aborted) throw new Error('Processing cancelled');
  const firstEntry = bundle.entries[0]!;
  for (const entry of bundle.entries) {
    ctx.store.patchBatchItemAndRecalculate(
      entry.provisionalId,
      { status: 'PROCESSING', error: undefined },
      { processingPatch: { status: 'PROCESSING' } },
    );
  }
  try {
    const { extractedTitle, resolvedItemId, runId } = await ingestTextContent(
      firstEntry.file,
      bundle.source,
      bundle.mergedContent,
      {
        scopeId: ctx.scopeId,
        index: firstEntry.index,
        provisionalId: firstEntry.provisionalId,
        effectiveCollection: ctx.effectiveCollection,
        store: ctx.store,
        uploadedCache: new Map(),
        signal: ctx.signal,
        markFileSucceeded: ctx.markFileSucceeded,
        markFileFailed: ctx.markFileFailed,
      },
    );
    let progressItems: Array<{ title?: string; status?: string; itemId?: string; error?: string }> = [];
    if (runId) {
      try {
        const pr = (await fetchIngestionRunProgress(ctx.scopeId, runId)) as {
          items?: Array<{ title?: string; status?: string; itemId?: string; error?: string }>;
        } | null;
        if (Array.isArray(pr?.items)) progressItems = pr.items;
      } catch {
        // Progress fetch is optional
      }
    }
    bundle.entries.forEach((entry, idx) => {
      const itemOutcome = progressItems.length === bundle.entries.length ? progressItems[idx] : undefined;
      if (itemOutcome?.status === 'FAILED') {
        ctx.markFileFailed(entry.file, entry.index, entry.provisionalId, itemOutcome.error || 'Record import failed');
      } else {
        ctx.markFileSucceeded(
          entry.file,
          entry.index,
          entry.provisionalId,
          itemOutcome?.title || entry.file.name || extractedTitle,
          itemOutcome?.itemId || resolvedItemId,
          true,
        );
      }
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Bundled import failed';
    for (const entry of bundle.entries) {
      ctx.markFileFailed(entry.file, entry.index, entry.provisionalId, errorMsg);
    }
  }
}
