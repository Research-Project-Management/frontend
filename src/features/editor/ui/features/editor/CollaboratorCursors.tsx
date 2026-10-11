/**
 * CollaboratorCursors.tsx
 *
 * Real-time Collaborator Presence & Cursor Styles with Overleaf Parity (Block 6: UI Features Layer).
 * Location: `features/editor/ui/features/editor/CollaboratorCursors.tsx`
 *
 * Features:
 * - Color-coded collaborator carets with smooth movement transitions.
 * - 3-second typing inactivity auto-fade for collaborator name tags.
 * - Hover reappearance on cursor caret.
 * - Soft translucent selection ranges matching collaborator palette.
 */

'use client';

import React, { useMemo } from 'react';
import type { Awareness } from 'y-protocols/awareness';

export interface CollaboratorInfo {
  id: string;
  name: string;
  color: string;
  avatar?: string;
  isOnline: boolean;
}

export const COLLABORATOR_PALETTE = [
  '#2563EB', // Blue
  '#7C3AED', // Violet
  '#DB2777', // Pink
  '#EA580C', // Orange
  '#059669', // Emerald
  '#0284C7', // Sky
  '#D97706', // Amber
  '#DC2626', // Red
];

export function getCollaboratorColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash << 5) - hash + userId.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % COLLABORATOR_PALETTE.length;
  return COLLABORATOR_PALETTE[index];
}

export function buildCollaboratorCursorCss(): string {
  return `
    @keyframes cm-ycaret-in {
      from {
        opacity: 0;
        transform: translateY(3px) scale(0.96);
      }
      to {
        opacity: 0.95;
        transform: translateY(0) scale(1);
      }
    }

    @keyframes cm-ycaret-inactivity-fade {
      0%, 75% {
        opacity: 0.95;
        transform: translateY(0);
      }
      100% {
        opacity: 0;
        transform: translateY(2px);
        pointer-events: none;
      }
    }

    .cm-ySelection {
      opacity: 0.25;
      border-radius: 2px;
      transition: background-color 0.15s ease-out;
    }

    .cm-ySelectionCaret {
      position: relative;
      border-left: 2px solid;
      margin-left: -1px;
      margin-right: -1px;
      transition: border-color 0.15s ease-out, transform 0.1s cubic-bezier(0.2, 0, 0, 1);
    }

    .cm-ySelectionCaretDot {
      position: absolute;
      top: -4px;
      left: -4px;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      box-shadow: 0 0 0 1.5px rgba(255, 255, 255, 0.9);
    }

    .cm-ySelectionCaretInfo {
      position: absolute;
      top: -18px;
      left: -2px;
      font-size: 10px;
      font-family: inherit;
      font-weight: 500;
      line-height: 1;
      padding: 2px 4px;
      border-radius: 3px;
      color: #ffffff;
      white-space: nowrap;
      user-select: none;
      pointer-events: none;
      opacity: 0.95;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
      animation: cm-ycaret-in 0.2s cubic-bezier(0.16, 1, 0.3, 1), cm-ycaret-inactivity-fade 3.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      transition: opacity 0.2s ease-in-out, transform 0.15s ease-in-out;
      z-index: 10;
    }

    .cm-ySelectionCaret:hover .cm-ySelectionCaretInfo {
      opacity: 1 !important;
      transform: translateY(0) !important;
      pointer-events: auto !important;
      animation: none !important;
    }
  `;
}

export interface CollaboratorCursorsProps {
  awareness?: Awareness | null;
  collaborators?: CollaboratorInfo[];
  className?: string;
}

export function CollaboratorCursors({
  collaborators = [],
  className,
}: CollaboratorCursorsProps) {
  const dynamicCss = useMemo(() => buildCollaboratorCursorCss(), []);

  return (
    <div className={className}>
      <style dangerouslySetInnerHTML={{ __html: dynamicCss }} />
      {collaborators.length > 0 && (
        <div className="flex items-center -space-x-1.5 overflow-hidden p-1">
          {collaborators.map((c) => (
            <div
              key={c.id}
              title={`${c.name} (${c.isOnline ? 'Online' : 'Idle'})`}
              style={{ borderColor: c.color }}
              className="size-5 rounded-full border flex items-center justify-center text-[9px] font-semibold text-background bg-foreground shrink-0"
            >
              {c.avatar ? (
                <img src={c.avatar} alt={c.name} className="size-full rounded-full object-cover" />
              ) : (
                c.name.slice(0, 1).toUpperCase()
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default CollaboratorCursors;
