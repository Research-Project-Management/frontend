'use client';

import React from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/shared/lib/utils';
import type { MenuAction } from '../hooks/use-editor-shortcuts';

export interface EditorContextMenuProps {
  ctxMenu: { x: number; y: number } | null;
  ctxPos: { x: number; y: number } | null;
  ctxMenuRef: React.RefObject<HTMLDivElement | null>;
  menuGroups: MenuAction[][];
}

export function EditorContextMenu({
  ctxMenu,
  ctxPos,
  ctxMenuRef,
  menuGroups,
}: EditorContextMenuProps) {
  if (!ctxMenu || typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={ctxMenuRef}
      role="menu"
      aria-label="Editor context menu"
      className="fixed z-[9999] w-52 rounded-md border border-border bg-popover py-1 overflow-hidden shadow-raised-200"
      style={{
        left: ctxPos?.x ?? ctxMenu.x,
        top: ctxPos?.y ?? ctxMenu.y,
        visibility: ctxPos ? 'visible' : 'hidden',
      }}
    >
      {menuGroups.map((group, gi) => (
        <React.Fragment key={gi}>
          {gi > 0 && <div className="my-1 mx-2 h-px bg-border" role="separator" />}
          {group.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                role="menuitem"
                disabled={item.disabled}
                onClick={item.action}
                className={cn(
                  'group w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs cursor-pointer',
                  'hover:bg-muted text-foreground transition-colors outline-none focus-visible:bg-muted',
                  'disabled:opacity-40 disabled:cursor-not-allowed',
                )}
              >
                {Icon ? (
                  <Icon className="size-3.5 shrink-0 text-muted-foreground group-hover:text-foreground" />
                ) : (
                  <span className="size-3.5 shrink-0" />
                )}
                <span className="flex-1 text-left">{item.label}</span>
                {item.kbd && (
                  <kbd className="text-xs text-muted-foreground font-mono tracking-tight">
                    {item.kbd}
                  </kbd>
                )}
              </button>
            );
          })}
        </React.Fragment>
      ))}
    </div>,
    document.body,
  );
}
