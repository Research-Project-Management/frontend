/**
 * pdf-viewer.port.ts
 *
 * Core Port (Contract): Interface that any PDF rendering engine (PDF.js, WebViewer)
 * must implement to plug into the Flux PDF Viewer subsystem.
 * Dependency Rule: ZERO UI or framework dependencies.
 */

export interface IPdfViewer {
  /** Retrieves active page index (1-based) */
  getPageNumber(): number;

  /** Retrieves total count of pages */
  getNumPages(): number;

  /** Navigates viewport to target page number */
  gotoPage(pageNumber: number): void;

  /** Sets zoom scale multiplier (e.g. 1.0, 1.25, 1.5) */
  setZoom(scale: number): void;

  /** Gets current zoom scale */
  getZoom(): number;

  /** Increments zoom by step */
  zoomIn(): void;

  /** Decrements zoom by step */
  zoomOut(): void;

  /** Adjusts scale to fit viewport width */
  fitWidth(): void;

  /** Adjusts scale to fit viewport height */
  fitHeight(): void;

  /** Navigates to exact page and scrolls to point coordinates (e.g. from SyncTeX) */
  scrollToCoordinates(pageNumber: number, x: number, y: number): void;

  /** Subscribes to active page index changes */
  onPageChange(handler: (pageNumber: number) => void): () => void;

  /** Cleanup handler invoked on unmount */
  onDestroy(): void;
}
