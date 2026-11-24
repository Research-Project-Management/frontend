'use client';

import { useState, useRef, useEffect } from 'react';
import { Underline } from 'lucide-react';
import type { AnnotationRect, ReaderDocument, ReaderAnnotation } from '@/features/library/types/reader.types';
import type { SelectionPageSegment } from '@/features/library/domain/reader/annotation-geometry';
import { cn } from '@/shared/lib/utils';
import type { ReaderAnnotationTool } from '@/features/library/core/store/reader.store';
import {
  ANNOTATION_PALETTE_COLORS,
  DEFAULT_ANNOTATION_COLOR,
} from '@/features/library/domain/reader/reader';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/shared/components/ui/tooltip';

export interface TextSelectionToolbarProps {
  selectedText: string;
  selectedPageNum: number;
  selectedRects: AnnotationRect[];
  selectedPageSegments?: SelectionPageSegment[];
  menuPosition: { top: number; left: number };
  activeColor?: string;
  activeTool?: ReaderAnnotationTool;
  paper?: ReaderDocument;
  visiblePage: number;
  onAnnotate?: (
    selectedText: string,
    pageNumber: number,
    colorHex?: string,
    rects?: AnnotationRect[],
    type?: 'highlight' | 'underline' | 'note' | 'text' | 'rect' | 'area',
    comment?: string,
  ) => Promise<unknown> | void;
  onUpdateAnnotation?: (
    annotationId: string,
    expectedVersion: number | undefined,
    dto: { color?: string; comment?: string; tags?: string[]; rects?: AnnotationRect[] },
  ) => Promise<unknown>;
  onSelectColor?: (colorHex: string) => void;
  onSelectTool?: (tool: ReaderAnnotationTool) => void;
  onOpenAnnotationCard?: (createdAnn: ReaderAnnotation, el?: HTMLElement) => void;
  onAskAi?: (selectedText: string, pageNumber?: number) => void;
  onClose: () => void;
}

export function TextSelectionToolbar({
  selectedText,
  selectedPageNum,
  selectedRects,
  selectedPageSegments,
  menuPosition,
  activeColor,
  visiblePage,
  onAnnotate,
  onUpdateAnnotation,
  onSelectColor,
  onSelectTool,
  onAskAi,
  onClose,
}: TextSelectionToolbarProps) {
  const [activeTypeState, setActiveTypeState] = useState<'highlight' | 'underline' | null>(null);
  const createdAnnsRef = useRef<Array<{ id: string; version?: number }>>([]);

  useEffect(() => {
    createdAnnsRef.current = [];
    setActiveTypeState(null);
  }, [selectedText, menuPosition.top, menuPosition.left]);

  const commitTextAnnotation = async (
    colorHex: string,
    type: 'highlight' | 'underline',
  ) => {
    if (!onAnnotate) return;

    if (
      createdAnnsRef.current.length > 0 &&
      activeTypeState === type &&
      onUpdateAnnotation
    ) {
      for (const ann of createdAnnsRef.current) {
        const updated = await onUpdateAnnotation(ann.id, ann.version, {
          color: colorHex,
        });
        if (
          updated &&
          typeof updated === 'object' &&
          'version' in updated &&
          typeof (updated as { version?: unknown }).version === 'number'
        ) {
          ann.version = (updated as { version: number }).version;
        }
      }
      return;
    }

    const createdList: Array<{ id: string; version?: number }> = [];
    const recordCreated = (res: unknown) => {
      if (res && typeof res === 'object' && 'id' in res) {
        const rec = res as { id?: unknown; version?: unknown };
        if (typeof rec.id === 'string' && rec.id) {
          createdList.push({
            id: rec.id,
            version: typeof rec.version === 'number' ? rec.version : undefined,
          });
        }
      }
    };

    if (selectedPageSegments && selectedPageSegments.length > 1) {
      for (const seg of selectedPageSegments) {
        recordCreated(
          await onAnnotate(seg.text, seg.pageNum, colorHex, seg.rects, type),
        );
      }
    } else {
      const single = selectedPageSegments?.[0];
      recordCreated(
        await onAnnotate(
          single?.text ?? selectedText,
          single?.pageNum ?? selectedPageNum,
          colorHex,
          single?.rects ?? selectedRects,
          type,
        ),
      );
    }

    createdAnnsRef.current = createdList;
    setActiveTypeState(type);
    window.getSelection()?.removeAllRanges();
  };

  const effectiveColor = activeColor || DEFAULT_ANNOTATION_COLOR;

  return (
    <div
      className="pdf-floating-selection-menu absolute z-50 flex items-center gap-1 whitespace-nowrap w-max bg-popover text-popover-foreground p-1 rounded-lg border border-border shadow-raised-200 duration-150 select-none animate-in fade-in zoom-in-95 font-sans"
      style={{
        top: `${menuPosition.top}px`,
        left: `${menuPosition.left}px`,
        transform: 'translateX(-50%)',
      }}
      onMouseUp={(e) => e.stopPropagation()}
    >
      {/* 1. All 8 Academic Colors (Zotero 7 standard: 1-click Highlight) */}
      {onAnnotate && (
        <div className="flex items-center gap-1 px-0.5 shrink-0">
          {ANNOTATION_PALETTE_COLORS.map((c) => {
            const isSelected = activeColor === c.hex;
            return (
              <Tooltip key={c.id}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label={`Highlight in ${c.label}`}
                    onClick={async () => {
                      onSelectColor?.(c.hex);
                      await commitTextAnnotation(c.hex, activeTypeState ?? 'highlight');
                    }}
                    className={cn(
                      'size-3.5 rounded-full border border-border transition-transform cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring relative before:absolute before:-inset-1 md:before:hidden hover:scale-125',
                      isSelected && 'ring-2 ring-primary ring-offset-1 scale-110',
                    )}
                    style={{ backgroundColor: c.hex }}
                  />
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={6} className="text-11">
                  Highlight in {c.label}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      )}

      {/* 2. Underline (Zotero parity) */}
      {onAnnotate && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label="Underline selected text"
              onClick={async () => {
                onSelectTool?.('underline');
                await commitTextAnnotation(effectiveColor, 'underline');
              }}
              className={cn(
                'size-6 rounded-md flex items-center justify-center cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                activeTypeState === 'underline'
                  ? 'bg-primary/15 text-primary'
                  : 'text-foreground hover:bg-muted',
              )}
            >
              <Underline className="size-3.5" strokeWidth={1.5} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={6} className="text-11">
            Underline
          </TooltipContent>
        </Tooltip>
      )}

      {/* 3. Ask AI Action */}
      {onAskAi && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label="Ask AI about selected text"
              onClick={() => {
                onAskAi(selectedText, selectedPageNum || visiblePage);
                onClose();
                window.getSelection()?.removeAllRanges();
              }}
              className="size-6 rounded-md flex items-center justify-center cursor-pointer transition-colors text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <img
                src="/Chat.svg"
                alt="AI Assistant"
                className="size-3.5 rounded-full object-cover shrink-0"
              />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={6} className="text-11">
            Ask AI
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
