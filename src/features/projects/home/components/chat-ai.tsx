'use client';

import dynamic from 'next/dynamic';
import { useAiCompanionStore } from '@/features/ai/store';
import type { SendMessageOptions } from '@/features/ai/components/companion/CompanionInput';

const CompanionInput = dynamic(
  () =>
    import('@/features/ai/components/companion/CompanionInput').then(
      (m) => m.CompanionInput
    ),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-14 rounded-xl border border-border/60 bg-muted/30 animate-pulse" />
    ),
  }
);

interface ChatAiProps {
  onSend?: (
    text: string,
    projectId?: string,
    webSearchSites?: string[]
  ) => void;
}

export default function ChatAi({ onSend }: ChatAiProps) {
  const { setPendingPrompt, setOpen } = useAiCompanionStore();

  const handleSend = (text: string, options?: SendMessageOptions) => {
    // Synchronize directly with Topbar AI Assistant Companion
    setPendingPrompt({
      text,
      projectId: options?.projectId,
      attachedFiles: options?.attachedFiles,
      webSearch: Boolean(options?.webSearchSites?.length),
      webSearchSites: options?.webSearchSites,
    });
    setOpen(true);

    // Call optional callback if provided by parent
    onSend?.(
      text,
      options?.projectId || undefined,
      options?.webSearchSites || undefined
    );
  };

  return (
    <div className="w-full">
      <CompanionInput
        onSend={handleSend}
        placeholder="Ask anything about your project..."
        className="p-0 bg-transparent"
        showDisclaimer={false}
      />
    </div>
  );
}
