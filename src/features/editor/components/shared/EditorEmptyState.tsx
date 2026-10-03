'use client';

import React from 'react';
import { cn } from '@/shared/lib/utils';
import {
  editorIllustrationStyles,
  EditorEmptyDocumentIllustration,
  ViewerEmptyPdfIllustration,
  ViewerDetachedIllustration,
  EditorReviewIllustration,
  EditorHistoryIllustration,
  EditorSearchIllustration,
} from './EditorIllustrations';

export type EditorEmptyVariant =
  | 'document'
  | 'preview'
  | 'detached'
  | 'review'
  | 'history'
  | 'search'
  | 'files'
  | 'citations';

export interface EditorEmptyAction {
  label: string;
  onClick?: () => void;
  icon?: React.ReactNode | React.ComponentType<{ className?: string }>;
}

export interface EditorEmptyStateProps {
  variant?: EditorEmptyVariant;
  title?: string;
  description?: string | React.ReactNode;
  action?: React.ReactNode | EditorEmptyAction;
  className?: string;
  isCompact?: boolean;
}

interface EmptyConfig {
  illustration: React.ComponentType<{ className?: string }>;
  title: string;
  description: string | React.ReactNode;
}

/**
 * EditorEmptyState
 * Pure Flat Precision / Plane.so & Flux standard empty state for the Overleaf/Manuscripts Editor.
 * Synchronized with Library & Storage design tokens, typography, and 3D isometric spatial illustrations.
 */
export function EditorEmptyState({
  variant = 'document',
  title: customTitle,
  description: customDescription,
  action,
  className,
  isCompact = false,
}: EditorEmptyStateProps) {
  const getDefaultConfig = (): EmptyConfig => {
    switch (variant) {
      case 'preview':
        return {
          illustration: ViewerEmptyPdfIllustration,
          title: 'No PDF preview',
          description: (
            <span>
              Click <strong className="font-semibold text-foreground">Recompile</strong> on the toolbar or press{' '}
              <kbd className="px-1.5 py-0.5 text-11 font-mono font-medium rounded border bg-muted border-border text-foreground">
                Ctrl+Enter
              </kbd>{' '}
              to build your document.
            </span>
          ),
        };
      case 'detached':
        return {
          illustration: ViewerDetachedIllustration,
          title: 'PDF viewer detached',
          description: 'Document preview is currently running in a separate window.',
        };
      case 'review':
        return {
          illustration: EditorReviewIllustration,
          title: 'No comments or suggestions',
          description: 'Comments, inline discussion threads, and suggested edits will appear here.',
        };
      case 'history':
        return {
          illustration: EditorHistoryIllustration,
          title: 'No revisions found',
          description: 'Milestones and compilation snapshots will automatically be checkpointed as you edit.',
        };
      case 'search':
        return {
          illustration: EditorSearchIllustration,
          title: 'No matching results',
          description: 'No text or symbols matching your search query were found across project files.',
        };
      case 'files':
        return {
          illustration: EditorEmptyDocumentIllustration,
          title: 'No files in project',
          description: 'Upload TeX manuscripts, bibliography files, or assets to start writing.',
        };
      case 'citations':
        return {
          illustration: EditorSearchIllustration,
          title: 'No citations found',
          description: 'Citations in your document and references from your workspace library appear here.',
        };
      case 'document':
      default:
        return {
          illustration: EditorEmptyDocumentIllustration,
          title: 'No file open',
          description: 'Select a document from the Files explorer or reopen the default manuscript to start writing.',
        };
    }
  };

  const config = getDefaultConfig();
  const IllustrationComponent = config.illustration;
  const title = customTitle || config.title;
  const description = customDescription !== undefined ? customDescription : config.description;

  return (
    <div
      className={cn(
        'flex-1 w-full h-full min-h-[440px] flex flex-col items-center justify-center p-8 text-center select-none animate-in fade-in-50 duration-200 bg-background transition-colors',
        isCompact && 'min-h-[260px] p-4',
        className
      )}
    >
      <style dangerouslySetInnerHTML={{ __html: editorIllustrationStyles }} />

      {/* 3D Isometric Multi-Layer Editor Illustration */}
      <div
        className={cn(
          'plane-editor-illustration mb-6 flex items-center justify-center',
          isCompact && 'mb-3 scale-75 origin-center'
        )}
      >
        <IllustrationComponent />
      </div>

      {/* Title */}
      <h2
        className={cn(
          'text-16 font-semibold text-foreground mb-2 tracking-tight',
          isCompact && 'text-14 mb-1'
        )}
      >
        {title}
      </h2>

      {/* Description */}
      <p
        className={cn(
          'text-13 text-foreground/80 dark:text-muted-foreground max-w-[420px] leading-relaxed font-normal',
          isCompact && 'text-12 max-w-[240px]'
        )}
      >
        {description}
      </p>

      {/* Optional action slot */}
      {action != null ? (
        <div className={cn('mt-4', isCompact && 'mt-3')}>
          {React.isValidElement(action) ? (
            action
          ) : typeof action === 'object' && 'label' in action ? (
            <button
              type="button"
              onClick={(action as EditorEmptyAction).onClick}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-12 font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer shadow-xs"
            >
              {(action as EditorEmptyAction).icon && (
                <span className="size-3.5 shrink-0 flex items-center justify-center">
                  {React.isValidElement((action as EditorEmptyAction).icon)
                    ? ((action as EditorEmptyAction).icon as React.ReactNode)
                    : React.createElement(
                        (action as EditorEmptyAction).icon as React.ComponentType<{ className?: string }>,
                        { className: 'size-3.5' }
                      )}
                </span>
              )}
              <span>{(action as EditorEmptyAction).label}</span>
            </button>
          ) : (
            (action as React.ReactNode)
          )}
        </div>
      ) : null}
    </div>
  );
}

export default EditorEmptyState;
