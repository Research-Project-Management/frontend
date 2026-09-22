/**
 * Public API Surface for features/ai
 * Conforms to ADR 002 Deep Modules & Hexagonal Architecture
 */

// Services & Streaming
export * from './services/chat.service';

// Types
export type * from './types/chat.types';

// Store
export * from './store';

// Utils
export { renderMarkdown } from './utils/render-markdown';

// Pages & Layout Components
export { default as AiChatPage } from './pages/chat-page';
export * from './components/layout/Sidebar';
export * from './components/layout/panel';
export * from './components/topbar';
export * from './components/modals';
