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
  AiCoordinatorRegistry,
  type AiContextPayload,
} from './coordinator/ai.coordinator';

export { default as AiTab, default } from './ui/AiTab';
