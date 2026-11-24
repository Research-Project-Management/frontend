'use client';

import { useState } from 'react';
import {
  Composer,
  ContextPicker,
  useActiveAiSpace,
  useAiCompanionStore,
  useTurnContext,
  type ContextTab,
} from '@/features/ai';

interface ChatAiProps {
  onSend?: (
    text: string,
    projectId?: string,
    webSearchSites?: string[],
  ) => void;
}

export default function ChatAi({ onSend }: ChatAiProps) {
  const setPendingPrompt = useAiCompanionStore((s) => s.setPendingPrompt);
  const setOpen = useAiCompanionStore((s) => s.setOpen);

  const { spaceId: defaultSpaceId } = useActiveAiSpace();
  const [pickerTab, setPickerTab] = useState<ContextTab | null>(null);
  const turnCtx = useTurnContext({ spaceId: defaultSpaceId });

  const handleSend = (text: string) => {
    const webSites = turnCtx.webSearchEnabled
      ? turnCtx.webSearchSites.length > 0
        ? turnCtx.webSearchSites
        : ['*']
      : undefined;

    setPendingPrompt({
      text,
      spaceId: defaultSpaceId,
      projectId: defaultSpaceId,
      documentIds:
        turnCtx.enabledDocumentIds.length > 0
          ? turnCtx.enabledDocumentIds
          : undefined,
      attachedFiles:
        turnCtx.attachments.length > 0
          ? turnCtx.attachments.map((a) => ({
              id: a.id,
              name: a.name,
              size: a.size,
              type: a.type,
              sourceType: a.sourceType,
              hasPdf: a.hasPdf,
              itemId: a.itemId,
              fileId: a.fileId,
            }))
          : undefined,
      webSearch: turnCtx.webSearchEnabled,
      webSearchSites: webSites,
    });
    setOpen(true);

    onSend?.(text, defaultSpaceId || undefined, webSites);
    turnCtx.clearSources();
  };

  return (
    <div className="w-full">
      <Composer
        variant="inline"
        placeholder="Ask anything about your project..."
        className="p-0 bg-transparent"
        showDisclaimer={false}
        sources={turnCtx.sources}
        uploadingFiles={turnCtx.uploadingFiles}
        isUploading={turnCtx.isUploading}
        onUploadFiles={turnCtx.uploadFiles}
        onRemoveSource={turnCtx.removeSource}
        onOpenPicker={setPickerTab}
        webSearchEnabled={turnCtx.webSearchEnabled}
        onWebSearchChange={turnCtx.setWebSearchEnabled}
        onSend={handleSend}
      />

      <ContextPicker
        open={Boolean(pickerTab)}
        onOpenChange={(open) => !open && setPickerTab(null)}
        initialTab={pickerTab ?? 'library'}
        spaceId={defaultSpaceId}
        onSelect={(entries) => turnCtx.addSources(entries)}
      />
    </div>
  );
}
