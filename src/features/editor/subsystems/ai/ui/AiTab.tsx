'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { ChevronRight, History, SquarePen } from 'lucide-react';
import {
  CompanionHistory,
  CompanionMessages,
  Composer,
  ContextPicker,
  getRagDocumentId,
  sourceEntryToAttachedPayload,
  sourcesToAttachments,
  threadPool,
  useActiveAiSpace,
  useAiCompanionStore,
  useAiThread,
  useTurnContext,
  type CompanionSuggestionItem,
  type ContextTab,
  type MessageCodeActions,
  type SourceEntry,
} from '@/features/ai';
import { QUICK_ACTIONS } from '@/features/editor/domain/ai/ai-prompts';
import {
  getLineContext,
  parseLatexStructure,
} from '@/features/editor/domain/latex/latex-structure';
import { diagnosticsCoordinator } from '@/features/editor/subsystems/diagnostics';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';
import { editorCommandBus, usePageStore } from '@/features/editor/core';
import { useEditorInstance } from '@/features/editor/core/bus/use-editor-instance';
import { useAiChatActions } from './useAiChatActions';

interface AiTabProps {
  onClose?: () => void;
}

const EDITOR_SUGGESTIONS: readonly CompanionSuggestionItem[] = QUICK_ACTIONS.slice(
  0,
  5,
).map((act) => ({
  id: act.id,
  label: act.label,
  text: act.prompt,
  prompt: act.prompt,
}));

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

  const activeFilename =
    activeFilePage?.title || currentPageTitle || 'document.tex';

  const {
    activeChatId,
    setActiveChatId,
    isHistoryView,
    toggleHistoryView,
    setHistoryView,
    pendingPrompt,
    setPendingPrompt,
  } = useAiCompanionStore();

  const { spaceId: workspaceSpaceId } = useActiveAiSpace(currentProjectId);

  const threadKey = activeChatId || 'draft:companion';
  const thread = useAiThread({
    threadKey,
    chatId: activeChatId,
    spaceId: workspaceSpaceId,
    mode: 'editor',
    onChatIdAssigned: (newChatId) => {
      setActiveChatId(newChatId);
    },
    onSessionNotFound: () => {
      setActiveChatId(null);
    },
  });

  const effectiveSpaceId = thread.spaceId ?? workspaceSpaceId;
  const turnCtx = useTurnContext({ spaceId: effectiveSpaceId });

  const [promptToFill, setPromptToFill] = useState('');
  const [draftRevision, setDraftRevision] = useState(0);
  const [selectionContext, setSelectionContext] = useState<string | null>(null);
  const [selectionFileId, setSelectionFileId] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);
  const [pickerTab, setPickerTab] = useState<ContextTab | null>(null);
  const [pendingAutoSend, setPendingAutoSend] = useState<{
    prompt: string;
    selectedText?: string;
  } | null>(null);

  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastErrorRef = useRef<Error | null>(null);

  const {
    insertAtCursor,
    replaceSelection,
    proposeDiff,
    reviewEditorPatch,
    applyAllEditorPatches,
    copyCode,
    notifyChatError,
  } = useAiChatActions({ engine, selectionFileId });

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (thread.error && thread.error !== lastErrorRef.current) {
      lastErrorRef.current = thread.error;
      notifyChatError(thread.error.message || 'Chat error');
    } else if (!thread.error) {
      lastErrorRef.current = null;
    }
  }, [thread.error, notifyChatError]);

  useEffect(() => {
    if (typeof messagesEndRef.current?.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [thread.messages, thread.isStreaming]);

  useEffect(() => {
    setSelectionContext(null);
    setSelectionFileId(null);
  }, [activePageId]);

  useEffect(() => {
    return editorCommandBus.subscribe('sidebar:open-ai-panel', (cmd) => {
      setHistoryView(false);
      const currentFileId =
        usePageStore.getState().activeFilePage?.id ||
        usePageStore.getState().currentPage?.id ||
        null;

      const resolvedSelectedText = cmd?.selectedText?.trim()
        ? cmd.selectedText
        : engine?.getSelectedText?.().trim()
          ? engine.getSelectedText()
          : '';

      if (cmd?.autoSend && cmd?.initialPrompt) {
        if (resolvedSelectedText) {
          setSelectionContext(resolvedSelectedText);
          setSelectionFileId(currentFileId);
        }
        setPromptToFill('');
        setPendingAutoSend({
          prompt: cmd.initialPrompt,
          selectedText: resolvedSelectedText || undefined,
        });
        return;
      }

      if (resolvedSelectedText) {
        setSelectionContext(resolvedSelectedText);
        setSelectionFileId(currentFileId);
      }

      if (cmd?.initialPrompt) {
        setPromptToFill(cmd.initialPrompt);
        setDraftRevision((prev) => prev + 1);
      }
    });
  }, [engine, setHistoryView]);

  useEffect(() => {
    return editorCommandBus.subscribe('ai:diff-resolved', (cmd) => {
      if (cmd.action === 'accept') {
        setSelectionContext(null);
        setSelectionFileId(null);
      }
    });
  }, []);

  const handleSend = useCallback(
    async (
      rawText: string,
      overrides?: {
        spaceId?: string | null;
        webSearchSites?: string[] | null;
        documentIds?: string[] | null;
        attachedFiles?: Array<{ id: string; name: string; size?: number }>;
        selectedText?: string;
        isExternalHandoff?: boolean;
      },
    ) => {
      if (thread.isStreaming) return;

      const trimmed = rawText.trim();
      const extraSources: SourceEntry[] = [];
      if (overrides?.attachedFiles?.length) {
        for (const f of overrides.attachedFiles) {
          extraSources.push({
            id: f.id,
            name: f.name,
            size: f.size,
            enabled: true,
            sourceType: 'upload',
          });
        }
      } else {
        for (const s of turnCtx.sources) {
          if (s.enabled) extraSources.push(s);
        }
      }

      const activeSelection = overrides?.selectedText ?? selectionContext;

      if (!trimmed && !activeSelection && extraSources.length === 0) return;

      let displayContent = trimmed;
      if (activeSelection && !overrides?.isExternalHandoff) {
        const quotePrefix = `> ${activeSelection.slice(0, 100).replace(/\n/g, ' ')}${
          activeSelection.length > 100 ? '...' : ''
        }`;
        displayContent = trimmed
          ? `${quotePrefix}\n\n${trimmed}`
          : `${quotePrefix}\n\nExplain or help improve this LaTeX selection.`;
      }

      const activeFileId = activeFilePage?.id || currentPageId || null;
      const activeFilePath = (
        activeFilePage?.path ||
        activeFilePage?.title ||
        currentPageTitle ||
        'document.tex'
      ).replace(/^\/+/, '');
      const fileContent = getContent();
      const selRange = engine?.getSelection?.() ?? null;
      const cursorPos = engine?.getCursorPosition?.() ?? null;
      const lines = fileContent ? fileContent.split('\n') : [];
      const anchorLine = selRange?.startLine ?? cursorPos?.line ?? 1;
      const contextBefore =
        lines.length > 0 && anchorLine > 1
          ? lines.slice(Math.max(0, anchorLine - 41), anchorLine - 1).join('\n')
          : undefined;
      const contextAfter =
        lines.length > 0 && anchorLine <= lines.length
          ? lines
              .slice(
                selRange?.endLine ?? anchorLine,
                Math.min(lines.length, (selRange?.endLine ?? anchorLine) + 40),
              )
              .join('\n')
          : undefined;
      const cursorContext =
        lines.length > 0 && cursorPos?.line
          ? lines
              .slice(
                Math.max(0, cursorPos.line - 6),
                Math.min(lines.length, cursorPos.line + 5),
              )
              .join('\n')
          : undefined;

      const structure = parseLatexStructure(fileContent);
      const { section: currentSection, environment: currentEnvironment } =
        getLineContext(anchorLine, structure);
      const structureSummary =
        structure.sections.length > 0
          ? structure.sections
              .slice(0, 30)
              .map((s) => `L${s.startLine}: \\${s.level}{${s.title}}`)
              .join('\n')
          : undefined;

      const compileErrors = diagnosticsCoordinator
        .getDiagnosticsForFile(activeFilePath)
        .slice(0, 10)
        .map((d) => ({
          line: d.line,
          severity: d.severity,
          message: d.message,
          context: d.context,
        }));

      const combinedDocIds = Array.from(
        new Set([
          ...(overrides?.documentIds ?? []),
          ...extraSources
            .map(getRagDocumentId)
            .filter((id): id is string => Boolean(id)),
        ]),
      ).filter(Boolean);
      const attachedSources = extraSources.map(sourceEntryToAttachedPayload);
      const wireAttachments = sourcesToAttachments(extraSources);

      const finalWebSearch =
        overrides?.webSearchSites !== undefined
          ? (overrides.webSearchSites ?? undefined)
          : turnCtx.webSearchEnabled
            ? turnCtx.webSearchSites.length > 0
              ? turnCtx.webSearchSites
              : ['*']
            : undefined;

      const targetSpaceId =
        overrides?.spaceId !== undefined ? overrides.spaceId : effectiveSpaceId;
      const selectionSnapshot = activeSelection;

      if (!overrides?.isExternalHandoff) {
        setSelectionContext(null);
        setSelectionFileId(null);
        setPromptToFill('');
        turnCtx.clearSources();
      }

      await thread.send(displayContent, {
        mode: 'editor',
        chatId: activeChatId,
        spaceId: targetSpaceId,
        documentIds: combinedDocIds.length > 0 ? combinedDocIds : undefined,
        attachedSources: attachedSources.length > 0 ? attachedSources : undefined,
        attachments: wireAttachments.length > 0 ? wireAttachments : undefined,
        webSearchSites: finalWebSearch,
        editor: {
          pageId: activePageId,
          activeFileId,
          activeFilePath,
          filename: activeFilename,
          fileContent,
          cursorLine: cursorPos?.line ?? undefined,
          cursorColumn: cursorPos?.column ?? undefined,
          cursorContext,
          selection: selectionSnapshot ?? undefined,
          selectionStartLine: selRange?.startLine ?? undefined,
          selectionEndLine: selRange?.endLine ?? undefined,
          selectionStartColumn: selRange?.startColumn ?? undefined,
          selectionEndColumn: selRange?.endColumn ?? undefined,
          contextBefore,
          contextAfter,
          currentSection,
          currentEnvironment,
          documentStructureSummary: structureSummary,
          compileErrors: compileErrors.length > 0 ? compileErrors : undefined,
        },
      });
    },
    [
      thread,
      turnCtx,
      selectionContext,
      activeFilePage,
      currentPageId,
      currentPageTitle,
      activeFilename,
      getContent,
      engine,
      effectiveSpaceId,
      activeChatId,
      activePageId,
    ],
  );

  // Consume auto-send Writing Tools actions from selection gutter pill
  useEffect(() => {
    if (pendingAutoSend && !thread.isStreaming) {
      const next = pendingAutoSend;
      setPendingAutoSend(null);
      void handleSend(next.prompt, {
        selectedText: next.selectedText,
      });
    }
  }, [pendingAutoSend, thread.isStreaming, handleSend]);

  // Consume external handoff prompts from Global AI store
  useEffect(() => {
    if (pendingPrompt && pendingPrompt.text && !thread.isStreaming) {
      const prompt = { ...pendingPrompt };
      setPendingPrompt(null);
      void handleSend(prompt.text, {
        isExternalHandoff: true,
        spaceId: prompt.spaceId ?? prompt.projectId,
        documentIds: prompt.documentIds,
        attachedFiles: prompt.attachedFiles,
        webSearchSites:
          prompt.webSearchSites || (prompt.webSearch ? ['*'] : undefined),
      });
    }
  }, [pendingPrompt, thread.isStreaming, setPendingPrompt, handleSend]);

  const startNewChat = useCallback(() => {
    threadPool.get('draft:companion')?.reset();
    setActiveChatId(null);
    setHistoryView(false);
    setSelectionContext(null);
    setSelectionFileId(null);
    setPromptToFill('');
  }, [setActiveChatId, setHistoryView]);

  const handleCopyCode = useCallback(
    async (code: string, blockId: string) => {
      await copyCode(code);
      setCopiedIndex(blockId);
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
      }
      copyTimerRef.current = setTimeout(() => {
        copyTimerRef.current = null;
        setCopiedIndex(null);
      }, 2000);
    },
    [copyCode],
  );

  const hasSelectionForReply = Boolean(
    selectionContext || engine?.getSelectedText?.().trim(),
  );

  const codeActions = useMemo<MessageCodeActions>(
    () => ({
      hasSelection: hasSelectionForReply,
      copiedBlockId: copiedIndex,
      onCopyCode: (code, blockId) => void handleCopyCode(code, blockId),
      onInsertAtCursor: insertAtCursor,
      onProposeDiff: proposeDiff,
      onReplaceSelection: replaceSelection,
    }),
    [
      hasSelectionForReply,
      copiedIndex,
      handleCopyCode,
      insertAtCursor,
      proposeDiff,
      replaceSelection,
    ],
  );

  const selectedIdSet = useMemo(
    () => new Set(turnCtx.sources.map((s) => s.id)),
    [turnCtx.sources],
  );

  const firstUserMsg = thread.messages.find((m) => m.role === 'user')?.content;
  const isGreeting =
    firstUserMsg &&
    /^(hello|hi|hey|greetings|howdy)[!.,? ]*$/i.test(firstUserMsg.trim());
  const chatTitle =
    thread.title && thread.title !== 'New Chat'
      ? thread.title
      : !isGreeting && firstUserMsg
        ? firstUserMsg.length > 36
          ? `${firstUserMsg.slice(0, 36)}...`
          : firstUserMsg
        : thread.title || 'AI Assistant';
  const displayTitle =
    (thread.messages.length > 0 || thread.title) && chatTitle
      ? chatTitle
      : 'AI Assistant';

  return (
    <TooltipProvider delayDuration={150}>
      <div
        role="region"
        aria-label="AI Assistant"
        className="flex flex-col h-full min-h-0 select-none overflow-hidden bg-background"
      >
        {isHistoryView ? (
          <header className="flex h-10 items-center justify-between px-3 border-b border-border bg-transparent shrink-0 select-none">
            <span className="text-13 font-semibold text-foreground tracking-tight">
              Chat history
            </span>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => setHistoryView(false)}
                  className="relative flex size-7 items-center justify-center rounded-md text-foreground hover:bg-muted transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ai"
                  aria-label="Back to chat"
                >
                  <ChevronRight className="size-4 shrink-0 text-foreground" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={4}>
                Back to chat
              </TooltipContent>
            </Tooltip>
          </header>
        ) : (
          <header className="flex h-10 items-center justify-between px-3 border-b border-border bg-transparent shrink-0 select-none">
            <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
              <img
                src="/Chat.svg"
                alt="AI Assistant"
                className="size-4 shrink-0 rounded-full object-contain"
              />
              <span
                className="text-13 font-semibold text-foreground tracking-tight truncate"
                title={displayTitle}
              >
                {displayTitle}
              </span>
            </div>

            <div className="flex items-center gap-0.5 shrink-0">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={startNewChat}
                    className="relative flex size-7 items-center justify-center rounded-md text-foreground hover:bg-muted transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ai"
                    aria-label="New chat"
                  >
                    <SquarePen className="size-3.5 shrink-0 text-foreground" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={4}>
                  New chat
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={toggleHistoryView}
                    className="relative flex size-7 items-center justify-center rounded-md text-foreground hover:bg-muted transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ai"
                    aria-label="Chat history"
                  >
                    <History className="size-3.5 shrink-0 text-foreground" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={4}>
                  Chat history
                </TooltipContent>
              </Tooltip>
            </div>
          </header>
        )}

        {isHistoryView ? (
          <CompanionHistory
            currentSpaceId={effectiveSpaceId}
            onNewChat={startNewChat}
          />
        ) : (
          <>
            <CompanionMessages
              messages={thread.messages}
              isStreaming={thread.isStreaming}
              isLoadingHistory={thread.isLoadingHistory}
              activeAgent={thread.activeAgent}
              error={thread.error}
              messagesEndRef={messagesEndRef}
              scrollContainerRef={scrollContainerRef}
              suggestions={EDITOR_SUGGESTIONS}
              suggestionsTitle="Suggestions"
              onSelectPrompt={(prompt) => void handleSend(prompt)}
              onResumeHitl={(decisions) =>
                void thread.resume(decisions, effectiveSpaceId)
              }
              onRetry={() => void thread.retry()}
              onReviewEditorPatch={reviewEditorPatch}
              onApplyAllEditorPatches={applyAllEditorPatches}
              codeActions={codeActions}
            />

            <Composer
              variant="companion"
              className="px-3 pb-2.5 pt-1.5 bg-background"
              placeholder={
                selectionContext
                  ? 'Ask AI about the selected text...'
                  : 'Ask AI about paper, LaTeX syntax...'
              }
              showDisclaimer
              initialValue={promptToFill}
              draftRevision={draftRevision}
              sources={turnCtx.sources}
              uploadingFiles={turnCtx.uploadingFiles}
              isUploading={turnCtx.isUploading}
              onUploadFiles={turnCtx.uploadFiles}
              onRemoveSource={turnCtx.removeSource}
              onToggleSource={turnCtx.toggleSource}
              onOpenPicker={setPickerTab}
              webSearchEnabled={turnCtx.webSearchEnabled}
              webSearchSites={turnCtx.webSearchSites}
              onWebSearchChange={turnCtx.setWebSearchEnabled}
              onWebSearchSitesChange={turnCtx.setWebSearchSites}
              quotedPassage={
                selectionContext
                  ? {
                      text: selectionContext,
                      label: activeFilename
                        ? `Selected LaTeX • ${activeFilename}`
                        : 'Selected LaTeX',
                    }
                  : null
              }
              onClearQuotedPassage={() => {
                setSelectionContext(null);
                setSelectionFileId(null);
              }}
              isStreaming={thread.isStreaming}
              onSend={(text) => handleSend(text)}
              onStop={() => void thread.stop()}
            />
          </>
        )}

        <ContextPicker
          open={Boolean(pickerTab)}
          onOpenChange={(open) => !open && setPickerTab(null)}
          initialTab={pickerTab ?? 'library'}
          spaceId={effectiveSpaceId}
          selectedIds={selectedIdSet}
          onSelect={(entries) => turnCtx.addSources(entries)}
        />
      </div>
    </TooltipProvider>
  );
}
