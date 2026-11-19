'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { RefreshCw, SquarePen } from 'lucide-react';
import {
  clearPageChat,
  uploadDocument,
  useAiThread,
  type ContextTab,
} from '@/features/ai';
import { AIIcon } from '@/shared/components/icons';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';
import { cn } from '@/shared/lib/utils';
import { editorCommandBus, usePageStore } from '@/features/editor/core';
import { useEditorInstance } from '@/features/editor/core/bus/use-editor-instance';
import { AiInputArea } from './AiInputArea';
import { AiMessageItem } from './AiMessageItem';
import { AiSuggestionsHero } from './AiSuggestionsHero';
import {
  type AttachedFile,
  type UploadingFileItem,
} from './ai-attachments';
import { useAiChatActions } from './useAiChatActions';

interface AiTabProps {
  onClose?: () => void;
}

export default function AiTab({ onClose }: AiTabProps) {
  void onClose;
  const params = useParams<{
    projectId?: string;
    pageId?: string;
    draftId?: string;
  }>();
  const currentPageId = usePageStore((s) => s.currentPage?.id);
  const rootPageId = usePageStore((s) => s.rootPageId);
  const parentPageId = usePageStore((s) => s.parentPageId);
  const currentPageTitle = usePageStore((s) => s.currentPage?.title);
  const activeFilePage = usePageStore((s) => s.activeFilePage);
  const storeSpaceId = usePageStore((s) => s.spaceId);
  const storeProjectId = usePageStore((s) => s.projectId);
  const currentPageProjectId = usePageStore((s) => {
    const p = s.currentPage?.projectId;
    return typeof p === 'string' ? p : p?.id || null;
  });
  const { engine, getContent } = useEditorInstance();

  const currentProjectId =
    storeSpaceId ||
    storeProjectId ||
    params?.projectId ||
    currentPageProjectId ||
    null;

  const activePageId =
    rootPageId ||
    parentPageId ||
    params?.pageId ||
    params?.draftId ||
    currentPageId ||
    null;

  const thread = useAiThread({
    threadKey: activePageId ? `page:${activePageId}` : 'draft:editor',
    pageId: activePageId,
    spaceId: currentProjectId,
    mode: 'editor',
  });

  const [inputPrompt, setInputPrompt] = useState('');
  const [selectionContext, setSelectionContext] = useState<string | null>(null);
  const [selectionFileId, setSelectionFileId] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFileItem[]>([]);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [pickerTab, setPickerTab] = useState<ContextTab | null>(null);

  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    insertAtCursor,
    replaceSelection,
    proposeDiff,
    copyCode,
    notifyItemsAttached,
    notifyFileAttached,
    notifyFileError,
    notifyChatError,
    notifyChatCleared,
  } = useAiChatActions({ engine, selectionFileId });

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  // Notify on surfaced stream error
  const lastErrorRef = useRef<Error | null>(null);
  useEffect(() => {
    if (thread.error && thread.error !== lastErrorRef.current) {
      lastErrorRef.current = thread.error;
      notifyChatError(thread.error.message || 'Chat error');
    } else if (!thread.error) {
      lastErrorRef.current = null;
    }
  }, [thread.error, notifyChatError]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    e.target.value = '';

    for (const file of files) {
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setUploadingFiles((prev) => [
        ...prev,
        {
          id: tempId,
          name: file.name,
          size: file.size,
          progress: 10,
          stage: 'uploading',
        },
      ]);

      try {
        const doc = await uploadDocument(
          currentProjectId || 'personal',
          file,
          (prog) => {
            setUploadingFiles((prev) =>
              prev.map((item) =>
                item.id === tempId
                  ? { ...item, progress: prog.percent, stage: prog.stage }
                  : item,
              ),
            );
          },
        );

        setUploadingFiles((prev) => prev.filter((item) => item.id !== tempId));
        setAttachedFiles((prev) => [
          ...prev,
          { id: doc.id, name: doc.name || file.name, size: doc.size || file.size },
        ]);
        notifyFileAttached(file.name);
      } catch (err: unknown) {
        setUploadingFiles((prev) => prev.filter((item) => item.id !== tempId));
        notifyFileError(
          file.name,
          err instanceof Error ? err.message : 'Upload failed',
        );
      }
    }
  };

  const removeAttachedFile = (fileId: string) => {
    setAttachedFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  const scrollToBottom = useCallback(() => {
    if (typeof messagesEndRef.current?.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [thread.messages, thread.isStreaming, scrollToBottom]);

  useEffect(() => {
    setSelectionContext(null);
    setSelectionFileId(null);
    setAttachedFiles([]);
  }, [activePageId]);

  useEffect(() => {
    return editorCommandBus.subscribe('sidebar:open-ai-panel', (cmd) => {
      const currentFileId =
        usePageStore.getState().activeFilePage?.id ||
        usePageStore.getState().currentPage?.id ||
        null;
      if (cmd?.selectedText) {
        setSelectionContext(cmd.selectedText);
        setSelectionFileId(currentFileId);
      } else if (engine) {
        const text = engine.getSelectedText();
        if (text.trim()) {
          setSelectionContext(text);
          setSelectionFileId(currentFileId);
        }
      }

      if (cmd?.initialPrompt) {
        setInputPrompt(cmd.initialPrompt);
      }
    });
  }, [engine]);

  useEffect(() => {
    return editorCommandBus.subscribe('ai:diff-resolved', (cmd) => {
      if (cmd.action === 'accept') {
        setSelectionContext(null);
        setSelectionFileId(null);
      }
    });
  }, []);

  const handleStopStreaming = () => {
    void thread.stop();
  };

  const handleSendMessage = async (customPrompt?: string) => {
    const textToSend = (customPrompt || inputPrompt).trim();
    if ((!textToSend && attachedFiles.length === 0) || thread.isStreaming) return;

    let displayContent = textToSend;
    if (selectionContext && !customPrompt) {
      displayContent = `> ${selectionContext.slice(0, 100).replace(/\n/g, ' ')}${
        selectionContext.length > 100 ? '...' : ''
      }\n\n${textToSend}`;
    }

    setInputPrompt('');

    const activeFilename =
      activeFilePage?.title || currentPageTitle || 'document.tex';
    const fileContent = getContent();
    const selRange = engine?.getSelection?.() ?? null;
    const finalDocIds = attachedFiles.map((f) => f.id);
    const finalWebSearch = webSearchEnabled ? ['*'] : undefined;

    await thread.send(displayContent, {
      mode: 'editor',
      chatId: thread.chatId,
      spaceId: currentProjectId,
      documentIds: finalDocIds.length > 0 ? finalDocIds : undefined,
      attachments: attachedFiles.map((f) => ({
        id: f.id,
        name: f.name,
        size: f.size,
        sourceType: 'upload',
      })),
      webSearchSites: finalWebSearch,
      editor: {
        pageId: activePageId,
        filename: activeFilename,
        fileContent,
        selection: selectionContext ?? undefined,
        selectionStartLine: selRange?.startLine ?? undefined,
        selectionEndLine: selRange?.endLine ?? undefined,
        selectionStartColumn: selRange?.startColumn ?? undefined,
        selectionEndColumn: selRange?.endColumn ?? undefined,
      },
    });

    setSelectionContext(null);
    setSelectionFileId(null);
  };

  const handleClearChat = async () => {
    if (thread.messages.length === 0 && !thread.isStreaming) return;
    if (activePageId) {
      try {
        await clearPageChat(activePageId);
      } catch {
        // Fallback silently
      }
    }
    thread.reset({ keepMeta: false });
    setSelectionContext(null);
    setSelectionFileId(null);
    setInputPrompt('');
    notifyChatCleared();
  };

  const handleCopyCode = async (code: string, blockId: string) => {
    await copyCode(code);
    setCopiedIndex(blockId);
    if (copyTimerRef.current) {
      clearTimeout(copyTimerRef.current);
    }
    copyTimerRef.current = setTimeout(() => {
      copyTimerRef.current = null;
      setCopiedIndex(null);
    }, 2000);
  };

  const handleSourcesAttached = useCallback(
    (items: AttachedFile[], source: 'library' | 'storage' | 'documents') => {
      setAttachedFiles((prev) => {
        const existingIds = new Set(prev.map((f) => f.id));
        const newOnes = items
          .filter((it) => !existingIds.has(it.id))
          .map((it) => ({ id: it.id, name: it.name, size: it.size }));
        return [...prev, ...newOnes];
      });
      notifyItemsAttached(items.length, source);
    },
    [notifyItemsAttached],
  );

  const lastMessage = thread.messages[thread.messages.length - 1];
  const isWaitingFirstChunk =
    thread.isStreaming && (!lastMessage || lastMessage.role === 'user');

  return (
    <TooltipProvider delayDuration={150}>
      <div
        role="region"
        aria-label="AI Research Assistant"
        className="flex flex-col h-full select-none overflow-hidden"
      >
        <div className="flex h-9 items-center justify-between px-3 border-b border-border shrink-0 select-none">
          <div className="flex items-center min-w-0">
            <h2 className="text-13 font-semibold text-foreground truncate">
              AI Assistant
            </h2>
          </div>

          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => void handleClearChat()}
                  disabled={thread.isStreaming}
                  className="size-7 flex items-center justify-center rounded-md text-foreground hover:bg-muted transition-colors cursor-pointer"
                  aria-label="New chat"
                >
                  <SquarePen className="size-3.5 text-foreground" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={4}>
                New chat
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {selectionContext && (
          <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-ai-subtle/80 border-b border-border/80 text-foreground shrink-0 select-none animate-in fade-in duration-150">
            <div className="flex items-center gap-1.5 min-w-0">
              <AIIcon className="size-3 text-ai shrink-0" />
              <span className="text-11 font-medium text-foreground truncate">
                Selection: &ldquo;
                <span className="font-mono opacity-80">
                  {selectionContext.slice(0, 32)}
                  {selectionContext.length > 32 ? '...' : ''}
                </span>
                &rdquo;
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSelectionContext(null)}
              className="text-muted-foreground hover:text-foreground text-11 px-1.5 py-0.5 rounded-sm hover:bg-muted transition-colors cursor-pointer"
              title="Clear selection"
            >
              Clear
            </button>
          </div>
        )}

        <div
          className={cn(
            'flex-1 px-3.5 select-text',
            thread.messages.length === 0 && !thread.isStreaming
              ? 'overflow-hidden flex flex-col justify-center py-2'
              : 'overflow-y-auto sidebar-scrollbar py-3 space-y-3',
          )}
        >
          {thread.isLoadingHistory && (
            <div className="flex items-center justify-center py-6 text-12 text-muted-foreground gap-2">
              <RefreshCw className="size-3.5 animate-spin motion-reduce:animate-none text-ai" />
              <span>Loading history...</span>
            </div>
          )}

          {thread.messages.length === 0 &&
            !thread.isStreaming &&
            !thread.isLoadingHistory && (
              <AiSuggestionsHero onSelectSuggestion={handleSendMessage} />
            )}

          {thread.messages.map((msg, idx) => {
            const isLast = idx === thread.messages.length - 1;
            const streamingBubble =
              isLast && thread.isStreaming && msg.role === 'assistant';
            return (
              <AiMessageItem
                key={msg.id || idx}
                msg={msg}
                isStreaming={streamingBubble}
                hasSelectionContext={Boolean(selectionContext)}
                copiedIndex={copiedIndex}
                onCopyCode={handleCopyCode}
                onInsertAtCursor={insertAtCursor}
                onProposeDiff={proposeDiff}
                onReplaceSelection={replaceSelection}
                onResumeHitl={(decisions) =>
                  void thread.resume(decisions, currentProjectId)
                }
              />
            );
          })}

          {isWaitingFirstChunk && (
            <AiMessageItem
              isStreaming
              rawStreamingContent=""
              hasSelectionContext={Boolean(selectionContext)}
              copiedIndex={copiedIndex}
              onCopyCode={handleCopyCode}
              onInsertAtCursor={insertAtCursor}
              onProposeDiff={proposeDiff}
              onReplaceSelection={replaceSelection}
            />
          )}

          {thread.error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-2 text-12 text-destructive flex items-center justify-between gap-2">
              <span className="truncate">
                {thread.error.message || 'Could not connect to the AI server.'}
              </span>
              <button
                type="button"
                onClick={() => void thread.retry()}
                className="underline font-medium shrink-0 cursor-pointer"
              >
                Retry
              </button>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <AiInputArea
          inputPrompt={inputPrompt}
          setInputPrompt={setInputPrompt}
          onSendMessage={handleSendMessage}
          onStopStreaming={handleStopStreaming}
          isStreaming={thread.isStreaming}
          selectionContext={selectionContext}
          hasMessages={thread.messages.length > 0}
          attachedFiles={attachedFiles}
          uploadingFiles={uploadingFiles}
          onRemoveAttachedFile={removeAttachedFile}
          onFileUpload={handleFileUpload}
          webSearchEnabled={webSearchEnabled}
          setWebSearchEnabled={setWebSearchEnabled}
          currentProjectId={currentProjectId}
          pickerTab={pickerTab}
          setPickerTab={setPickerTab}
          onSourcesAttached={handleSourcesAttached}
        />
      </div>
    </TooltipProvider>
  );
}
