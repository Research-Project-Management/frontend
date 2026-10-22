'use client';

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

/**
 * BatchFlowManager
 *
 * Classic Bounded Worker Pool & Concurrency Flow Manager.
 * Orchestrates high-volume parallel operations (multi-file uploads, bulk metadata extraction)
 * with strict resource caps, exponential backoff retries, and comprehensive abort management.
 */
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

  /**
   * Subscribes to incremental progress events during batch execution.
   */
  onProgress(listener: BatchFlowEventListener<TOutput>): () => void {
    this.progressListeners.add(listener);
    return () => this.progressListeners.delete(listener);
  }

  /**
   * Cancels the active batch flow and aborts running workers.
   */
  cancel(): void {
    if (this.isCancelled) return;
    this.isCancelled = true;
    this.abortController.abort();
  }

  /**
   * Executes a collection of tasks using the bounded worker pool.
   */
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

    // Queue of task references
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
              await new Promise((r) => setTimeout(r, delay));
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
