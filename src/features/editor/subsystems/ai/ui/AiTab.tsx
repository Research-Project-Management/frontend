'use client';

/**
 * AiTab.tsx
 *
 * Primary Sidebar AI Research Assistant Viewlet (Block 6: UI Features Layer).
 * Location: `features/editor/ui/features/sidebar/ai/AiTab.tsx`
 *
 * Integrates directly into the Left Primary Sidebar:
 * - Direct AI Assistant chat with streaming responses and KaTeX LaTeX rendering
 * - Integrated thought process display with `<think>` blocks
 * - Interactive editor code insertion, replacement, and live diff review
 * - Attachment integration: Library, Storage, and Uploaded Documents
 * - Real-time command bus synchronization for error fixes and selections
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import {
  SquarePen,
  RefreshCw,
} from 'lucide-react';
import { AIIcon } from '@/shared/components/icons';
import { useAiChatActions } from './useAiChatActions';
import { usePageStore, editorCommandBus } from '@/features/editor/core';
import { useEditorInstance } from '@/features/editor/ui/hooks/useEditorInstance';
import {
  streamEditorChat,
  getPageChat,
  clearPageChat,
  uploadDocument,
} from '@/features/ai/services/chat.service';
import type { ChatMessage } from '@/features/ai/types/chat.types';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/shared/components/ui/tooltip';
import { cn } from '@/shared/lib/utils';
import {
  type AttachedFile,
  type UploadingFileItem,
} from './ai-attachments';
import { AiSuggestionsHero } from './AiSuggestionsHero';
import { AiMessageItem } from './AiMessageItem';
import { AiInputArea } from './AiInputArea';

interface AiTabProps {
  onClose?: () => void;
}

export default function AiTab({ onClose }: AiTabProps) {
  const params = useParams<{ projectId?: string; pageId?: string; draftId?: string }>();
  const currentPage = usePageStore((s) => s.currentPage);
  const { engine, getContent } = useEditorInstance();
  const {
    insertAtCursor,
    replaceSelection,
    proposeDiff,
    copyCode,
    notifyFileAttached,
    notifyFileError,
    notifyChatError,
    notifyChatCleared,
    notifyLibraryAttached,
    notifyStorageAttached,
    notifyDocumentsAttached,
  } = useAiChatActions({ engine });

  const currentProjectId =
    params?.projectId ||
    (typeof currentPage?.projectId === 'string'
      ? currentPage.projectId
      : currentPage?.projectId?.id) ||
    null;

  const activePageId = params?.pageId || params?.draftId || currentPage?.id || null;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState<string>('');
  const [selectionContext, setSelectionContext] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // File attachments & Web search states
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFileItem[]>([]);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [isLibraryModalOpen, setIsLibraryModalOpen] = useState(false);
  const [isStorageModalOpen, setIsStorageModalOpen] = useState(false);
  const [isUploadedDocsModalOpen, setIsUploadedDocsModalOpen] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    if (e.target) e.target.value = '';

    for (const file of files) {
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setUploadingFiles((prev) => [
        ...prev,
        { id: tempId, name: file.name, size: file.size, progress: 10, stage: 'uploading' },
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
                  : item
              )
            );
          }
        );

        setUploadingFiles((prev) => prev.filter((item) => item.id !== tempId));
        setAttachedFiles((prev) => [
          ...prev,
          { id: doc.id, name: doc.name || file.name, size: doc.size || file.size },
        ]);
        notifyFileAttached(file.name);
      } catch (err: unknown) {
        setUploadingFiles((prev) => prev.filter((item) => item.id !== tempId));
        notifyFileError(file.name, (err as Error)?.message || 'Upload failed');
      }
    }
  };

  const removeAttachedFile = (fileId: string) => {
    setAttachedFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  // Auto-scroll to bottom of messages
  const scrollToBottom = useCallback(() => {
    if (typeof messagesEndRef.current?.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingMessage, scrollToBottom]);

  // Load chat history for current page if available
  useEffect(() => {
    if (!activePageId) return;

    let isMounted = true;
    setIsLoadingHistory(true);

    getPageChat(activePageId)
      .then((history: ChatMessage[]) => {
        if (isMounted && Array.isArray(history) && history.length > 0) {
          setMessages(history);
        }
      })
      .catch(() => {
        // Silently continue if no prior page history
      })
      .finally(() => {
        if (isMounted) setIsLoadingHistory(false);
      });

    return () => {
      isMounted = false;
    };
  }, [activePageId]);

  // Listen for external open-ai-panel events from toolbar / floating menu
  useEffect(() => {
    return editorCommandBus.subscribe('sidebar:open-ai-panel', (cmd) => {
      if (cmd?.selectedText) {
        setSelectionContext(cmd.selectedText);
      } else if (engine) {
        const text = engine.getSelectedText();
        if (text.trim()) {
          setSelectionContext(text);
        }
      }

      if (cmd?.initialPrompt) {
        setInputPrompt(cmd.initialPrompt);
      }
    });
  }, [engine]);

  // Listen for diff resolutions (Accept / Reject from CodeMirror inline diff)
  useEffect(() => {
    return editorCommandBus.subscribe('ai:diff-resolved', (cmd) => {
      const action = cmd.action || cmd.payload?.action;
      if (action === 'accept') {
        setSelectionContext(null);
      }
    });
  }, []);

  // Stop active streaming generation
  const handleStopStreaming = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
    if (streamingMessage) {
      setMessages((prev) => [...prev, { role: 'assistant', content: streamingMessage }]);
      setStreamingMessage('');
    }
  };

  // Send message
  const handleSendMessage = async (customPrompt?: string) => {
    const textToSend = customPrompt || inputPrompt.trim();
    if ((!textToSend && attachedFiles.length === 0) || isStreaming) return;

    let displayContent = textToSend;
    if (selectionContext && !customPrompt) {
      displayContent = `> ${selectionContext.slice(0, 100).replace(/\n/g, ' ')}${selectionContext.length > 100 ? '...' : ''}\n\n${textToSend}`;
    }

    const userMsg: ChatMessage = {
      role: 'user',
      content: displayContent,
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInputPrompt('');
    setIsStreaming(true);
    setStreamingMessage('');

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const activeFilename = currentPage?.title || 'document.tex';
      const fileContent = getContent();
      const finalDocIds = [
        ...attachedFiles.map((f) => f.id),
        ...(activePageId ? [activePageId] : []),
      ];
      const finalWebSearch = webSearchEnabled ? ['*'] : undefined;

      const stream = streamEditorChat(newMessages, {
        projectId: currentProjectId || undefined,
        documentIds: finalDocIds.length > 0 ? finalDocIds : undefined,
        webSearchSites: finalWebSearch,
        filename: activeFilename,
        fileContent,
        selection: selectionContext || undefined,
        signal: abortController.signal,
      });

      let accumulated = '';
      for await (const chunk of stream) {
        accumulated += chunk;
        setStreamingMessage(accumulated);
      }

      setMessages((prev) => [...prev, { role: 'assistant', content: accumulated }]);
      setStreamingMessage('');
      setSelectionContext(null);
    } catch (err: unknown) {
      const error = err as Error;
      if (error?.name !== 'AbortError') {
        notifyChatError(error?.message || 'Chat error');
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: `**Error:** ${error?.message || 'Could not connect to the AI server.'}`,
          },
        ]);
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  // Clear conversation history
  const handleClearChat = async () => {
    if (messages.length === 0 && !streamingMessage) return;
    if (activePageId) {
      try {
        await clearPageChat(activePageId);
      } catch {
        // Fallback silently
      }
    }
    setMessages([]);
    setStreamingMessage('');
    setSelectionContext(null);
    setInputPrompt('');
    notifyChatCleared();
  };

  const handleCopyCode = async (code: string, blockId: string) => {
    await copyCode(code);
    setCopiedIndex(blockId);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <TooltipProvider delayDuration={150}>
      <aside
        aria-label="AI Research Assistant"
        className="flex flex-col h-full bg-background select-none overflow-hidden"
      >
        {/* ── Top Header ── */}
        <div className="flex h-9 items-center justify-between px-3 border-b border-border bg-background shrink-0 select-none">
          <div className="flex items-center min-w-0">
            <h2 className="text-13 font-semibold text-foreground truncate">AI Assistant</h2>
          </div>

          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={handleClearChat}
                  disabled={isStreaming}
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

        {/* ── Active Selection Context Banner ── */}
        {selectionContext && (
          <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-ai-subtle/80 border-b border-border/80 text-foreground shrink-0 select-none animate-in fade-in duration-150">
            <div className="flex items-center gap-1.5 min-w-0">
              <AIIcon className="size-3 text-ai shrink-0" />
              <span className="text-11 font-medium text-foreground truncate">
                Selection: &ldquo;<span className="font-mono opacity-80">{selectionContext.slice(0, 32)}{selectionContext.length > 32 ? '...' : ''}</span>&rdquo;
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

        {/* ── Messages Scroll Area ── */}
        <div
          className={cn(
            'flex-1 px-3.5 select-text',
            messages.length === 0 && !streamingMessage
              ? 'overflow-hidden flex flex-col justify-center py-2'
              : 'overflow-y-auto sidebar-scrollbar py-3 space-y-3',
          )}
        >
          {isLoadingHistory && (
            <div className="flex items-center justify-center py-6 text-12 text-muted-foreground gap-2">
              <RefreshCw className="size-3.5 animate-spin motion-reduce:animate-none text-ai" />
              <span>Loading history...</span>
            </div>
          )}

          {/* ── Empty State: Companion Hero & Suggestions ── */}
          {messages.length === 0 && !streamingMessage && !isLoadingHistory && (
            <AiSuggestionsHero onSelectSuggestion={handleSendMessage} />
          )}

          {/* Existing Messages */}
          {messages.map((msg, idx) => (
            <AiMessageItem
              key={idx}
              msg={msg}
              hasSelectionContext={Boolean(selectionContext)}
              copiedIndex={copiedIndex}
              onCopyCode={handleCopyCode}
              onInsertAtCursor={insertAtCursor}
              onProposeDiff={proposeDiff}
              onReplaceSelection={replaceSelection}
            />
          ))}

          {/* Streaming In-Progress Assistant Bubble */}
          {streamingMessage && (
            <AiMessageItem
              isStreaming
              rawStreamingContent={streamingMessage}
              hasSelectionContext={Boolean(selectionContext)}
              copiedIndex={copiedIndex}
              onCopyCode={handleCopyCode}
              onInsertAtCursor={insertAtCursor}
              onProposeDiff={proposeDiff}
              onReplaceSelection={replaceSelection}
            />
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* ── Chat Input Area ── */}
        <AiInputArea
          inputPrompt={inputPrompt}
          setInputPrompt={setInputPrompt}
          onSendMessage={handleSendMessage}
          onStopStreaming={handleStopStreaming}
          isStreaming={isStreaming}
          selectionContext={selectionContext}
          hasMessages={messages.length > 0}
          attachedFiles={attachedFiles}
          uploadingFiles={uploadingFiles}
          onRemoveAttachedFile={removeAttachedFile}
          onFileUpload={handleFileUpload}
          webSearchEnabled={webSearchEnabled}
          setWebSearchEnabled={setWebSearchEnabled}
          currentProjectId={currentProjectId}
          isLibraryModalOpen={isLibraryModalOpen}
          setIsLibraryModalOpen={setIsLibraryModalOpen}
          isStorageModalOpen={isStorageModalOpen}
          setIsStorageModalOpen={setIsStorageModalOpen}
          isUploadedDocsModalOpen={isUploadedDocsModalOpen}
          setIsUploadedDocsModalOpen={setIsUploadedDocsModalOpen}
          onLibraryAttached={(items) => {
            setAttachedFiles((prev) => {
              const existingIds = new Set(prev.map((f) => f.id));
              const newOnes = items
                .filter((it) => !existingIds.has(it.id))
                .map((it) => ({ id: it.id, name: it.name, size: it.size }));
              return [...prev, ...newOnes];
            });
            notifyLibraryAttached(items.length);
          }}
          onStorageAttached={(items) => {
            setAttachedFiles((prev) => {
              const existingIds = new Set(prev.map((f) => f.id));
              const newOnes = items
                .filter((it) => !existingIds.has(it.id))
                .map((it) => ({ id: it.id, name: it.name, size: it.size }));
              return [...prev, ...newOnes];
            });
            notifyStorageAttached(items.length);
          }}
          onDocumentsAttached={(items) => {
            setAttachedFiles((prev) => {
              const existingIds = new Set(prev.map((f) => f.id));
              const newOnes = items
                .filter((it: { id: string }) => !existingIds.has(it.id))
                .map((it: { id: string; name: string; size?: number }) => ({ id: it.id, name: it.name, size: it.size }));
              return [...prev, ...newOnes];
            });
            notifyDocumentsAttached(items.length);
          }}
        />
      </aside>
    </TooltipProvider>
  );
}
