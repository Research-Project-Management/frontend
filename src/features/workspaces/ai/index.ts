// ── Pages ─────────────────────────────────────────────────────────────────────
export { ChatPage, default as DefaultChatPage } from './pages/chat-page';

// ── Hooks & Context ───────────────────────────────────────────────────────────
export { useChat, useWorkspaceChat } from './hooks/use-chat';
export { ChatModeProvider, useChatMode } from './hooks/use-chat-mode';

// ── Components ────────────────────────────────────────────────────────────────
export { ChatInput, default as DefaultChatInput } from './components/chat/chat-input';
export { ActionCard, ActionCardsGroup } from './components/chat/action-card';
export { ResponseWidgets, buildResponseWidgetsFromActions } from './components/chat/response-widgets';
export { Sidebar, ChatSidebar, FluxAiSidebar, default as DefaultSidebar } from './components/layout/sidebar';
export { Panel, SourcePanel, WikiChatFeatures, default as DefaultPanel } from './components/layout/panel';
export { ChatHistoryModal, default as DefaultChatHistoryModal } from './components/modals/chat-history-modal';
export { SourcePickerModal, default as DefaultSourcePickerModal } from './components/modals/source-picker-modal';

// ── Backward Compatibility Aliases ────────────────────────────────────────────
export { ChatPage as ChatView, default as DefaultChatView } from './pages/chat-page';

// ── Utilities ─────────────────────────────────────────────────────────────────
export { renderMarkdown } from './utils/render-markdown';

// ── Services & Network ────────────────────────────────────────────────────────
export {
  streamChatResponse,
  streamEditorChat,
  listChatSessions,
  getChatSession,
  createChatSession,
  appendChatMessages,
  renameChatSession,
  deleteChatSession,
  clearAiMemory,
  getPageChat,
  clearPageChat,
  uploadDocument,
  fetchDocumentsBulk,
  fetchDocumentContent,
  type StreamChatOptions,
  type StreamEditorChatOptions,
} from './services/chat.service';

// ── Store ─────────────────────────────────────────────────────────────────────
export { useChatActionsStore, useChatAiActionsStore, type AiContext } from './store/chat.store';

// ── Types & Schemas ───────────────────────────────────────────────────────────
export * from './types/chat.types';
export * from './schemas/chat.schema';
