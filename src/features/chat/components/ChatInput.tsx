'use client';

import React, { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { Send, Paperclip, Smile, X } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { useChatStore } from '../store/chat.store';
import { ChatMessage } from '../types/chat.types';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/shared/components/ui/popover';

interface ChatInputProps {
  onSendMessage: (content: string, replyTo?: ChatMessage | null) => void;
  onTyping: (isTyping: boolean) => void;
  isSending?: boolean;
}

const COMMON_EMOJIS = ['👍', '❤️', '😂', '🎉', '🔥', '💡', '🚀', '👀', '✨', '👏'];

export function ChatInput({ onSendMessage, onTyping, isSending }: ChatInputProps) {
  const [content, setContent] = useState('');
  const { replyingToMessage, setReplyingToMessage } = useChatStore();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingDebounceRef = useRef<NodeJS.Timeout | null>(null);

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

  // Cleanup typing timeout on unmount
  useEffect(() => {
    return () => {
      if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
    };
  }, []);

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

      // Auto-stop typing if user pauses for 1.5 seconds
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

  const handleSubmit = () => {
    const trimmed = content.trim();
    if (!trimmed || isSending) return;

    if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
    onTyping(false);

    onSendMessage(trimmed, replyingToMessage);
    setContent('');
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
    <div className="bg-background p-3 space-y-2">
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

      {/* Input Row (Strict White Surface, rounded-md, shadow-2xs per DESIGN.md Section 5.B) */}
      <div className="flex items-end gap-2 bg-background border border-border rounded-md p-1.5 focus-within:ring-1 focus-within:ring-ring shadow-2xs transition-colors">
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

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          rows={1}
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder="Type a message..."
          className="flex-1 max-h-32 min-h-6 bg-transparent text-13 text-foreground placeholder:text-muted-foreground resize-none focus:outline-none py-1 px-1 leading-normal"
        />

        <span className="text-11 font-mono text-muted-foreground/60 hidden md:inline select-none self-center pb-0.5">
          <kbd className="px-1 py-0.5 rounded bg-muted border border-border text-11 text-muted-foreground font-mono">↵</kbd>
        </span>

        {/* Send Button */}
        <Button
          size="icon"
          disabled={!content.trim() || isSending}
          onClick={handleSubmit}
          className="size-7 rounded-md bg-primary text-primary-foreground hover:bg-primary-hover shrink-0 shadow-none transition-transform active:scale-95 disabled:opacity-50"
          title="Send message (Enter)"
        >
          <Send className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
