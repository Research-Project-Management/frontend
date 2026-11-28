/**
 * src/features/editor/subsystems/ai/index.ts
 *
 * AI Subsystem Public Seam & Facade Port (Matt Pocock Deep Module).
 *
 * Responsibilities:
 * - AI Research & Error Assist Coordinator.
 * - AI Assistant Sidebar Tab & Streaming Chat Viewlet.
 */

export {
  aiCoordinator,
  AiCoordinator,
  resolveAnchorInContent,
  type ResolvedAnchorRange,
} from './coordinator/ai.coordinator';
export {
  useAiChatActions,
  type UseAiChatActionsOptions,
} from './hooks/useAiChatActions';
export { default as AiTab, default } from './ui/AiTab';
