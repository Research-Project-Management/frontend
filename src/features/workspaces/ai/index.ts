export { ChatModeProvider, useChatMode } from './hooks/useChatMode';
export { default as WikiChatFeatures } from './components/ai/WikiChatFeatures';
export { getPageChat, streamEditorChat, clearPageChat, compilePreview, type PreviewCompileResult, streamChatResponse, getChatSession, appendChatMessages, createChatSession, listChatSessions, deleteChatSession } from './services/chat-ai.services';

export { default as ChatAiDetail } from './components/ai/layout/ChatAiDetail';
export { default as EmptyState } from './components/ai/layout/EmptyState';
export { default as FluxAiSidebar } from './components/ai/layout/SideBar';

// ── Store ─────────────────────────────────────────────────────────────────────
export { useChatAiActionsStore } from './store/chat-ai.store';
export type { AiContext } from './store/chat-ai.store';
export { default as ChatHistoryModal } from './components/ai/layout/ChatHistoryModal';
export { renderMarkdown } from './components/ai/layout/renderMarkdown';
