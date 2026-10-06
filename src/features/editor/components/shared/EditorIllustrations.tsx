'use client';

/**
 * EditorIllustrations.tsx
 * Canonical re-export pointing to global @/shared/components/ui/PlaneEmptyState.
 * Eliminates redundant 650+ lines of local SVG definitions.
 */

export {
  ILLUSTRATION_COLOR_TOKEN_MAP,
  planeIllustrationStyles as editorIllustrationStyles,
  BaseSlabs,
  PlaneEmptyDocumentIllustration as EditorEmptyDocumentIllustration,
  PlaneEmptyPdfIllustration as ViewerEmptyPdfIllustration,
  PlaneDetachedIllustration as ViewerDetachedIllustration,
  PlaneReviewIllustration as EditorReviewIllustration,
  PlaneHistoryIllustration as EditorHistoryIllustration,
  PlaneSearchIllustration as EditorSearchIllustration,
  PlaneFilesStackIllustration as EditorFilesStackIllustration,
  PlaneCitationIllustration as EditorCitationStackIllustration,
  PlaneChatIllustration as EditorChatStackIllustration,
  PlaneLogsIllustration as EditorLogsStackIllustration,
} from '@/shared/components/ui/PlaneEmptyState';
export type { TIllustrationAssetProps } from '@/shared/components/ui/PlaneEmptyState';
