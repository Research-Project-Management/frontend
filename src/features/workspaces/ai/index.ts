export { default as ChatPage } from './pages/ChatPage';
export { ChatModeProvider, useChatMode } from './hooks/use-chat-mode';
export { default as WikiChatFeatures } from './components/layout/WikiChatFeatures';
export { default as FluxAiSidebar } from './components/layout/Sidebar';
export { default as ChatHistoryModal } from './components/modals/ChatHistoryModal';
export { default as SourcePickerModal } from './components/modals/SourcePickerModal';
export { default as ChatView } from './components/chat/ChatView';
export { renderMarkdown } from './utils/render-markdown';

export {
  getPageChat,
  streamEditorChat,
  clearPageChat,
  compilePreview,
  type PreviewCompileResult,
  streamChatResponse,
  getChatSession,
  appendChatMessages,
  createChatSession,
  listChatSessions,
  deleteChatSession,
} from './services/chat-ai.service';

export { useChatAiActionsStore, type AiContext } from './store/chat-ai.store';
export * from './types/chat.types';
