export interface ReviewServicePort {
  acceptSuggestion(docId: string, suggestionId: string): Promise<unknown>;
  rejectSuggestion(docId: string, suggestionId: string): Promise<unknown>;
  acceptAllSuggestions(docId: string): Promise<unknown>;
  rejectAllSuggestions(docId: string): Promise<unknown>;
  acceptSelectedSuggestions(docId: string, suggestionIds: string[]): Promise<unknown>;
  rejectSelectedSuggestions(docId: string, suggestionIds: string[]): Promise<unknown>;
  batchResolve?(
    docId: string,
    payload: { suggestionIds: string[]; action: 'accept' | 'reject' },
  ): Promise<unknown>;
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
