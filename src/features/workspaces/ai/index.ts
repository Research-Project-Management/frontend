export { ChatModeProvider, useChatMode } from './hooks/use-chat-mode';
export { default as WikiChatFeatures } from './components/WikiChatFeatures';
export { getPageChat, streamEditorChat, clearPageChat, compilePreview, type PreviewCompileResult, streamChatResponse, getChatSession, appendChatMessages, createChatSession, listChatSessions, deleteChatSession } from './services/chat-ai.services';

export { default as ChatAiDetail } from './components/ChatView'; // ChatView replaces ChatAiDetail
export { default as EmptyState } from './components/ChatView'; // ChatView replaces EmptyState
export { default as FluxAiSidebar } from './components/SideBar';

// ── Store ─────────────────────────────────────────────────────────────────────
export { useChatAiActionsStore } from './store/chat-ai.store';
export type { AiContext } from './store/chat-ai.store';
export { default as ChatHistoryModal } from './components/ChatHistoryModal';
export { renderMarkdown } from './components/renderMarkdown';

