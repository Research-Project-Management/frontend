'use client';

import { useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Plus, ArrowRight, Loader2 } from 'lucide-react';
import { useSticky } from "../hooks/use-sticky";
import { type Sticky, STICKY_COLOR_MAP, STICKY_COLOR_CYCLE } from '../types/sticky.types';
import { stripHtml, isStickyEmpty } from '../utils/sticky.utils';

function MiniCard({
  note,
  workspaceUrl,
}: {
  note: Sticky;
  workspaceUrl: string;
}) {
  const colorConfig = STICKY_COLOR_MAP[note.color] || { bg: '#fef08a', text: '#713f12' };
  const accentStyle = {
    backgroundColor: colorConfig.bg,
    filter: 'brightness(0.85)',
  };
  const plainContent = useMemo(
    () => stripHtml(note.content || ''),
    [note.content]
  );

  return (
    <Link
      href={`/${workspaceUrl}/stickies`}
      className='group relative flex flex-col rounded-lg border border-border overflow-hidden hover:-translate-y-0.5 transition-transform duration-200'
      style={{ backgroundColor: colorConfig.bg, color: colorConfig.text }}
    >
      <div className='h-1.5 w-full shrink-0' style={accentStyle} />
      <div className='flex flex-col gap-1 px-3 py-2.5'>
        {note.title ? (
          <p className='text-sm font-semibold leading-snug truncate'>
            {note.title}
          </p>
        ) : null}
        <p className='text-xs leading-relaxed line-clamp-4 opacity-70'>
          {plainContent || (
            <span className='italic opacity-50'>Empty note</span>
          )}
        </p>
      </div>


    </Link>
  );
}

function AddCard({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className='flex flex-col items-center justify-center gap-1.5 p-3 rounded-md border border-dashed border-border hover:bg-muted transition-colors cursor-pointer disabled:opacity-50 min-h-[90px]'
    >
      {disabled ? (
        <Loader2 className='size-4 animate-spin text-muted-foreground shrink-0' />
      ) : (
        <>
          <Plus className='size-4 text-muted-foreground shrink-0' />
          <span className='text-xs font-medium text-muted-foreground'>Add note</span>
        </>
      )}
    </button>
  );
}

export function StickiesWidget() {
  const { workspaceId } = useParams() as { workspaceId: string };
  const api = useSticky(workspaceId || '', undefined, undefined, { enabled: !!workspaceId });
  const notes = useMemo(() => api.query.data || [], [api.query.data]);
  const isLoading = api.query.isLoading;

  const createStickyMutate = api.mutations.create.mutate;
  const isCreatePending = api.mutations.create.isPending;

  const handleAdd = useCallback(() => {
    if (!workspaceId || isCreatePending) return;
    if (notes.some(isStickyEmpty)) return;

    const lastColor = notes[0]?.color;
    const idx = STICKY_COLOR_CYCLE.indexOf(lastColor || '');
    const color = STICKY_COLOR_CYCLE[idx === -1 ? 0 : (idx + 1) % STICKY_COLOR_CYCLE.length];
    createStickyMutate({
      workspaceId,
      content: '<p></p>',
      color,
      title: '',
      position: { x: 0, y: 0 },
    });
  }, [workspaceId, notes, createStickyMutate, isCreatePending]);

  const preview = useMemo(() => Array.isArray(notes) ? notes.slice(0, 5) : [], [notes]);

  const viewAllAction = notes.length > 0 && (
    <Link
      href={`/${workspaceId}/stickies`}
      className='flex items-center gap-1 text-xs text-foreground transition-colors'
    >
      View all
      <ArrowRight className='size-3 shrink-0' />
    </Link>
  );

  return (
    <>
      {isLoading ? (
        <div className='flex items-center gap-2 py-4 text-sm text-muted-foreground'>
          <Loader2 className='size-4 animate-spin shrink-0' />
          Loading...
        </div>
      ) : (
        <div className='flex flex-col gap-2'>
          {viewAllAction && (
            <div className='flex justify-end mb-1'>{viewAllAction}</div>
          )}
          <div className='grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2.5'>
            {preview.map((note: any) => (
              <MiniCard
                workspaceUrl={workspaceId || ''}
                key={note.id}
                note={note}
              />
            ))}
            <AddCard onClick={handleAdd} disabled={api.mutations.create.isPending} />
          </div>
        </div>
      )}
    </>
  );
}
