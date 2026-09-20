/**
 * Public API Surface for features/ai
 * Conforms to ADR 002 Deep Modules & Hexagonal Architecture
 */

// Services & Streaming
export * from './services/chat.service';

// Types
export type * from './types/chat.types';

// Utils
export { renderMarkdown } from './utils/render-markdown';

// Pages & Components
export { default as AiChatPage } from './pages/chat-page';
