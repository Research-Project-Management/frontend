'use client';

// Public Facade for features/ai — external consumers import ONLY from '@/features/ai'.

export type {
  AgentAction,
  EditorPatchesWidget,
  EditorPatchItem,
  FluxMessage,
  FluxMessageRole,
  HitlDecision,
  HitlInterrupt,
  MessageAttachment,
  MessagePart,
  MetricSummaryWidget,
  ResponseWidget,
  SelectionContextSnapshot,
  SourceItem,
  WorkItemItem,
  WorkItemOverviewWidget,
} from './types/message';

export type { AiStreamEvent } from './types/event';
export type {
  EditorTurnContext,
  PaperTurnContext,
  TurnContext,
  TurnMode,
} from './types/context';
export type {
  ChatSession,
  ChatSessionDetail,
  CreateChatSessionInput,
  DocumentItem,
  KnownAgentId,
  StoredChatMessage,
  ThreadStatus,
} from './types/session';

export type {
  AiTransportPort,
  ResumeRequest,
  StreamRequest,
  StreamResult,
} from './transport/transport.port';
export { FluxHttpTransport, fluxTransport, normalizeSpaceId } from './transport/flux';
export {
  clearPageChat,
  createSession,
  deleteSession,
  fetchSessions,
  getPageChat,
  getSession,
  renameSession,
} from './transport/sessions';
export {
  deleteDocument,
  fetchDocumentContent,
  fetchDocuments,
  fetchDocumentsBulk,
  uploadDocument,
  type UploadDocumentProgress,
} from './transport/docs';

export type {
  ThreadEngine,
  ThreadEngineCallbacks,
  ThreadEngineInit,
  ThreadSnapshot,
} from './engine/engine.port';
export { ThreadPool, threadPool } from './engine/pool';
export {
  aiKeys,
  invalidateAiSessions,
  useAiDocumentContent,
  useAiDocuments,
  useAiSessions,
  useDeleteAiDocument,
  useDeleteAiSession,
  useRenameAiSession,
} from './engine/queries';
export {
  useAiCompanionStore,
  useAiUIStore,
  type AiCompanionState,
  type AiUIState,
  type PendingPromptData,
  type QuotedPassageData,
} from './engine/shell';
export { useAiThread, type UseAiThreadOptions } from './engine/use-thread';

export type {
  AttachedSourcePayload,
  ContextTab,
  FileCategoryMeta,
  LibraryReadiness,
  SourceAdapter,
  SourceEntry,
  SourceType,
  UploadingFile,
} from './context/source.port';
export {
  ACCEPTED_FILE_TYPES,
  formatBytes,
  getFileCategoryMeta,
  getLibraryReadiness,
  getRagDocumentId,
  sourceEntryToAttachedPayload,
  sourcesToAttachments,
} from './context/source.port';
export { useActiveAiSpace, type ActiveAiSpace } from './context/space';
export { useFileUpload } from './context/upload';
export { useTurnContext, type UseTurnContextOptions } from './context/use-context';

export {
  getAgentMeta,
  shouldShowAgentBadge,
  type AgentMeta,
} from './ui/registry/agents';
export {
  getToolMeta,
  getToolUI,
  registerToolUI,
  type ToolCategory,
  type ToolMeta,
  type ToolPartData,
  type ToolUIComponent,
} from './ui/registry/tools';
export { getPartRenderer, registerPartRenderer } from './ui/registry/parts';

export {
  buildCitationLookup,
  parseCitationHref,
  preprocessCitationMarkdown,
} from './ui/parts/citations';
export { CompanionHero } from './ui/parts/CompanionHero';
export { HitlApprovalPart } from './ui/parts/HitlApprovalPart';
export { InlineCitation } from './ui/parts/InlineCitation';
export {
  AgentBadge,
  MessageParts,
  type MessageCodeActions,
} from './ui/parts/MessageParts';
export { SourcesPart } from './ui/parts/SourcesPart';
export { ThinkingPart, parseThinkingContent } from './ui/parts/ThinkingPart';
export { ToolPart, ToolTraceGroup } from './ui/parts/ToolPart';
export { WidgetsPart, type WidgetsPartProps } from './ui/parts/WidgetsPart';

export { Composer, type ComposerProps } from './ui/composer/Composer';
export { AttachmentBar } from './ui/composer/AttachmentBar';
export {
  ContextPicker,
  type ContextPickerProps,
} from './ui/context/ContextPicker';

export { ChatPage } from './ui/workspace/ChatPage';
export { ChatSidebar } from './ui/workspace/ChatSidebar';
export { CompanionDrawer } from './ui/companion/CompanionDrawer';
export { CompanionHistory } from './ui/companion/CompanionHistory';
export {
  CompanionMessages,
  type CompanionSuggestionItem,
} from './ui/companion/CompanionMessages';
