/**
 * CollaboratorCursors.tsx
 *
 * Real-time Collaborator Presence & Cursor Styles (Block 6: UI Features Layer).
 * Location: `features/editor/ui/features/editor/CollaboratorCursors.tsx`
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

const COLLABORATOR_PALETTE = [
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

export interface CollaboratorCursorsProps {
  awareness?: Awareness | null;
  collaborators?: CollaboratorInfo[];
  className?: string;
}

export function CollaboratorCursors({
  collaborators = [],
  className,
}: CollaboratorCursorsProps) {
  const dynamicCss = useMemo(() => {
    return `
      .cm-ySelection {
        opacity: 0.25;
        border-radius: 2px;
      }
      .cm-ySelectionCaret {
        position: relative;
        border-left: 2px solid;
        margin-left: -1px;
        margin-right: -1px;
      }
      .cm-ySelectionCaretDot {
        position: absolute;
        top: -4px;
        left: -4px;
        width: 6px;
        height: 6px;
        border-radius: 50%;
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
        opacity: 0.9;
        transition: opacity 0.15s ease-in-out;
        z-index: 10;
      }
    `;
  }, []);

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
              className="size-5 rounded-full border flex items-center justify-center text-[9px] font-bold text-white bg-slate-800 shrink-0"
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
