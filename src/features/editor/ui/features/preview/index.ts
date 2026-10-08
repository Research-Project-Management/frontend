/**
 * Preview Features Module (Block 6: UI Features Layer).
 * Location: `features/editor/ui/features/preview/index.ts`
 */

export { PdfViewer } from './PdfViewer';
export { PdfToolbar } from './PdfToolbar';
export {
  PdfSurface,
  Surface,
  default as DefaultPdfSurface,
  type SurfaceHandle,
  type PdfSurfaceHandle,
  type SurfaceProps,
  type PdfSurfaceProps,
} from './PdfSurface';
export {
  CompilerLogs,
  Logs,
  LogPanel,
  default as DefaultCompilerLogs,
  parseLatexLog,
} from './CompilerLogs';
export type {
  LogEntry,
  ParsedLog,
  CompilerLogsProps,
  LogsProps,
} from '@/features/editor/domain/types';
export { PdfFindBar } from './PdfFindBar';
export { CompileButton } from './CompileButton';
export { PdfPaginationControls } from './PdfPaginationControls';
export { PdfZoomControls } from './PdfZoomControls';
export { DetachedViewerPlaceholder } from './DetachedViewerPlaceholder';
export { PresentationModeModal } from './PresentationModeModal';
export * from './hooks/use-pdf-compiler';
export * from './hooks/use-pdf-zoom';
export * from './hooks/use-viewer-synctex';
export * from './hooks/use-viewer-popout';
export * from './hooks/use-pdf-search';
export * from './hooks/useLogViewerActions';
