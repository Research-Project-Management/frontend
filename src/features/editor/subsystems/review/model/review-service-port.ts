/**
 * review-service-port.ts
 *
 * Ports & Seams for the ReviewCoordinator Deep Module (Matt Pocock Codebase Design).
 * Allows production adapters (manuscriptService.suggestions, sonner toast, Zustand stores) and
 * in-memory test stand-ins to be swapped cleanly across the boundary.
 */

export interface ReviewServicePort {
  acceptSuggestion(pageId: string, suggestionId: string): Promise<unknown>;
  rejectSuggestion(pageId: string, suggestionId: string): Promise<unknown>;
  acceptAllSuggestions(pageId: string): Promise<unknown>;
  rejectAllSuggestions(pageId: string): Promise<unknown>;
  acceptSelectedSuggestions(pageId: string, suggestionIds: string[]): Promise<unknown>;
  rejectSelectedSuggestions(pageId: string, suggestionIds: string[]): Promise<unknown>;
  createSuggestion?(payload: {
    pageId: string;
    type: 'insert' | 'delete' | 'replace';
    originalText: string;
    suggestedText: string;
    fromLine: number;
    fromColumn: number;
    toLine: number;
    toColumn: number;
    idempotencyKey?: string;
    silent?: boolean;
  }): Promise<{
    id?: string;
    pageId?: string;
    status?: 'pending' | 'accepted' | 'rejected';
  } | null | undefined>;
}

export interface ReviewNotificationPort {
  notifySuccess(message: string, id?: string): void;
  notifyError(message: string, id?: string): void;
}

export interface ReviewStorePort {
  setPendingComment(payload: {
    startLine: number;
    endLine: number;
    selectedText: string;
  }): void;
  openReviewSidebar(): void;
}

export interface ReviewCoordinatorPorts {
  service?: ReviewServicePort;
  notification?: ReviewNotificationPort;
  store?: ReviewStorePort;
}
