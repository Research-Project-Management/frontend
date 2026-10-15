/**
 * review-service-port.ts
 *
 * Real Seams & Ports (Domain Layer) for Review & Suggestion management.
 * Follows Matt Pocock's Codebase Design principles:
 * - Pure interfaces defining capabilities without concrete SDK/UI dependencies.
 */

export interface ReviewServicePort {
  acceptSuggestion(pageId: string, suggestionId: string): Promise<unknown>;
  rejectSuggestion(pageId: string, suggestionId: string): Promise<unknown>;
  acceptAllSuggestions(pageId: string): Promise<unknown>;
  rejectAllSuggestions(pageId: string): Promise<unknown>;
  acceptSelectedSuggestions(pageId: string, suggestionIds: string[]): Promise<unknown>;
  rejectSelectedSuggestions(pageId: string, suggestionIds: string[]): Promise<unknown>;
}

export interface ReviewNotificationPort {
  notifySuccess(message: string, id?: string): void;
  notifyError(message: string, id?: string): void;
}

export interface ReviewPendingComment {
  startLine: number;
  endLine: number;
  selectedText: string;
}

export interface ReviewStorePort {
  setPendingComment(comment: ReviewPendingComment | null): void;
  openReviewSidebar(): void;
}

