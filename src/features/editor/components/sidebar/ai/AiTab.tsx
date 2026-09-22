'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import {
  Sparkles,
  Send,
  Square,
  Trash2,
  X,
  Copy,
  Check,
  ArrowDownToLine,
  Replace,
  Bot,
  User,
  AlertCircle,
  FileCode,
  Wand2,
  CheckCheck,
  RefreshCw,
} from 'lucide-react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { toast } from 'sonner';

import { usePageStore } from '@/features/editor/store';
import { useEditorInstance } from '@/features/editor/core/context/editor-instance.context';
import { EditorEventBus } from '@/features/editor/utils/editor.util';
import {
  streamEditorChat,
  getPageChat,
  clearPageChat,
} from '@/features/ai/services/chat.service';
import type { ChatMessage } from '@/features/ai/types/chat.types';
import { Badge } from '@/shared/components/ui/badge';
import { cn } from '@/shared/lib/utils';

interface AiTabProps {
  onClose?: () => void;
}

const QUICK_ACTIONS = [
  {
    id: 'polish',
    label: 'Viết lại học thuật',
    prompt:
      'Hãy viết lại đoạn văn bản này theo phong cách học thuật chuẩn mực, súc tích và trang trọng hơn bằng LaTeX.',
  },
  {
    id: 'fix_latex',
    label: 'Sửa lỗi LaTeX',
    prompt:
      'Hãy kiểm tra cú pháp LaTeX trong đoạn này, sửa lại các lỗi cú pháp/công thức toán và giải thích ngắn gọn.',
  },
  {
    id: 'explain',
    label: 'Giải thích nội dung',
    prompt:
      'Hãy giải thích chi tiết ý nghĩa toán học / thuật toán hoặc khái niệm trong đoạn mã LaTeX này.',
  },
  {
    id: 'abstract',
    label: 'Soạn tóm tắt Abstract',
    prompt:
      'Dựa trên nội dung tài liệu hiện tại, hãy viết một phần tóm tắt (Abstract) học thuật cô đọng khoảng 150-250 từ.',
  },
  {
    id: 'bibtex',
    label: 'Gợi ý trích dẫn BibTeX',
    prompt:
      'Hãy đề xuất các tài liệu tham khảo kinh điển hoặc định dạng mục \\bibitem / BibTeX phù hợp cho chủ đề này.',
  },
];

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

  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom of messages
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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
    toast.success('Đã chèn mã vào tài liệu');
  };

  // Editor Actions: Replace current selection
  const handleReplaceSelection = (text: string) => {
    if (!engine) {
      toast.error('Editor not ready');
      return;
    }
    engine.insertText(text);
    engine.focus();
    toast.success('Đã thay thế đoạn văn bản bằng mã AI');
  };

  // Copy code snippet
  const handleCopyCode = async (code: string, id: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedIndex(id);
      setTimeout(() => setCopiedIndex(null), 2000);
      toast.success('Đã sao chép vào clipboard');
    } catch {
      toast.error('Không thể sao chép');
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
    if (!query || isStreaming) return;

    const userMessageContent = selectionContext
      ? `[Ngữ cảnh được chọn]:\n\`\`\`latex\n${selectionContext}\n\`\`\`\n\n${query}`
      : query;

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

      const stream = streamEditorChat(newMessages, {
        projectId: currentProjectId,
        documentIds: activePageId ? [activePageId] : undefined,
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
      // Clear selection context after successful interaction
      setSelectionContext(null);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        toast.error(err.message || 'Lỗi gửi tin nhắn đến AI');
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: `⚠️ **Đã xảy ra lỗi:** ${err.message || 'Không thể kết nối đến máy chủ AI.'}`,
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
    toast.success('Đã làm mới cuộc trò chuyện');
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
          <div className="my-2.5 overflow-hidden rounded-md border border-border bg-muted/90 text-foreground">
            <div className="flex items-center justify-between border-b border-border/80 bg-muted/60 px-2.5 py-1 text-10">
              <span className="font-mono text-muted-foreground uppercase">{lang}</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleCopyCode(codeString, blockId)}
                  className="flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-muted-foreground hover:bg-background hover:text-foreground transition-colors cursor-pointer"
                  title="Sao chép mã"
                >
                  {isCopied ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                  <span>{isCopied ? 'Đã chép' : 'Chép'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleInsertAtCursor(codeString)}
                  className="flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-primary hover:bg-background hover:text-primary transition-colors cursor-pointer font-medium"
                  title="Chèn mã tại vị trí con trỏ"
                >
                  <ArrowDownToLine className="size-3" />
                  <span>Chèn</span>
                </button>
                {selectionContext && (
                  <button
                    type="button"
                    onClick={() => handleReplaceSelection(codeString)}
                    className="flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-amber-600 dark:text-amber-400 hover:bg-background transition-colors cursor-pointer font-medium"
                    title="Thay thế đoạn bôi đen bằng mã này"
                  >
                    <Replace className="size-3" />
                    <span>Thay</span>
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
        <code className="rounded-sm bg-muted px-1 py-0.5 font-mono text-11 text-primary" {...props}>
          {children}
        </code>
      );
    },
    p({ children }) {
      return <p className="mb-2 text-xs leading-relaxed text-foreground/90 last:mb-0">{children}</p>;
    },
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background text-foreground select-none">
      {/* ── Top Header ── */}
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-border px-3 bg-background">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex size-6 items-center justify-center rounded-md bg-muted/60">
            <img src="/Chat.svg" alt="AI" className="size-4 shrink-0 rounded-full" />
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-foreground truncate">AI Copilot Học thuật</span>
              <Badge variant="outline" className="text-9 px-1 py-0 bg-primary/10 text-primary border-primary/20">
                LaTeX
              </Badge>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleClearChat}
            disabled={messages.length === 0 && !streamingMessage}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-muted transition-colors disabled:opacity-40 cursor-pointer"
            title="Làm mới cuộc trò chuyện"
          >
            <Trash2 className="size-3.5" />
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="flex size-7 items-center justify-center rounded-md text-foreground hover:bg-sidebar-hover transition-colors cursor-pointer"
              title="Đóng bảng AI"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ── Selection Context Banner ── */}
      {selectionContext && (
        <div className="shrink-0 border-b border-border bg-primary/5 px-3 py-1.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <Wand2 className="size-3 text-primary shrink-0" />
            <span className="text-11 font-medium text-primary truncate">
              Vùng chọn: &ldquo;{selectionContext.slice(0, 32)}
              {selectionContext.length > 32 ? '...' : ''}&rdquo;
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSelectionContext(null)}
            className="text-muted-foreground hover:text-foreground text-10 px-1 py-0.5 rounded-sm hover:bg-muted transition-colors cursor-pointer"
            title="Hủy vùng chọn"
          >
            Bỏ chọn
          </button>
        </div>
      )}

      {/* ── Messages Scroll Area ── */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3.5 select-text">
        {isLoadingHistory && (
          <div className="flex items-center justify-center py-6 text-xs text-muted-foreground gap-2">
            <RefreshCw className="size-3.5 animate-spin" />
            <span>Đang tải lịch sử...</span>
          </div>
        )}

        {messages.length === 0 && !streamingMessage && !isLoadingHistory && (
          <div className="flex flex-col items-center justify-center h-full py-8 text-center text-muted-foreground space-y-3">
            <div className="flex size-12 items-center justify-center rounded-md bg-muted/80 text-primary/80">
              <Bot className="size-6" />
            </div>
            <div className="space-y-1 max-w-[240px]">
              <p className="text-xs font-semibold text-foreground">Trợ lý Nghiên cứu & LaTeX</p>
              <p className="text-11 leading-relaxed text-muted-foreground">
                Hỏi đáp cú pháp, viết lại đoạn văn chuẩn IEEE/ACM, chỉnh sửa lỗi biên dịch hoặc giải thích công thức.
              </p>
            </div>

            {/* Quick Action Pills */}
            <div className="w-full pt-3 flex flex-col gap-1.5 text-left">
              <span className="text-10 font-semibold uppercase tracking-wider text-muted-foreground/70 px-1">
                Tác vụ nhanh:
              </span>
              {QUICK_ACTIONS.map((act) => (
                <button
                  key={act.id}
                  type="button"
                  onClick={() => handleSendMessage(act.prompt)}
                  className="flex items-center justify-between rounded-md border border-border bg-card px-2.5 py-1.5 text-xs text-foreground hover:bg-accent/60 hover:border-primary/30 transition-colors text-left cursor-pointer shadow-2xs"
                >
                  <span className="truncate">{act.label}</span>
                  <Sparkles className="size-3 text-primary/60 shrink-0 ml-1.5" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Existing Messages */}
        {messages.map((msg, idx) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={idx}
              className={cn(
                'flex flex-col gap-1 text-xs',
                isUser ? 'items-end' : 'items-start',
              )}
            >
              <div className="flex items-center gap-1.5 text-10 text-muted-foreground px-1">
                {isUser ? (
                  <>
                    <span>Bạn</span>
                    <User className="size-3" />
                  </>
                ) : (
                  <>
                    <Bot className="size-3 text-primary" />
                    <span className="text-primary font-medium">AI Copilot</span>
                  </>
                )}
              </div>

              <div
                className={cn(
                  'rounded-lg px-3 py-2 max-w-[95%] leading-relaxed',
                  isUser
                    ? 'bg-primary text-primary-foreground font-normal rounded-tr-xs'
                    : 'bg-muted/80 text-foreground border border-border/70 rounded-tl-xs',
                )}
              >
                {isUser ? (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                ) : (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                    components={markdownComponents}
                  >
                    {msg.content}
                  </ReactMarkdown>
                )}
              </div>
            </div>
          );
        })}

        {/* Streaming In-Progress Assistant Bubble */}
        {streamingMessage && (
          <div className="flex flex-col gap-1 items-start text-xs">
            <div className="flex items-center gap-1.5 text-10 text-primary px-1">
              <Bot className="size-3 animate-pulse" />
              <span className="font-medium">AI đang soạn câu trả lời...</span>
            </div>

            <div className="rounded-lg rounded-tl-xs px-3 py-2 max-w-[95%] bg-muted/80 text-foreground border border-border/70 leading-relaxed">
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeKatex]}
                components={markdownComponents}
              >
                {streamingMessage}
              </ReactMarkdown>
              <span className="inline-block size-1.5 ml-1 bg-primary rounded-full animate-ping" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Chat Input Area ── */}
      <div className="shrink-0 border-t border-border bg-background p-2.5">
        {/* Quick action chips above textarea if conversation is active */}
        {messages.length > 0 && (
          <div className="flex items-center gap-1 overflow-x-auto pb-2 scrollbar-none">
            {QUICK_ACTIONS.slice(0, 3).map((act) => (
              <button
                key={act.id}
                type="button"
                onClick={() => handleSendMessage(act.prompt)}
                disabled={isStreaming}
                className="shrink-0 rounded-sm border border-border bg-muted px-2.5 py-0.5 text-10 font-medium text-foreground hover:bg-muted/80 hover:border-primary/40 transition-colors disabled:opacity-40 cursor-pointer shadow-2xs"
              >
                {act.label}
              </button>
            ))}
          </div>
        )}

        <div className="relative flex items-end gap-1.5 rounded-md border border-border bg-muted/40 p-1.5 focus-within:border-primary/60 focus-within:ring-1 focus-within:ring-primary/40 transition-all">
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
                ? 'Hỏi AI về đoạn văn bản đã chọn...'
                : 'Hỏi AI về bài báo, sửa LaTeX, định lý...'
            }
            disabled={isStreaming}
            className="flex-1 max-h-[140px] resize-none bg-transparent px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground/60 outline-none leading-relaxed"
          />

          {isStreaming ? (
            <button
              type="button"
              onClick={handleStopStreaming}
              className="flex size-7 items-center justify-center rounded-sm bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors cursor-pointer shrink-0 shadow-2xs"
              title="Dừng sinh phản hồi"
            >
              <Square className="size-3.5 fill-current" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleSendMessage()}
              disabled={!inputPrompt.trim()}
              className="flex size-7 items-center justify-center rounded-sm bg-primary text-primary-foreground hover:bg-primary-hover transition-colors disabled:opacity-40 cursor-pointer shrink-0 shadow-2xs"
              title="Gửi câu hỏi (Enter)"
            >
              <Send className="size-3.5" />
            </button>
          )}
        </div>
        <div className="flex items-center justify-between px-1 pt-1.5 text-9 text-muted-foreground/70">
          <span>Enter để gửi, Shift+Enter xuống dòng</span>
          <span className="truncate max-w-[120px]">
            {currentPage?.title || 'main.tex'}
          </span>
        </div>
      </div>
    </div>
  );
}
