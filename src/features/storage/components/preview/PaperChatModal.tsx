'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Sparkles,
  ArrowUp,
  Square,
  RotateCcw,
  Copy,
  Check,
  BookOpen,
  Layers,
  Bot,
  User as UserIcon,
  Loader2,
  FileText,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui';
import { renderMarkdown } from '@/features/ai/utils/render-markdown';
import { streamPaperChat } from '@/features/reader/services/ai.service';
import type { StorageItem } from '@/features/storage/types/storage.types';
import { copyToClipboard } from '@/shared/lib/utils';
import { toast } from 'sonner';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
}

interface PaperChatModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  file: StorageItem | null;
  projectId?: string;
}

const QUICK_PROMPTS = [
  {
    id: 'contributions',
    title: 'Đóng góp khoa học chính',
    prompt:
      'Tóm tắt 3 đóng góp khoa học và điểm mới cốt lõi nhất của bài báo này dưới dạng gạch đầu dòng ngắn gọn, súc tích.',
  },
  {
    id: 'methodology',
    title: 'Phương pháp & Mô hình',
    prompt:
      'Giải thích chi tiết phương pháp nghiên cứu, thuật toán và kiến trúc hệ thống được đề xuất trong bài báo.',
  },
  {
    id: 'benchmarks',
    title: 'Bộ dữ liệu & Đánh giá',
    prompt:
      'Trích xuất toàn bộ các bộ dữ liệu thực nghiệm (benchmarks), các độ đo đánh giá và kết quả so sánh với baseline thành bảng Markdown.',
  },
  {
    id: 'limitations',
    title: 'Hạn chế & Hướng nghiên cứu',
    prompt:
      'Chỉ ra các điểm hạn chế thực nghiệm, giả định chưa giải quyết và các hướng nghiên cứu mở mà tác giả đề cập.',
  },
];

export default function PaperChatModal({
  open,
  onOpenChange,
  file,
  projectId,
}: PaperChatModalProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const meta = (file?.metaData as Record<string, any>) || {};
  const paperTitle = meta.title || file?.filename || 'Scientific Paper';
  const chunkCount = meta.chunkCount || 1;

  // Initialize or reset chat when opening a new file
  useEffect(() => {
    if (open && file) {
      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
          content: `Xin chào! Tôi là **Trợ lý AI Nghiên cứu**. Tôi đã nạp toàn bộ kiến thức và **${chunkCount} semantic chunks** từ bài báo khoa học **"${paperTitle}"** vào bộ nhớ ngữ cảnh RAG.\n\nBạn có thể chọn một trong các câu hỏi gợi ý nhanh bên dưới hoặc đặt câu hỏi bất kỳ về phương pháp, số liệu và đóng góp của bài báo!`,
        },
      ]);
      setInput('');
      setIsStreaming(false);
    }
  }, [open, file?.id, paperTitle, chunkCount]);

  // Auto-scroll on new message / streaming tokens
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isStreaming]);

  const handleStop = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setIsStreaming(false);
    setMessages((prev) =>
      prev.map((m) => (m.isStreaming ? { ...m, isStreaming: false } : m)),
    );
  }, []);

  const handleClear = useCallback(() => {
    handleStop();
    setMessages([
      {
        id: 'welcome-reset',
        role: 'assistant',
        content: `Đã làm mới phiên hội thoại với bài báo **"${paperTitle}"**. Mời bạn đặt câu hỏi mới!`,
      },
    ]);
  }, [handleStop, paperTitle]);

  const handleCopy = async (id: string, text: string) => {
    await copyToClipboard(text);
    setCopiedId(id);
    toast.success('Đã sao chép nội dung');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSendMessage = async (customText?: string) => {
    const textToSend = (customText ?? input).trim();
    if (!textToSend || !file || isStreaming) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: textToSend,
    };

    const assistantId = `assistant-${Date.now()}`;
    const assistantPlaceholder: Message = {
      id: assistantId,
      role: 'assistant',
      content: '',
      isStreaming: true,
    };

    const updatedHistory = [...messages, userMessage];
    setMessages([...updatedHistory, assistantPlaceholder]);
    setInput('');
    setIsStreaming(true);

    const abortController = new AbortController();
    abortRef.current = abortController;

    try {
      // Backend handles both item and file transparently via /api/ai/rag/papers/:id/stream
      const historyForApi = updatedHistory.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

      const stream = streamPaperChat(
        file.id,
        [...historyForApi, { role: 'user', content: textToSend }],
        {
          signal: abortController.signal,
          chatId: `paper-${file.id}`,
        },
      );

      let accumulated = '';
      for await (const chunk of stream) {
        accumulated += chunk;
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantId ? { ...msg, content: accumulated } : msg,
          ),
        );
      }

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantId ? { ...msg, isStreaming: false } : msg,
        ),
      );
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        toast.error('Không thể kết nối đến Trợ lý AI: ' + (err.message || 'Lỗi mạng'));
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantId
              ? {
                  ...msg,
                  content:
                    '⚠️ *Không thể nhận phản hồi từ mô hình AI. Vui lòng kiểm tra lại dịch vụ hoặc thử lại.*',
                  isStreaming: false,
                }
              : msg,
          ),
        );
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[760px] h-[85vh] p-0 flex flex-col overflow-hidden border border-border shadow-raised-200">
        {/* Header */}
        <DialogHeader className="px-5 py-3.5 border-b border-border bg-card/60 shrink-0">
          <div className="flex items-center justify-between gap-3 pr-6">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
                <Sparkles className="size-4" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-sm font-semibold text-foreground truncate leading-tight">
                  {paperTitle}
                </DialogTitle>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1 font-mono text-[11px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">
                    <Layers className="size-3" />
                    {chunkCount} RAG chunks
                  </span>
                  <span>•</span>
                  <span>Trợ lý Phân tích Luận văn & Bài báo</span>
                </div>
              </div>
            </div>

            <button
              onClick={handleClear}
              title="Làm mới cuộc trò chuyện"
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              <RotateCcw className="size-4" />
            </button>
          </div>
        </DialogHeader>

        {/* Message Stream */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-5 py-4 space-y-4 bg-background"
        >
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 text-sm ${
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {msg.role === 'assistant' && (
                <div className="size-7 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5 border border-primary/20">
                  <Bot className="size-4" />
                </div>
              )}

              <div
                className={`group relative max-w-[85%] rounded-lg px-4 py-2.5 ${
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground font-normal'
                    : 'bg-muted/40 border border-border/80 text-foreground'
                }`}
              >
                {msg.role === 'user' ? (
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                ) : (
                  <div className="prose prose-sm dark:prose-invert max-w-none leading-relaxed">
                    {msg.content ? (
                      renderMarkdown(msg.content)
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-muted-foreground text-xs py-1">
                        <Loader2 className="size-3.5 animate-spin" />
                        Đang đọc và tổng hợp nội dung bài báo…
                      </span>
                    )}
                  </div>
                )}

                {msg.role === 'assistant' && msg.content && (
                  <button
                    onClick={() => handleCopy(msg.id, msg.content)}
                    className="absolute -right-8 top-2 p-1 rounded text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground hover:bg-muted transition-all"
                    title="Sao chép"
                  >
                    {copiedId === msg.id ? (
                      <Check className="size-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="size-3.5" />
                    )}
                  </button>
                )}
              </div>

              {msg.role === 'user' && (
                <div className="size-7 rounded-md bg-muted text-muted-foreground flex items-center justify-center shrink-0 mt-0.5 border border-border">
                  <UserIcon className="size-4" />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Quick Prompts */}
        {messages.length <= 2 && (
          <div className="px-5 py-2.5 bg-muted/20 border-t border-border/60">
            <p className="text-[11px] font-medium text-muted-foreground mb-2 flex items-center gap-1">
              <Sparkles className="size-3 text-primary" />
              Câu hỏi nghiên cứu nhanh:
            </p>
            <div className="grid grid-cols-2 gap-2">
              {QUICK_PROMPTS.map((qp) => (
                <button
                  key={qp.id}
                  onClick={() => handleSendMessage(qp.prompt)}
                  disabled={isStreaming}
                  className="flex items-center gap-1.5 p-2 rounded-md text-left text-xs bg-card hover:bg-muted border border-border/80 text-foreground transition-all cursor-pointer disabled:opacity-50"
                >
                  <BookOpen className="size-3 text-primary shrink-0" />
                  <span className="truncate font-medium">{qp.title}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input Footer */}
        <div className="p-4 border-t border-border bg-card/40 shrink-0">
          <div className="relative flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 focus-within:ring-1 focus-within:ring-primary">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Đặt câu hỏi về phương pháp, dữ liệu hoặc kết luận của bài báo… (Enter để gửi)"
              rows={1}
              className="flex-1 resize-none bg-transparent text-sm placeholder:text-muted-foreground/60 focus:outline-none max-h-32"
            />

            {isStreaming ? (
              <button
                type="button"
                onClick={handleStop}
                className="size-7 rounded-md bg-destructive text-destructive-foreground flex items-center justify-center shrink-0 hover:opacity-90 transition-opacity cursor-pointer"
                title="Dừng sinh phản hồi"
              >
                <Square className="size-3.5 fill-current" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleSendMessage()}
                disabled={!input.trim()}
                className="size-7 rounded-md bg-primary text-primary-foreground flex items-center justify-center shrink-0 disabled:opacity-40 hover:opacity-90 transition-opacity cursor-pointer"
                title="Gửi câu hỏi"
              >
                <ArrowUp className="size-4" />
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
