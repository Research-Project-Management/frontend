import { IngestionService, UploadService } from '@/features/library/sdk';
import { pollIngestionRunCompletion } from '@/features/library/sdk/queries/ingestion.queries';
import { cleanFilenameToTitle } from '@/features/library/domain/metadata-mapper';
import type {
  IngestionProgressItem,
  ProcessModalStoreApi,
} from '@/features/library/domain/types/ingestion.types';

export interface BatchTask<TInput = unknown, TOutput = unknown> {
  id: string;
  name: string;
  data: TInput;
  execute: (input: TInput, signal: AbortSignal) => Promise<TOutput>;
  retries?: number;
}

export interface BatchFlowOptions {
  concurrency?: number;
  maxRetries?: number;
  retryBaseDelayMs?: number;
  abortSignal?: AbortSignal;
}

export interface BatchFlowProgress<TOutput = unknown> {
  total: number;
  completed: number;
  succeeded: number;
  failed: number;
  percentage: number;
  results: Map<string, TOutput>;
  errors: Map<string, Error>;
}

export type BatchFlowEventListener<TOutput = unknown> = (
  progress: BatchFlowProgress<TOutput>,
) => void;

export class BatchFlowManager<TInput = unknown, TOutput = unknown> {
  private readonly concurrency: number;
  private readonly maxRetries: number;
  private readonly retryBaseDelayMs: number;
  private readonly abortController: AbortController;
  private readonly progressListeners = new Set<BatchFlowEventListener<TOutput>>();

  private isRunning = false;
  private isCancelled = false;

  constructor(options: BatchFlowOptions = {}) {
    this.concurrency = Math.max(1, options.concurrency ?? 4);
    this.maxRetries = options.maxRetries ?? 2;
    this.retryBaseDelayMs = options.retryBaseDelayMs ?? 500;
    this.abortController = new AbortController();

    if (options.abortSignal) {
      options.abortSignal.addEventListener('abort', () => this.cancel(), { once: true });
    }
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
    if (this.isRunning) {
      throw new Error('BatchFlowManager is already running an active task flow.');
    }
    this.isRunning = true;

    const total = tasks.length;
    const results = new Map<string, TOutput>();
    const errors = new Map<string, Error>();
    let completed = 0;
    let succeeded = 0;
    let failed = 0;

    const notify = () => {
      const percentage = total > 0 ? Math.round((completed / total) * 100) : 100;
      const snapshot: BatchFlowProgress<TOutput> = {
        total,
        completed,
        succeeded,
        failed,
        percentage,
        results,
        errors,
      };
      this.progressListeners.forEach((l) => {
        try {
          l(snapshot);
        } catch {
          // Swallow listener errors
        }
      });
    };

    if (total === 0) {
      this.isRunning = false;
      return { total: 0, completed: 0, succeeded: 0, failed: 0, percentage: 100, results, errors };
    }

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
                if (this.abortController.signal.aborted) {
                  resolve();
                  return;
                }
                const onAbort = () => {
                  clearTimeout(timer);
                  resolve();
                };
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
    const workers = Array.from({ length: workerCount }, () => runWorker());

    await Promise.all(workers);
    this.isRunning = false;

    const finalPercentage = total > 0 ? Math.round((completed / total) * 100) : 100;
    return {
      total,
      completed,
      succeeded,
      failed,
      percentage: finalPercentage,
      results,
      errors,
    };
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

export interface IFileIngestionStrategy {
  readonly id: string;
  canHandle(file: File): boolean;
  execute(file: File, ctx: FileIngestionStrategyContext): Promise<void>;
}

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

export function resolveFileIngestionStrategy(file: File): IFileIngestionStrategy {
  return (
    FILE_INGESTION_STRATEGY_REGISTRY.find((strategy) => strategy.canHandle(file)) ||
    BinaryAttachmentFileStrategy
  );
}
