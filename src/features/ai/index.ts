'use client';

// Public Facade for features/ai — external consumers import ONLY from '@/features/ai'.

export type { EditorPatchItem } from './types/message';

export { fluxTransport } from './transport/flux';

export { threadPool } from './engine/pool';
export { useAiCompanionStore, useAiUIStore } from './engine/shell';
export { useAiThread } from './engine/use-thread';

export type { ContextTab, SourceEntry, SourceType } from './context/source.port';
export { useActiveAiSpace } from './context/space';
export { useTurnContext } from './context/use-context';

export type { MessageCodeActions } from './ui/parts/MessageParts';

export { Composer } from './ui/composer/Composer';
export { ContextPicker } from './ui/context/ContextPicker';

export { ChatPage } from './ui/workspace/ChatPage';
export { ChatSidebar } from './ui/workspace/ChatSidebar';
export { CompanionDrawer } from './ui/companion/CompanionDrawer';
export { CompanionHistory } from './ui/companion/CompanionHistory';
export {
  CompanionMessages,
  type CompanionSuggestionItem,
} from './ui/companion/CompanionMessages';
