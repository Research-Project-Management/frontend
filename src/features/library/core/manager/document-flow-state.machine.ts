'use client';

/**
 * Document Ingestion & Processing Lifecycle States
 */
export type DocumentLifecycleState =
  | 'IDLE'
  | 'PROVISIONAL'
  | 'UPLOADING'
  | 'INGESTING'
  | 'EXTRACTING'
  | 'READY'
  | 'FAILED'
  | 'CANCELLED';

export type DocumentLifecycleEvent =
  | { type: 'QUEUE'; provisionalId: string; fileName: string; fileSize: number }
  | { type: 'START_UPLOAD' }
  | { type: 'UPLOAD_PROGRESS'; progress: number }
  | { type: 'UPLOAD_COMPLETED'; fileId: string }
  | { type: 'START_EXTRACTION'; runId: string }
  | { type: 'COMPLETE'; itemId: string; title: string }
  | { type: 'FAIL'; error: string }
  | { type: 'CANCEL' }
  | { type: 'RETRY' };

export interface DocumentFlowContext {
  id: string;
  fileName: string;
  fileSize: number;
  provisionalId?: string;
  fileId?: string;
  runId?: string;
  itemId?: string;
  title?: string;
  progress: number;
  error: string | null;
  startedAt: number;
  updatedAt: number;
}

export type DocumentFlowListener = (
  state: DocumentLifecycleState,
  context: DocumentFlowContext,
  event: DocumentLifecycleEvent,
) => void;

/**
 * Valid state transition matrix (Finite State Machine).
 * Enforces legal state progression and rejects illegal/out-of-order transitions.
 */
const VALID_TRANSITIONS: Record<DocumentLifecycleState, Set<DocumentLifecycleEvent['type']>> = {
  IDLE: new Set(['QUEUE']),
  PROVISIONAL: new Set(['START_UPLOAD', 'FAIL', 'CANCEL']),
  UPLOADING: new Set(['UPLOAD_PROGRESS', 'UPLOAD_COMPLETED', 'FAIL', 'CANCEL', 'COMPLETE']),
  INGESTING: new Set(['START_EXTRACTION', 'COMPLETE', 'FAIL', 'CANCEL']),
  EXTRACTING: new Set(['COMPLETE', 'FAIL', 'CANCEL']),
  READY: new Set([]), // Terminal
  FAILED: new Set(['RETRY']),
  CANCELLED: new Set(['RETRY']),
};

/**
 * DocumentFlowStateMachine
 *
 * Classic Deterministic Finite State Machine (FSM) Pattern for document ingestion.
 * Prevents race conditions, duplicate terminal events, and erratic UI flashing
 * when parallel asynchronous uploads and webhooks return in arbitrary order.
 */
export class DocumentFlowStateMachine {
  private _state: DocumentLifecycleState = 'IDLE';
  private _context: DocumentFlowContext;
  private readonly _listeners = new Set<DocumentFlowListener>();

  constructor(initialId: string, initialFileName = '', initialFileSize = 0) {
    const now = Date.now();
    this._context = {
      id: initialId,
      fileName: initialFileName,
      fileSize: initialFileSize,
      progress: 0,
      error: null,
      startedAt: now,
      updatedAt: now,
    };
  }

  get state(): DocumentLifecycleState {
    return this._state;
  }

  get context(): Readonly<DocumentFlowContext> {
    return this._context;
  }

  get isTerminal(): boolean {
    return this._state === 'READY' || this._state === 'FAILED' || this._state === 'CANCELLED';
  }

  get isActive(): boolean {
    return (
      this._state === 'PROVISIONAL' ||
      this._state === 'UPLOADING' ||
      this._state === 'INGESTING' ||
      this._state === 'EXTRACTING'
    );
  }

  /**
   * Subscribe to state transition events.
   * Returns an unsubscribe function.
   */
  subscribe(listener: DocumentFlowListener): () => void {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  /**
   * Transitions the machine with the given event if permitted by the transition table.
   * Returns true if transition was accepted, false if ignored.
   */
  transition(event: DocumentLifecycleEvent): boolean {
    const allowedEvents = VALID_TRANSITIONS[this._state];
    if (!allowedEvents.has(event.type)) {
      return false;
    }

    const previousState = this._state;
    this._context.updatedAt = Date.now();

    switch (event.type) {
      case 'QUEUE':
        this._state = 'PROVISIONAL';
        this._context.provisionalId = event.provisionalId;
        this._context.fileName = event.fileName;
        this._context.fileSize = event.fileSize;
        break;

      case 'START_UPLOAD':
        this._state = 'UPLOADING';
        this._context.progress = 0;
        break;

      case 'UPLOAD_PROGRESS':
        this._context.progress = Math.min(100, Math.max(0, event.progress));
        break;

      case 'UPLOAD_COMPLETED':
        this._state = 'INGESTING';
        this._context.fileId = event.fileId;
        this._context.progress = 100;
        break;

      case 'START_EXTRACTION':
        this._state = 'EXTRACTING';
        this._context.runId = event.runId;
        break;

      case 'COMPLETE':
        this._state = 'READY';
        this._context.itemId = event.itemId;
        this._context.title = event.title;
        this._context.progress = 100;
        this._context.error = null;
        break;

      case 'FAIL':
        this._state = 'FAILED';
        this._context.error = event.error;
        break;

      case 'CANCEL':
        this._state = 'CANCELLED';
        break;

      case 'RETRY':
        this._state = 'PROVISIONAL';
        this._context.error = null;
        this._context.progress = 0;
        break;
    }

    this._notify(this._state, event);
    return true;
  }

  private _notify(state: DocumentLifecycleState, event: DocumentLifecycleEvent): void {
    const ctxCopy = { ...this._context };
    this._listeners.forEach((listener) => {
      try {
        listener(state, ctxCopy, event);
      } catch {
        // Prevent listener errors from corrupting state machine loop
      }
    });
  }
}
