'use client';

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useImperativeHandle,
} from 'react';
import {
  type MentionMember,
  detectMentionQuery,
  filterMentionMembers,
  formatMention,
} from '@/features/editor/utils/mention.util';
import { cn } from '@/shared/lib/utils';
import { User, Users } from 'lucide-react';

export interface MentionTextareaRef {
  focus: () => void;
  insertMention: (member: MentionMember) => void;
}

export interface MentionTextareaProps {
  value: string;
  onChange: (value: string) => void;
  members: MentionMember[];
  placeholder?: string;
  rows?: number;
  singleLine?: boolean;
  disabled?: boolean;
  className?: string;
  autoFocus?: boolean;
  format?: 'rich' | 'plain';
  onSubmit?: () => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
}

function MemberAvatar({
  member,
  size = 5,
}: {
  member: MentionMember;
  size?: number;
}) {
  const sizePx = size * 4;
  const iconSizePx = Math.round(sizePx * 0.55);

  if (member.avatar) {
    return (
      <img
        src={member.avatar}
        alt={member.name}
        style={{ width: sizePx, height: sizePx }}
        className="rounded-full object-cover shrink-0"
        onError={(e) => {
          (e.currentTarget as HTMLElement).style.display = 'none';
        }}
      />
    );
  }

  return (
    <div
      style={{ width: sizePx, height: sizePx }}
      className="rounded-full bg-primary/10 flex items-center justify-center shrink-0"
    >
      <User style={{ width: iconSizePx, height: iconSizePx }} className="text-primary shrink-0" />
    </div>
  );
}

export const MentionTextarea = React.forwardRef<
  MentionTextareaRef,
  MentionTextareaProps
>(function MentionTextarea(
  {
    value,
    onChange,
    members,
    placeholder = 'Type @ to mention a collaborator...',
    rows = 3,
    singleLine = false,
    disabled = false,
    className,
    autoFocus = false,
    format = 'rich',
    onSubmit,
    onKeyDown: customKeyDown,
  },
  ref,
) {
  const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mentionRange, setMentionRange] = useState<{ start: number; end: number }>({
    start: 0,
    end: 0,
  });

  const filteredMembers = React.useMemo(
    () => filterMentionMembers(members, query),
    [members, query],
  );

  // Sync selectedIndex when filtered list changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredMembers.length, query]);

  // Expose focus and programmatic insertion via ref
  useImperativeHandle(ref, () => ({
    focus: () => {
      inputRef.current?.focus();
    },
    insertMention: (member: MentionMember) => {
      handleSelectMember(member);
    },
  }));

  // Check mention trigger on text or cursor movement
  const checkMentionTrigger = useCallback(
    (target: HTMLTextAreaElement | HTMLInputElement) => {
      const cursorPos = target.selectionStart ?? 0;
      const text = target.value;
      const detected = detectMentionQuery(text, cursorPos);

      if (detected.active) {
        setQuery(detected.query);
        setMentionRange({ start: detected.startIndex, end: detected.endIndex });
        setIsOpen(true);
      } else {
        setIsOpen(false);
      }
    },
    [],
  );

  const handleSelectMember = useCallback(
    (member: MentionMember) => {
      const currentVal = value;
      const { start, end } = mentionRange;

      const token = formatMention(member, format) + ' ';
      const before = currentVal.slice(0, start);
      const after = currentVal.slice(end);
      const nextVal = `${before}${token}${after}`;

      onChange(nextVal);
      setIsOpen(false);

      // Restore focus and position cursor right after the inserted mention
      const newCursorPos = start + token.length;
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
        }
      }, 10);
    },
    [value, mentionRange, format, onChange],
  );

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>,
  ) => {
    if (isOpen && filteredMembers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filteredMembers.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(
          (prev) => (prev - 1 + filteredMembers.length) % filteredMembers.length,
        );
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const chosen = filteredMembers[selectedIndex];
        if (chosen) {
          handleSelectMember(chosen);
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsOpen(false);
        return;
      }
    }

    // Default Enter key handling when popover is closed
    if (e.key === 'Enter' && !e.shiftKey) {
      if (singleLine || onSubmit) {
        if (onSubmit && !isOpen) {
          e.preventDefault();
          onSubmit();
          return;
        }
      }
    }

    customKeyDown?.(e);
  };

  // Close popover if clicked outside
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  return (
    <div className="relative w-full">
      {/* ── Autocomplete Popover Dropdown ── */}
      {isOpen && (
        <div
          ref={popoverRef}
          className="absolute z-50 bottom-full mb-1 left-0 w-full min-w-[240px] max-w-sm rounded-md border border-border bg-popover text-popover-foreground shadow-raised-200 overflow-hidden animate-in fade-in-50 zoom-in-95 duration-100"
          style={{ maxHeight: '220px' }}
        >
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 border-b border-border bg-background text-10 text-muted-foreground font-medium tracking-normal">
            <Users className="size-3" />
            <span>Mention collaborator</span>
          </div>

          <div className="overflow-y-auto max-h-[180px] p-1 space-y-0.5">
            {filteredMembers.length === 0 ? (
              <div className="px-3 py-2 text-center text-xs text-muted-foreground">
                No matching collaborators
              </div>
            ) : (
              filteredMembers.map((member, idx) => {
                const isSelected = idx === selectedIndex;
                return (
                  <button
                    key={member.id}
                    type="button"
                    onMouseDown={(e) => {
                      // Prevent input blur before click finishes
                      e.preventDefault();
                      handleSelectMember(member);
                    }}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs text-left cursor-pointer transition-colors select-none',
                      isSelected
                        ? 'bg-primary text-primary-foreground font-medium'
                        : 'text-foreground hover:bg-muted/80',
                    )}
                  >
                    <MemberAvatar member={member} size={5} />
                    <div className="flex flex-col min-w-0 flex-1 leading-tight">
                      <span className="truncate text-xs">{member.name}</span>
                      {member.email && (
                        <span
                          className={cn(
                            'truncate text-10',
                            isSelected
                              ? 'text-primary-foreground/80'
                              : 'text-muted-foreground',
                          )}
                        >
                          {member.email}
                        </span>
                      )}
                    </div>
                    {member.role && (
                      <span
                        className={cn(
                          'text-10 uppercase px-1 py-0.2 rounded-sm font-semibold shrink-0',
                          isSelected
                            ? 'bg-primary-foreground/20 text-primary-foreground'
                            : 'bg-muted text-muted-foreground',
                        )}
                      >
                        {member.role}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ── Input or Textarea ── */}
      {singleLine ? (
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type="text"
          value={value}
          disabled={disabled}
          autoFocus={autoFocus}
          placeholder={placeholder}
          onChange={(e) => {
            onChange(e.target.value);
            checkMentionTrigger(e.target);
          }}
          onClick={(e) => checkMentionTrigger(e.currentTarget)}
          onKeyUp={(e) => checkMentionTrigger(e.currentTarget)}
          onKeyDown={handleKeyDown}
          className={cn(
            'w-full rounded-md border border-input bg-background px-2.5 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 disabled:opacity-50',
            className,
          )}
        />
      ) : (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          value={value}
          rows={rows}
          disabled={disabled}
          autoFocus={autoFocus}
          placeholder={placeholder}
          onChange={(e) => {
            onChange(e.target.value);
            checkMentionTrigger(e.target);
          }}
          onClick={(e) => checkMentionTrigger(e.currentTarget)}
          onKeyUp={(e) => checkMentionTrigger(e.currentTarget)}
          onKeyDown={handleKeyDown}
          className={cn(
            'w-full resize-none rounded-md border border-input bg-background p-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 disabled:opacity-50 leading-relaxed',
            className,
          )}
        />
      )}
    </div>
  );
});
