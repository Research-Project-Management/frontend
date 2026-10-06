'use client';

/**
 * EditorFloatingOverlay.tsx
 *
 * Dedicated overlay container for editor floating elements:
 * - Glyph Tooltip
 * - Inline Suggestion Widget (Overleaf 1:1)
 * - Selection Floating Action Bar
 * - Floating AI Assistant
 * - Context Menu Portal
 */

import React from 'react';
import { GlyphTooltip, type GlyphTooltipData } from '../../../components/editor/subcomponents/GlyphTooltip';
import {
  InlineSuggestionWidget,
  type InlineSuggestionWidgetData,
} from '../../../components/editor/subcomponents/InlineSuggestionWidget';
import {
  EditorFloatingBar,
  type SelFloating,
} from '../../../components/editor/subcomponents/EditorFloatingBar';
import { FloatingAiAssistant } from '../../../components/editor/subcomponents/FloatingAiAssistant';
import { EditorContextMenu } from '../../../components/editor/subcomponents/EditorContextMenu';
import type { MenuAction } from '../../../components/editor/hooks/use-editor-shortcuts';
import type { PageSuggestion } from '../../../types';
import type { SuggestModalState } from '../../../components/editor/subcomponents/SuggestEditModal';

export interface AiAssistState {
  isOpen: boolean;
  selectedText: string;
  startLine: number;
  endLine: number;
  position: { x: number; y: number };
}

export interface AiAssistOpenOptions {
  selectedText: string;
  startLine: number;
  endLine: number;
  position: { x: number; y: number };
}

export interface EditorFloatingOverlayProps {
  glyphTooltip: GlyphTooltipData | null;
  activeSuggestionWidgetData: InlineSuggestionWidgetData | null;
  isAcceptingSuggestion: boolean;
  isRejectingSuggestion: boolean;
  onAcceptSuggestion: (s: PageSuggestion) => void;
  onRejectSuggestion: (s: PageSuggestion) => void;
  onCloseSuggestionWidget: () => void;
  onOpenReviewTab: (suggestionId: string) => void;

  selFloating: SelFloating | null;
  selFloatingRef: React.RefObject<HTMLDivElement | null>;
  reviewMode: boolean;
  onCloseFloating: () => void;
  onOpenSuggestModal: (state: SuggestModalState) => void;

  aiAssistState: AiAssistState | null;
  onCloseAiAssist: () => void;
  onApplyAiEdit: (newText: string, mode: 'replace' | 'insert-below') => void;
  onOpenAiAssist: (opts: AiAssistOpenOptions) => void;

  ctxMenu: { x: number; y: number } | null;
  ctxPos: { x: number; y: number } | null;
  ctxMenuRef: React.RefObject<HTMLDivElement | null>;
  menuGroups: MenuAction[][];
}

export function EditorFloatingOverlay({
  glyphTooltip,
  activeSuggestionWidgetData,
  isAcceptingSuggestion,
  isRejectingSuggestion,
  onAcceptSuggestion,
  onRejectSuggestion,
  onCloseSuggestionWidget,
  onOpenReviewTab,
  selFloating,
  selFloatingRef,
  reviewMode,
  onCloseFloating,
  onOpenSuggestModal,
  aiAssistState,
  onCloseAiAssist,
  onApplyAiEdit,
  onOpenAiAssist,
  ctxMenu,
  ctxPos,
  ctxMenuRef,
  menuGroups,
}: EditorFloatingOverlayProps) {
  return (
    <>
      {/* Glyph comment tooltip */}
      <GlyphTooltip tooltip={glyphTooltip} />

      {/* Inline Suggestion Action Widget (Overleaf 1:1) */}
      <InlineSuggestionWidget
        data={activeSuggestionWidgetData}
        isAccepting={isAcceptingSuggestion}
        isRejecting={isRejectingSuggestion}
        onAccept={onAcceptSuggestion}
        onReject={onRejectSuggestion}
        onClose={onCloseSuggestionWidget}
        onOpenReviewTab={onOpenReviewTab}
      />

      {/* Selection floating action bar */}
      <EditorFloatingBar
        selFloating={selFloating}
        selFloatingRef={selFloatingRef}
        reviewMode={reviewMode}
        onClose={onCloseFloating}
        onOpenSuggest={onOpenSuggestModal}
        onOpenAiAssist={onOpenAiAssist}
      />

      {/* Floating AI Assistant */}
      {aiAssistState?.isOpen && (
        <FloatingAiAssistant
          isOpen={aiAssistState.isOpen}
          onClose={onCloseAiAssist}
          selectedText={aiAssistState.selectedText}
          startLine={aiAssistState.startLine}
          endLine={aiAssistState.endLine}
          position={aiAssistState.position}
          onApplyEdit={onApplyAiEdit}
        />
      )}

      {/* Custom context menu portal */}
      <EditorContextMenu
        ctxMenu={ctxMenu}
        ctxPos={ctxPos}
        ctxMenuRef={ctxMenuRef}
        menuGroups={menuGroups}
      />
    </>
  );
}
