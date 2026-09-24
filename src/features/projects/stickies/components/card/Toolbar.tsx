'use client';

import type { Sticky } from '@/features/projects/stickies/types/sticky.types';
import { Bold, Italic, ListTodo, Trash2 } from 'lucide-react';
import React from 'react';
import type { StickiesEditorHandle } from './Content';
import { ToolbarBtn } from '../ui/ToolbarBtn';
import ColorModal from '../modals/ColorModal';
import DeleteModal from '../modals/DeleteModal';

interface ToolbarProps {
  sticky: Sticky;
  onUpdate: (id: string, updates: Partial<Sticky>) => void;
  onDelete: (id: string) => void;
  editor: StickiesEditorHandle | null;
  activeModal: string | null;
  onActiveModalChange: (modal: any) => void;
}

export default function Toolbar({
  sticky,
  onUpdate,
  onDelete,
  editor,
  activeModal,
  onActiveModalChange,
}: ToolbarProps) {
  const isColorOpen = activeModal === 'color';
  const isDeleteOpen = activeModal === 'delete';

  return (
    <div className="h-10 px-4 flex items-center justify-between bg-transparent">
      <div className="relative flex items-center gap-1.5">
        <ColorModal
          sticky={sticky}
          onUpdate={onUpdate}
          isActive={isColorOpen}
          onActiveChange={(open) => onActiveModalChange(open ? 'color' : null)}
        />
        <ToolbarBtn
          title="Bold"
          onClick={() => editor?.toggleBold()}
          isActive={editor?.isBoldActive?.()}
          disabled={!editor}
        >
          <Bold size={14} className="shrink-0" />
        </ToolbarBtn>
        <ToolbarBtn
          title="Italic"
          onClick={() => editor?.toggleItalic()}
          isActive={editor?.isItalicActive?.()}
          disabled={!editor}
        >
          <Italic size={14} className="shrink-0" />
        </ToolbarBtn>
        <ToolbarBtn
          title="To-do list"
          onClick={() => editor?.toggleTodoList()}
          isActive={editor?.isTodoActive?.()}
          disabled={!editor}
        >
          <ListTodo size={14} className="shrink-0" />
        </ToolbarBtn>
      </div>

      <ToolbarBtn
        title="Delete"
        danger
        onClick={() => onActiveModalChange(isDeleteOpen ? null : 'delete')}
        isActive={isDeleteOpen}
      >
        <Trash2 className="shrink-0" size={14} />
      </ToolbarBtn>

      <DeleteModal
        open={isDeleteOpen}
        onCancel={() => onActiveModalChange(null)}
        onConfirm={() => {
          onActiveModalChange(null);
          onDelete(sticky.id || '');
        }}
      />
    </div>
  );
}
