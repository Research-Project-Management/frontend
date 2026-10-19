/**
 * src/features/editor/subsystems/navigation/index.ts
 *
 * Navigation Subsystem Public Seam & Facade Port (Matt Pocock Deep Module).
 *
 * Responsibilities:
 * - Cross-file and cross-pane document switching.
 * - Bidirectional SyncTeX jump (Editor -> PDF and PDF -> Editor).
 * - Diagnostic error step navigation (Next / Previous error).
 * - Multi-window Popout / BroadcastChannel synchronization.
 */

export {
  navigationCoordinator,
  NavigationCoordinatorRegistry,
  jumpToEditorLine,
  defaultNavigationNotifier,
  type OpenDocumentOptions,
  type PendingLineJump,
  type NavigationNotificationPort,
} from './coordinator/navigation.coordinator';
