/**
 * shared/hooks/index.ts
 * Barrel export - only truly global hooks with zero feature dependencies.
 */

export { useDebounce } from './use-debounce';
export { useLocalStorage } from './use-local-storage';
export { useCopyToClipboard } from './use-copy-to-clipboard';
export {
  useMediaQuery,
  useIsMobile,
  useIsSm,
  useIsMd,
  useIsLg,
  useIsXl,
  usePrefersReducedMotion,
} from './use-media-query';
export { useUpload, type UploadOptions } from './use-upload';
export {
  useWorkspacePermission,
  useProjectPermission,
  type WorkspacePermissionResult,
  type ProjectPermissionResult,
} from './use-permission';
