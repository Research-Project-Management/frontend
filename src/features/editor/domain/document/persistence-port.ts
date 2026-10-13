/**
 * persistence-port.ts
 *
 * Real Seam (Domain Layer) for Document Persistence.
 * Follows Matt Pocock's Codebase Design principles:
 * - Two adapters means a real seam: Production (HTTP/manuscriptService) vs In-Memory Stand-in (Unit Tests).
 * - Callers can inject a test adapter directly across the seam without vi.mock / monkey-patching.
 */

export interface DocumentPersistencePort {
  /**
   * Persists updated document content to server/remote storage.
   */
  updateContent(fileId: string, content: string): Promise<unknown>;

  /**
   * Optional hook called after a successful REST save to notify realtime bridges.
   */
  markSaved?(fileId: string): void;
}
