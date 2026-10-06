'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import nextDynamic from 'next/dynamic';
import { useParams } from 'next/navigation';
import {
  ArrowUp,
  Square,
  X,
  Copy,
  Check,
  ArrowDownToLine,
  Replace,
  Brain,
  ChevronDown,
  RefreshCw,
  SquarePen,
  CornerDownRight,
  Plus,
  Upload,
  HardDrive,
  BookOpen,
  Database,
  Globe,
  Loader2,
  FileText,
  FileImage,
  FileSpreadsheet,
  FileCode,
  File,
} from 'lucide-react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { toast } from 'sonner';
import { AIIcon } from '@/shared/components/icons';

import { usePageStore } from '@/features/editor/store';
import { useEditorInstance } from '@/features/editor/core/context/editor-instance.context';
import { EditorEventBus } from '@/features/editor/utils/editor.util';
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
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/shared/components/ui/dropdown-menu';
import { cn } from '@/shared/lib/utils';
import { CompanionHero } from '@/features/ai/components/companion/CompanionHero';

const LibraryPickerModal = nextDynamic(
  () =>
    import('@/features/ai/components/companion/LibraryPickerModal').then(
      (m) => m.LibraryPickerModal
    ),
  { ssr: false }
);

const StoragePickerModal = nextDynamic(
  () =>
    import('@/features/ai/components/companion/StoragePickerModal').then(
      (m) => m.StoragePickerModal
    ),
  { ssr: false }
);

const UploadedDocumentsModal = nextDynamic(
  () =>
    import('@/features/ai/components/companion/UploadedDocumentsModal').then(
      (m) => m.UploadedDocumentsModal
    ),
  { ssr: false }
);

const ACCEPTED_TYPES =
  '.pdf,.doc,.docx,.txt,.md,.csv,.xls,.xlsx,.png,.jpg,.jpeg,.json,.ts,.tsx,.js,.py';

interface AttachedFile {
  id: string;
  name: string;
  size?: number;
}

interface UploadingFileItem {
  id: string;
  name: string;
  size?: number;
  progress: number;
  stage: 'uploading' | 'processing';
}

function formatBytes(bytes?: number): string {
  if (!bytes || isNaN(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileMeta(name: string, size?: number) {
  const parts = (name || '').split('.');
  const ext = parts.length > 1 ? (parts.pop() || '').toLowerCase() : '';
  const sizeText = size ? formatBytes(size) : '';

  if (ext === 'pdf') {
    return {
      type: 'PDF',
      icon: FileText,
      iconColor: 'text-destructive',
      sizeText,
    };
  }
  if (['doc', 'docx'].includes(ext)) {
    return {
      type: 'Word',
      icon: FileText,
      iconColor: 'text-blue-500',
      sizeText,
    };
  }
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) {
    return {
      type: 'Image',
      icon: FileImage,
      iconColor: 'text-primary',
      sizeText,
    };
  }
  if (['xls', 'xlsx', 'csv'].includes(ext)) {
    return {
      type: 'Sheet',
      icon: FileSpreadsheet,
      iconColor: 'text-emerald-500',
      sizeText,
    };
  }
  if (
    [
      'ts',
      'tsx',
      'js',
      'jsx',
      'json',
      'py',
      'java',
      'cpp',
      'c',
      'go',
      'rs',
      'md',
      'txt',
    ].includes(ext)
  ) {
    return {
      type: 'Code',
      icon: FileCode,
      iconColor: 'text-amber-500',
      sizeText,
    };
  }
  return {
    type: 'File',
    icon: File,
    iconColor: 'text-muted-foreground',
    sizeText,
  };
}

interface AiTabProps {
  onClose?: () => void;
}

const QUICK_ACTIONS = [
  {
    id: 'polish',
    label: 'Academic Polish',
    prompt:
      'Rewrite this text in a rigorous, concise, and formal academic style using standard LaTeX.',
  },
  {
    id: 'fix_latex',
    label: 'Fix LaTeX Errors',
    prompt:
      'Inspect the LaTeX syntax in this selection, fix any syntax or math formula issues, and briefly explain the changes.',
  },
  {
    id: 'explain',
    label: 'Explain Content',
    prompt:
      'Provide a detailed explanation of the mathematical derivation, algorithm, or theoretical concept in this LaTeX snippet.',
  },
  {
    id: 'abstract',
    label: 'Draft Abstract',
    prompt:
      'Based on the current document context, compose a concise, publication-ready academic abstract between 150-250 words.',
  },
  {
    id: 'bibtex',
    label: 'BibTeX Suggestions',
    prompt:
      'Suggest classic references and properly formatted BibTeX citation entries appropriate for this topic.',
  },
];

function parseThinkingContent(raw: string): {
  thinking: string | null;
  answer: string;
  isThinkingOpen: boolean;
} {
  const openIdx = raw.indexOf('<think>');
  if (openIdx === -1) return { thinking: null, answer: raw, isThinkingOpen: false };

  const closeIdx = raw.indexOf('</think>', openIdx);
  if (closeIdx === -1) {
    return {
      thinking: raw.slice(openIdx + 7),
      answer: '',
      isThinkingOpen: true,
    };
  }
  return {
    thinking: raw.slice(openIdx + 7, closeIdx).trim(),
    answer: raw.slice(closeIdx + 8).trimStart(),
    isThinkingOpen: false,
  };
}

function ThinkingBlock({ content, isOpen }: { content: string; isOpen: boolean }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className="mb-2 rounded-md border border-border bg-muted/40 overflow-hidden text-11">
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        aria-expanded={!collapsed}
        aria-label={isOpen ? 'AI is thinking' : 'Toggle thought process'}
        className="w-full flex items-center gap-1.5 px-2.5 py-1.5 text-left hover:bg-muted transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ai select-none"
      >
        <Brain className={cn('size-3 shrink-0 text-ai', isOpen && 'animate-pulse motion-reduce:animate-none')} />
        <span className="text-11 font-medium text-muted-foreground flex-1">
          {isOpen ? 'Thinking...' : 'Thought process'}
        </span>
        {!isOpen && (
          <ChevronDown
            className={cn(
              'size-3 text-muted-foreground/60 transition-transform shrink-0',
              collapsed && '-rotate-90'
            )}
          />
        )}
      </button>
      {!collapsed && (
        <div className="px-3 pb-2 pt-1 border-t border-border">
          <p className="text-11 leading-relaxed text-muted-foreground/80 whitespace-pre-wrap font-mono">
            {content}
          </p>
        </div>
      )}
    </div>
  );
}

export default function AiTab({ onClose }: AiTabProps) {
  const params = useParams<{ projectId?: string; pageId?: string; draftId?: string }>();
  const { currentPage } = usePageStore();
  const { engine, getContent } = useEditorInstance();

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
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFileItem[]>([]);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [isLibraryModalOpen, setIsLibraryModalOpen] = useState(false);
  const [isStorageModalOpen, setIsStorageModalOpen] = useState(false);
  const [isUploadedDocsModalOpen, setIsUploadedDocsModalOpen] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
        toast.success(`Attached "${file.name}"`);
      } catch (err: any) {
        setUploadingFiles((prev) => prev.filter((item) => item.id !== tempId));
        toast.error(err.message || `Failed to upload "${file.name}"`);
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
    return EditorEventBus.on('flux:open-ai-panel', (detail) => {
      if (detail?.selectedText) {
        setSelectionContext(detail.selectedText);
      } else if (engine) {
        const text = engine.getSelectedText();
        if (text.trim()) {
          setSelectionContext(text);
        }
      }

      if (detail?.initialPrompt) {
        setInputPrompt(detail.initialPrompt);
      }

      setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
    });
  }, [engine]);

  // Auto-resize textarea
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputPrompt(e.target.value);
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 140)}px`;
  };

  // Editor Actions: Insert at cursor
  const handleInsertAtCursor = (text: string) => {
    if (!engine) {
      toast.error('Editor not ready');
      return;
    }
    engine.insertText(text);
    engine.focus();
    toast.success('Inserted code into document');
  };

  // Editor Actions: Replace current selection
  const handleReplaceSelection = (text: string) => {
    if (!engine) {
      toast.error('Editor not ready');
      return;
    }
    engine.insertText(text);
    engine.focus();
    toast.success('Replaced selection with AI code');
  };

  // Copy code snippet
  const handleCopyCode = async (code: string, id: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedIndex(id);
      setTimeout(() => setCopiedIndex(null), 2000);
      toast.success('Copied to clipboard');
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  };

  // Stop streaming
  const handleStopStreaming = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (streamingMessage) {
      setMessages((prev) => [...prev, { role: 'assistant', content: streamingMessage }]);
      setStreamingMessage('');
    }
    setIsStreaming(false);
  };

  // Send message
  const handleSendMessage = async (customPrompt?: string) => {
    const query = (customPrompt || inputPrompt).trim();
    if ((!query && attachedFiles.length === 0) || isStreaming) return;

    let userMessageContent = query;
    if (selectionContext) {
      userMessageContent = `[Selected context]:\n\`\`\`latex\n${selectionContext}\n\`\`\`\n\n${query}`;
    }

    const newMessages: ChatMessage[] = [
      ...messages,
      { role: 'user', content: userMessageContent },
    ];

    setMessages(newMessages);
    setInputPrompt('');
    setStreamingMessage('');
    setIsStreaming(true);

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const activeFilename = currentPage?.title || 'main.tex';
      const fileContent = getContent();
      const finalDocIds = [
        ...(activePageId ? [activePageId] : []),
        ...attachedFiles.map((f) => f.id),
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
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        toast.error(err.message || 'Failed to send message to AI');
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: `⚠️ **An error occurred:** ${err.message || 'Could not connect to the AI server.'}`,
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
    toast.success('Conversation history cleared');
  };

  // Custom markdown code renderer with interactive Editor bridge buttons
  const markdownComponents: Components = {
    code({ className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || '');
      const codeString = String(children).replace(/\n$/, '');
      const isBlock = Boolean(match) || codeString.includes('\n');
      const lang = match ? match[1] : 'latex';
      const blockId = `${lang}-${codeString.slice(0, 16)}`;

      if (isBlock) {
        const isCopied = copiedIndex === blockId;
        return (
          <div className="my-2.5 overflow-hidden rounded-md border border-border bg-background/90 text-foreground">
            <div className="flex items-center justify-between border-b border-border/80 bg-muted/50 px-2.5 py-1 text-10">
              <span className="font-mono text-muted-foreground uppercase">{lang}</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleCopyCode(codeString, blockId)}
                  className="flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                  title="Copy code"
                >
                  {isCopied ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                  <span>{isCopied ? 'Copied' : 'Copy'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleInsertAtCursor(codeString)}
                  className="flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-ai hover:bg-ai-subtle transition-colors cursor-pointer font-medium"
                  title="Insert code at cursor"
                >
                  <ArrowDownToLine className="size-3" />
                  <span>Insert</span>
                </button>
                {selectionContext && (
                  <button
                    type="button"
                    onClick={() => handleReplaceSelection(codeString)}
                    className="flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 transition-colors cursor-pointer font-medium"
                    title="Replace selection with this code"
                  >
                    <Replace className="size-3" />
                    <span>Replace</span>
                  </button>
                )}
              </div>
            </div>
            <pre className="overflow-x-auto p-2.5 font-mono text-xs leading-relaxed text-foreground">
              <code>{codeString}</code>
            </pre>
          </div>
        );
      }

      return (
        <code className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-xs text-ai font-medium" {...props}>
          {children}
        </code>
      );
    },
    p({ children }) {
      return <p className="mb-2 text-13 leading-relaxed text-foreground last:mb-0">{children}</p>;
    },
  };

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex h-full w-full flex-col overflow-hidden bg-background text-foreground select-none">
      {/* ── Top Header (Unified with Project Shell / AiCompanionSidebar: h-11, text-13, SquarePen, X) ── */}
      <header className="flex h-11 items-center justify-between px-2.5 sm:px-3 border-b border-border bg-transparent shrink-0 select-none">
        {/* Left: Title */}
        <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
          <span className="font-semibold text-13 text-foreground tracking-tight truncate">
            AI Assistant
          </span>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-0.5 shrink-0">
          {/* New Chat */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={handleClearChat}
                className="flex size-7 items-center justify-center rounded-md text-foreground hover:bg-muted transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ai"
                aria-label="New chat"
              >
                <SquarePen className="size-3.5 shrink-0 text-foreground" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={4}>
              New chat
            </TooltipContent>
          </Tooltip>

          {/* Close Sidebar */}
          {onClose && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex size-7 items-center justify-center rounded-md text-foreground hover:bg-muted transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ai"
                  aria-label="Close AI panel"
                >
                  <X className="size-3.5 shrink-0 text-foreground" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={4}>
                Close AI panel
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </header>

      {/* ── Selection Context Banner ── */}
      {selectionContext && (
        <div className="shrink-0 border-b border-border bg-ai-subtle/50 px-3 py-1.5 flex items-center justify-between gap-2 select-none">
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
            <RefreshCw className="size-3.5 animate-spin text-ai" />
            <span>Loading history...</span>
          </div>
        )}

        {/* ── Empty State: Synchronized with Project Companion Hero & Suggestions ── */}
        {messages.length === 0 && !streamingMessage && !isLoadingHistory && (
          <div className="flex flex-col justify-center select-none py-1 gap-2.5 my-auto">
            {/* Central Luminous 3D AI Orb */}
            <CompanionHero />

            {/* Suggestions Section (Signatures styling: CornerDownRight, hover bg-muted/60) */}
            <div className="w-full pt-1 flex flex-col gap-0.5 text-left">
              <div className="px-2 mb-1">
                <span className="text-12 font-medium text-muted-foreground">
                  Suggestions
                </span>
              </div>
              <div className="space-y-0.5">
                {QUICK_ACTIONS.map((act) => (
                  <button
                    key={act.id}
                    type="button"
                    onClick={() => handleSendMessage(act.prompt)}
                    className="w-full flex items-start gap-2.5 py-2 px-2.5 text-left text-13 text-foreground hover:bg-muted/60 rounded-lg transition-colors cursor-pointer group"
                  >
                    <CornerDownRight className="size-3.5 text-muted-foreground group-hover:text-foreground shrink-0 mt-0.5 transition-colors" />
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="leading-snug text-13 font-normal text-foreground">
                        {act.label}
                      </span>
                      <span className="text-11 text-muted-foreground line-clamp-1">
                        {act.prompt}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Existing Messages */}
        {messages.map((msg, idx) => {
          const isUser = msg.role === 'user';
          const { thinking, answer, isThinkingOpen } = isUser
            ? { thinking: null, answer: msg.content, isThinkingOpen: false }
            : parseThinkingContent(msg.content);

          return (
            <div
              key={idx}
              className={cn(
                'group flex flex-col gap-1 w-full text-13',
                isUser ? 'items-end' : 'items-start',
              )}
            >
              <div
                className={cn(
                  'relative max-w-[92%] rounded-md px-3 py-2 leading-relaxed',
                  isUser
                    ? 'bg-primary text-primary-foreground font-normal whitespace-pre-wrap'
                    : 'bg-muted/50 border border-border/80 text-foreground'
                )}
              >
                {thinking && <ThinkingBlock content={thinking} isOpen={isThinkingOpen} />}
                {isUser ? (
                  <div>{msg.content}</div>
                ) : (
                  <div className="prose prose-sm dark:prose-invert max-w-none text-13 space-y-2 break-words [&>p]:leading-relaxed [&>ul]:pl-4 [&>ol]:pl-4 [&_code]:font-mono [&_code]:text-11">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm, remarkMath]}
                      rehypePlugins={[rehypeKatex]}
                      components={markdownComponents}
                    >
                      {answer || msg.content}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Streaming In-Progress Assistant Bubble */}
        {streamingMessage && (
          <div className="flex flex-col gap-1 w-full items-start text-13">
            <div className="relative max-w-[92%] rounded-md px-3 py-2 leading-relaxed bg-muted/50 border border-border/80 text-foreground">
              <div className="text-10 font-medium text-ai mb-1 flex items-center gap-1 select-none">
                <Loader2 className="size-2.5 animate-spin motion-reduce:animate-none" />
                <span>Flux AI Assistant</span>
              </div>
              {(() => {
                const { thinking, answer, isThinkingOpen } = parseThinkingContent(streamingMessage);
                return (
                  <>
                    {thinking && <ThinkingBlock content={thinking} isOpen={isThinkingOpen} />}
                    <div className="prose prose-sm dark:prose-invert max-w-none text-13 space-y-2 break-words [&>p]:leading-relaxed [&>ul]:pl-4 [&>ol]:pl-4 [&_code]:font-mono [&_code]:text-11">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm, remarkMath]}
                        rehypePlugins={[rehypeKatex]}
                        components={markdownComponents}
                      >
                        {answer || (!thinking ? streamingMessage : '')}
                      </ReactMarkdown>
                      <span className="inline-block w-1.5 h-3.5 bg-ai ml-0.5 animate-pulse" />
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Chat Input Area: Synchronized with CompanionInput card styling ── */}
      <div className="shrink-0 p-2.5 sm:p-3 border-t border-border bg-background select-none">
        {/* Quick action chips above textarea if conversation is active */}
        {messages.length > 0 && (
          <div className="flex items-center gap-1 overflow-x-auto pb-2 scrollbar-none">
            {QUICK_ACTIONS.slice(0, 3).map((act) => (
              <button
                key={act.id}
                type="button"
                onClick={() => handleSendMessage(act.prompt)}
                disabled={isStreaming}
                className="shrink-0 rounded-md border border-border bg-muted/30 px-2 py-0.5 text-11 font-medium text-foreground hover:bg-muted hover:border-border transition-colors disabled:opacity-40 cursor-pointer"
              >
                {act.label}
              </button>
            ))}
          </div>
        )}

        {/* Input Card */}
        <div className="rounded-lg border border-border bg-muted/20 focus-within:border-ai/50 focus-within:bg-background transition-all p-2 flex flex-col gap-1.5 shadow-2xs">
          {/* Attached Files List */}
          {(attachedFiles.length > 0 || uploadingFiles.length > 0) && (
            <div className="flex items-center gap-1.5 flex-wrap pb-1.5 pt-0.5 max-h-32 overflow-y-auto">
              {/* Uploading files */}
              {uploadingFiles.map((up) => {
                const isProcessing = up.stage === 'processing';
                return (
                  <Tooltip key={up.id}>
                    <TooltipTrigger asChild>
                      <div className="inline-flex h-6.5 items-center gap-1.5 px-2 rounded-md border border-border/70 bg-muted/40 text-11 text-foreground transition-all select-none max-w-[240px] cursor-default">
                        <Loader2 className="size-3 animate-spin text-ai shrink-0" />
                        <span className="truncate max-w-[120px] font-medium">{up.name}</span>
                        <span className="text-10 text-muted-foreground font-mono shrink-0">
                          {isProcessing ? 'Indexing...' : `${up.progress}%`}
                        </span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={4} className="max-w-xs">
                      <p className="font-medium truncate">{up.name}</p>
                      <p className="text-10 text-muted-foreground">
                        {isProcessing
                          ? 'Extracting content & indexing vector store...'
                          : `Uploading: ${up.progress}%`}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                );
              })}

              {/* Uploaded files */}
              {attachedFiles.map((file) => {
                const meta = getFileMeta(file.name, file.size);
                const IconComp = meta.icon;
                return (
                  <div
                    key={file.id}
                    className="group relative inline-flex h-6.5 items-center gap-1.5 px-2 rounded-md border border-border bg-background hover:bg-muted/50 text-11 text-foreground transition-all select-none max-w-[240px]"
                  >
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-1.5 min-w-0 cursor-default">
                          <IconComp className={cn('size-3 shrink-0', meta.iconColor)} />
                          <span className="truncate max-w-[120px] font-medium">
                            {file.name}
                          </span>
                          {meta.sizeText && (
                            <span className="text-10 text-muted-foreground shrink-0">
                              {meta.sizeText}
                            </span>
                          )}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top" sideOffset={4} className="max-w-xs">
                        <p className="font-medium truncate">{file.name}</p>
                        {meta.sizeText && (
                          <p className="text-10 text-muted-foreground">
                            {meta.sizeText} • Ready for AI
                          </p>
                        )}
                      </TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => removeAttachedFile(file.id)}
                          className="size-4.5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted ml-0.5 cursor-pointer"
                          aria-label={`Remove ${file.name}`}
                        >
                          <X className="size-2.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" sideOffset={4}>
                        Remove document
                      </TooltipContent>
                    </Tooltip>
                  </div>
                );
              })}
            </div>
          )}

          <textarea
            ref={textareaRef}
            rows={1}
            value={inputPrompt}
            onChange={handleTextareaChange}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder={
              selectionContext
                ? 'Ask AI about the selected text...'
                : 'Ask AI about paper, LaTeX syntax, theorem...'
            }
            disabled={isStreaming}
            className="w-full resize-none bg-transparent text-13 text-foreground placeholder:text-muted-foreground outline-none leading-relaxed min-h-[32px] max-h-[140px] px-0.5 py-1"
          />

          {/* Bottom Action Toolbar inside card */}
          <div className="flex items-center justify-between pt-1">
            {/* Left tools: Plus menu containing upload, storage import, library import, web search */}
            <div className="flex items-center gap-1">
              <DropdownMenu>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        disabled={isStreaming}
                        className={cn(
                          'relative flex size-7 items-center justify-center rounded-md text-foreground hover:bg-muted transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ai',
                          isStreaming && 'opacity-40 cursor-not-allowed'
                        )}
                        aria-label="Add attachment or toggle features"
                      >
                        <Plus className="size-4 shrink-0 text-foreground" />
                      </button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={4}>
                    Add documents or tools
                  </TooltipContent>
                </Tooltip>
                <DropdownMenuContent
                  align="start"
                  side="top"
                  sideOffset={8}
                  className="w-56 p-1 rounded-lg shadow-lg border border-border bg-popover text-foreground select-none space-y-0.5"
                >
                  {/* 1. Upload from Device */}
                  <DropdownMenuItem
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-13 font-normal cursor-pointer hover:bg-muted focus:bg-muted text-foreground"
                  >
                    <Upload className="size-4 text-foreground shrink-0" />
                    <span>Upload from device</span>
                  </DropdownMenuItem>

                  {/* 2. Import from Storage */}
                  <DropdownMenuItem
                    onClick={() => setIsStorageModalOpen(true)}
                    className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-13 font-normal cursor-pointer hover:bg-muted focus:bg-muted text-foreground"
                  >
                    <HardDrive className="size-4 text-foreground shrink-0" />
                    <span>Import from Storage</span>
                  </DropdownMenuItem>

                  {/* 3. Import from Library */}
                  <DropdownMenuItem
                    onClick={() => setIsLibraryModalOpen(true)}
                    className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-13 font-normal cursor-pointer hover:bg-muted focus:bg-muted text-foreground"
                  >
                    <BookOpen className="size-4 text-foreground shrink-0" />
                    <span>Import from Library</span>
                  </DropdownMenuItem>

                  {/* 4. Uploaded AI Documents */}
                  <DropdownMenuItem
                    onClick={() => setIsUploadedDocsModalOpen(true)}
                    className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-13 font-normal cursor-pointer hover:bg-muted focus:bg-muted text-foreground"
                  >
                    <Database className="size-4 text-foreground shrink-0" />
                    <span>Uploaded documents</span>
                  </DropdownMenuItem>

                  <DropdownMenuSeparator className="my-1" />

                  {/* 5. Web Search Toggle inside the Plus menu */}
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      setWebSearchEnabled(!webSearchEnabled);
                    }}
                    className="flex items-center justify-between px-2.5 py-1.5 rounded-md hover:bg-muted transition-colors cursor-pointer select-none text-foreground text-13 font-normal"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Globe className="size-4 text-foreground shrink-0" />
                      <span>Web search</span>
                    </div>
                    <div
                      className={cn(
                        'relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out',
                        webSearchEnabled ? 'bg-ai' : 'bg-muted-foreground/30'
                      )}
                    >
                      <span
                        className={cn(
                          'pointer-events-none inline-block size-3 rounded-full bg-white transform ring-0 transition duration-200 ease-in-out',
                          webSearchEnabled ? 'translate-x-3' : 'translate-x-0'
                        )}
                      />
                    </div>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="flex items-center gap-1">
              {isStreaming ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={handleStopStreaming}
                      className="flex size-7 items-center justify-center rounded-md bg-ai text-white hover:bg-ai-hover transition-all active:scale-95 cursor-pointer shadow-xs"
                      aria-label="Stop generating"
                    >
                      <Square className="size-3 fill-current" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={4}>
                    Stop generating
                  </TooltipContent>
                </Tooltip>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => handleSendMessage()}
                      disabled={(!inputPrompt.trim() && attachedFiles.length === 0) || uploadingFiles.length > 0}
                      className={cn(
                        'flex size-7 items-center justify-center rounded-md p-0 transition-all select-none',
                        uploadingFiles.length > 0
                          ? 'bg-muted text-muted-foreground cursor-not-allowed opacity-60'
                          : (!inputPrompt.trim() && attachedFiles.length === 0)
                            ? 'bg-muted text-muted-foreground cursor-not-allowed opacity-40'
                            : 'bg-ai text-white hover:bg-ai-hover active:scale-95 cursor-pointer shadow-xs'
                      )}
                      aria-label={uploadingFiles.length > 0 ? 'Processing documents...' : 'Send message'}
                    >
                      {uploadingFiles.length > 0 ? (
                        <Loader2 className="size-3.5 animate-spin text-ai" />
                      ) : (
                        <ArrowUp className="size-3.5 shrink-0 stroke-[2.5] translate-y-[1px]" />
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={4}>
                    {uploadingFiles.length > 0 ? 'Processing documents...' : 'Send message (Enter)'}
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>
        </div>

        {/* Plane Style Disclaimer Footer */}
        <p className="text-11 text-muted-foreground text-center select-none pt-2 pb-0.5 leading-normal">
          Flux AI can make mistakes, please double-check responses.
        </p>
      </div>

      {/* Hidden File Input for Device Upload */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={ACCEPTED_TYPES}
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* Attachment Modals */}
      <LibraryPickerModal
        isOpen={isLibraryModalOpen}
        onClose={() => setIsLibraryModalOpen(false)}
        projectId={currentProjectId}
        onSelectItems={(items) => {
          setAttachedFiles((prev) => {
            const existingIds = new Set(prev.map((f) => f.id));
            const newOnes = items
              .filter((it) => !existingIds.has(it.id))
              .map((it) => ({ id: it.id, name: it.name, size: it.size }));
            return [...prev, ...newOnes];
          });
          toast.success(`Attached ${items.length} item(s) from Library`);
        }}
      />

      <StoragePickerModal
        isOpen={isStorageModalOpen}
        onClose={() => setIsStorageModalOpen(false)}
        projectId={currentProjectId}
        onSelectItems={(items) => {
          setAttachedFiles((prev) => {
            const existingIds = new Set(prev.map((f) => f.id));
            const newOnes = items
              .filter((it) => !existingIds.has(it.id))
              .map((it) => ({ id: it.id, name: it.name, size: it.size }));
            return [...prev, ...newOnes];
          });
          toast.success(`Attached ${items.length} file(s) from Storage`);
        }}
      />

      <UploadedDocumentsModal
        isOpen={isUploadedDocsModalOpen}
        onClose={() => setIsUploadedDocsModalOpen(false)}
        projectId={currentProjectId}
        onSelectItems={(items) => {
          setAttachedFiles((prev) => {
            const existingIds = new Set(prev.map((f) => f.id));
            const newOnes = items
              .filter((it) => !existingIds.has(it.id))
              .map((it) => ({ id: it.id, name: it.name, size: it.size }));
            return [...prev, ...newOnes];
          });
          toast.success(`Selected ${items.length} uploaded document(s)`);
        }}
      />
    </div>
  </TooltipProvider>
);
}
