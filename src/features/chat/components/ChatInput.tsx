'use client';

import React, { useState, useRef, useEffect, KeyboardEvent, DragEvent, ClipboardEvent } from 'react';
import { Send, Paperclip, Smile, X, FileText, ImageIcon, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { useChatStore } from '../store/chat.store';
import { ChatMessage, ChatAttachment } from '../types/chat.types';
import { chatService, CHAT_UPLOAD_LIMITS } from '../services/chat.service';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/shared/components/ui/popover';
import { cn, formatBytes } from '@/shared/lib/utils';

interface ChatInputProps {
  conversationId?: string | null;
  onSendMessage: (
    content: string,
    replyTo?: ChatMessage | null,
    attachments?: ChatAttachment[],
  ) => void;
  onTyping: (isTyping: boolean) => void;
  isSending?: boolean;
}

interface PendingAttachment {
  id: string;
  file: File;
  previewUrl?: string;
  progress: number;
  status: 'uploading' | 'ready' | 'error';
  attachment?: ChatAttachment;
  error?: string;
}

const COMMON_EMOJIS = ['👍', '❤️', '😂', '🎉', '🔥', '💡', '🚀', '👀', '✨', '👏'];

export function ChatInput({
  conversationId,
  onSendMessage,
  onTyping,
  isSending,
}: ChatInputProps) {
  const [content, setContent] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const { replyingToMessage, setReplyingToMessage } = useChatStore();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const typingDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const pendingAttachmentsRef = useRef<PendingAttachment[]>(pendingAttachments);
  pendingAttachmentsRef.current = pendingAttachments;

  // Auto-focus textarea when replying to a message
  useEffect(() => {
    if (replyingToMessage) {
      textareaRef.current?.focus();
    }
  }, [replyingToMessage]);

  // Auto-resize textarea height
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
    }
  }, [content]);

  // Cleanup typing timeout and object URLs on unmount
  useEffect(() => {
    return () => {
      if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
      pendingAttachmentsRef.current.forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
    };
  }, []);

  const handleProcessFiles = async (files: File[]) => {
    if (!files.length) return;
    if (!conversationId) {
      setErrorMessage('Please select an active conversation first');
      return;
    }

    setErrorMessage(null);

    for (const file of files) {
      const isImg =
        file.type.startsWith('image/') ||
        /\.(png|jpe?g|gif|webp|svg|bmp|ico)$/i.test(file.name);

      // 1. Client-side File Size Limit Validation
      if (isImg && file.size > CHAT_UPLOAD_LIMITS.MAX_IMAGE_BYTES) {
        setErrorMessage(
          `Ảnh "${file.name}" (${formatBytes(file.size)}) vượt quá giới hạn tối đa 20MB.`,
        );
        continue;
      }
      if (!isImg && file.size > CHAT_UPLOAD_LIMITS.MAX_FILE_BYTES) {
        setErrorMessage(
          `Tệp "${file.name}" (${formatBytes(file.size)}) vượt quá giới hạn tối đa 50MB.`,
        );
        continue;
      }

      const tempId = `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const previewUrl = isImg ? URL.createObjectURL(file) : undefined;

      const newPending: PendingAttachment = {
        id: tempId,
        file,
        previewUrl,
        progress: 0,
        status: 'uploading',
      };

      setPendingAttachments((prev) => [...prev, newPending]);

      // 2. Direct-to-R2 upload via presigned URL with progress
      try {
        const uploaded = await chatService.uploadChatFile(
          conversationId,
          file,
          (pct) => {
            setPendingAttachments((prev) =>
              prev.map((item) =>
                item.id === tempId ? { ...item, progress: pct } : item,
              ),
            );
          },
        );

        setPendingAttachments((prev) =>
          prev.map((item) =>
            item.id === tempId
              ? {
                  ...item,
                  status: 'ready',
                  progress: 100,
                  attachment: uploaded,
                }
              : item,
          ),
        );
      } catch (err: unknown) {
        const msg = (err as Error)?.message || 'Upload failed';
        setPendingAttachments((prev) =>
          prev.map((item) =>
            item.id === tempId
              ? { ...item, status: 'error', error: msg }
              : item,
          ),
        );
      }
    }
  };

  const handleRemoveAttachment = (id: string) => {
    setPendingAttachments((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((item) => item.id !== id);
    });
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setContent(val);

    if (val.trim().length > 0) {
      onTyping(true);
      if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
      typingDebounceRef.current = setTimeout(() => {
        onTyping(false);
      }, 1500);
    } else {
      if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
      onTyping(false);
    }
  };

  const handleBlur = () => {
    if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
    onTyping(false);
  };

  // Clipboard Paste (supports screenshot paste via Ctrl+V)
  const handlePaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const items = Array.from(e.clipboardData?.items || []);
    const files = items
      .map((item) => (item.kind === 'file' ? item.getAsFile() : null))
      .filter(Boolean) as File[];

    if (files.length > 0) {
      e.preventDefault();
      handleProcessFiles(files);
    }
  };

  // Drag & Drop
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer?.files || []);
    handleProcessFiles(files);
  };

  const isAnyUploading = pendingAttachments.some(
    (item) => item.status === 'uploading',
  );

  const handleSubmit = () => {
    const trimmed = content.trim();
    const readyAttachments = pendingAttachments
      .filter((item) => item.status === 'ready' && item.attachment)
      .map((item) => item.attachment!);

    // Require either text or ready attachments
    if ((!trimmed && readyAttachments.length === 0) || isAnyUploading || isSending) {
      return;
    }

    if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
    onTyping(false);

    onSendMessage(trimmed, replyingToMessage, readyAttachments);
    pendingAttachments.forEach((item) => {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    });
    setContent('');
    setPendingAttachments([]);
    setErrorMessage(null);
    setReplyingToMessage(null);

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleAddEmoji = (emoji: string) => {
    setContent((prev) => prev + emoji);
    textareaRef.current?.focus();
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        'bg-background p-3 space-y-2 transition-colors relative',
        isDragging && 'bg-primary/5 ring-2 ring-primary/30 rounded-lg',
      )}
    >
      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) handleProcessFiles(Array.from(e.target.files));
          e.target.value = '';
        }}
      />
      <input
        ref={imageInputRef}
        type="file"
        multiple
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          if (e.target.files) handleProcessFiles(Array.from(e.target.files));
          e.target.value = '';
        }}
      />

      {/* Replying Banner */}
      {replyingToMessage && (
        <div className="flex items-center justify-between px-2.5 py-1 rounded-md bg-muted text-11 border border-border">
          <div className="flex items-center gap-2 truncate">
            <span className="text-muted-foreground">Replying to</span>
            <span className="font-medium text-foreground">
              {replyingToMessage.sender?.name || 'User'}:
            </span>
            <span className="text-muted-foreground truncate max-w-xs">
              {replyingToMessage.content}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground shrink-0"
            onClick={() => setReplyingToMessage(null)}
          >
            <X className="size-3" />
          </Button>
        </div>
      )}

      {/* Error Banner */}
      {errorMessage && (
        <div className="flex items-center justify-between px-2.5 py-1.5 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-12">
          <div className="flex items-center gap-1.5 truncate">
            <AlertCircle className="size-3.5 shrink-0" />
            <span className="truncate">{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-destructive/80 hover:text-destructive text-11 ml-2 underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Pending Attachments Preview Tray */}
      {pendingAttachments.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1 pb-1">
          {pendingAttachments.map((item) => (
            <div
              key={item.id}
              className={cn(
                'relative flex items-center gap-2 px-2.5 py-1.5 rounded-md border text-12 bg-muted/60 transition-all max-w-xs overflow-hidden',
                item.status === 'error'
                  ? 'border-destructive/40 text-destructive'
                  : 'border-border text-foreground',
              )}
            >
              {item.previewUrl ? (
                <div className="size-8 rounded overflow-hidden shrink-0 bg-background border border-border">
                  <img
                    src={item.previewUrl}
                    alt={item.file.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <FileText className="size-5 text-muted-foreground shrink-0" />
              )}

              <div className="flex flex-col min-w-0 pr-5">
                <span className="truncate font-medium text-12">
                  {item.file.name}
                </span>
                <span className="text-10 text-muted-foreground font-mono">
                  {formatBytes(item.file.size)}
                  {item.status === 'uploading' && ` · ${item.progress}%`}
                  {item.status === 'error' && ' · Failed'}
                </span>
              </div>

              {/* Uploading progress bar */}
              {item.status === 'uploading' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-muted">
                  <div
                    className="h-full bg-primary transition-all duration-150"
                    style={{ width: `${item.progress}%` }}
                  />
                </div>
              )}

              {/* Remove button */}
              <button
                type="button"
                onClick={() => handleRemoveAttachment(item.id)}
                className="absolute top-1.5 right-1.5 size-4 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors cursor-pointer"
                title="Remove attachment"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input Row */}
      <div className="flex items-end gap-1.5 bg-background border border-border rounded-md p-1.5 focus-within:ring-1 focus-within:ring-ring shadow-2xs transition-colors">
        {/* Attachment Options */}
        <div className="flex items-center gap-0.5 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            className="size-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted shrink-0"
            title="Attach file (max 50MB)"
          >
            <Paperclip className="size-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => imageInputRef.current?.click()}
            className="size-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted shrink-0"
            title="Attach image (max 20MB)"
          >
            <ImageIcon className="size-4" />
          </Button>

          {/* Emoji Popover */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted shrink-0"
                title="Add emoji"
              >
                <Smile className="size-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2 grid grid-cols-5 gap-1 bg-background border border-border shadow-raised-200 rounded-md">
              {COMMON_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => handleAddEmoji(emoji)}
                  className="size-7 flex items-center justify-center text-sm rounded hover:bg-muted transition-colors cursor-pointer"
                >
                  {emoji}
                </button>
              ))}
            </PopoverContent>
          </Popover>
        </div>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          rows={1}
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          onPaste={handlePaste}
          placeholder={
            isDragging
              ? 'Drop files here to upload...'
              : 'Type a message or paste images...'
          }
          className="flex-1 max-h-32 min-h-6 bg-transparent text-13 text-foreground placeholder:text-muted-foreground resize-none focus:outline-none py-1 px-1 leading-normal"
        />

        <span className="text-11 font-mono text-muted-foreground/60 hidden md:inline select-none self-center pb-0.5">
          <kbd className="px-1 py-0.5 rounded bg-muted border border-border text-11 text-muted-foreground font-mono">
            ↵
          </kbd>
        </span>

        {/* Send Button */}
        <Button
          size="icon"
          disabled={
            (!content.trim() &&
              pendingAttachments.filter((i) => i.status === 'ready').length ===
                0) ||
            isAnyUploading ||
            isSending
          }
          onClick={handleSubmit}
          className="size-7 rounded-md bg-primary text-primary-foreground hover:bg-primary-hover shrink-0 shadow-none transition-transform active:scale-95 disabled:opacity-50"
          title="Send message (Enter)"
        >
          {isAnyUploading || isSending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Send className="size-3.5" />
          )}
        </Button>
      </div>
    </div>
  );
}
