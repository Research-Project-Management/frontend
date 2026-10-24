import { WorkspaceShellSkeleton } from '@/shared/components/layout/WorkspaceSkeleton';

/**
 * Next.js App Router Unified Workspace Shell Loading Placeholder.
 * Delegates to the centralized WorkspaceSkeleton design system module.
 */
export default function AppLoading() {
  return <WorkspaceShellSkeleton />;
}
