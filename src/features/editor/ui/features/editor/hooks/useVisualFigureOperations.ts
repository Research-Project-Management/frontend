'use client';

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useDocumentEditorStore } from '../../../../store/editor.store';

export interface ActiveFigureState {
  element: HTMLElement;
  src: string;
  width: string;
  caption: string;
  label: string;
  isCentering: boolean;
  isStarred: boolean;
  position: { top: number; left: number };
}

interface UseVisualFigureOperationsOptions {
  contentRef: React.RefObject<HTMLDivElement | null>;
  syncHtmlToLatex: () => void;
}

export function useVisualFigureOperations({
  contentRef,
  syncHtmlToLatex,
}: UseVisualFigureOperationsOptions) {
  const [activeFigure, setActiveFigure] = useState<ActiveFigureState | null>(null);
  const fileHierarchy = useDocumentEditorStore((s) => s.fileHierarchy);

  const projectImageFiles = useMemo(() => {
    const images: string[] = [];
    if (!fileHierarchy || !Array.isArray(fileHierarchy)) return images;

    const traverse = (nodes: any[], currentPath = '') => {
      for (const node of nodes) {
        const name = node.title || (node as any).name || '';
        const nodePath = currentPath ? `${currentPath}/${name}` : name;
        if (node.children?.length) {
          traverse(node.children, nodePath);
        } else {
          const ext = name.split('.').pop()?.toLowerCase() || '';
          if (['png', 'jpg', 'jpeg', 'pdf', 'svg', 'eps', 'webp'].includes(ext)) {
            images.push(nodePath);
          }
        }
      }
    };
    traverse(fileHierarchy);
    return images;
  }, [fileHierarchy]);

  const handleFigureClick = useCallback((figureEl: HTMLElement) => {
    const rawSrc = figureEl.getAttribute('data-src') || '';
    const src = rawSrc ? decodeURIComponent(rawSrc) : '';

    const rawWidth = figureEl.getAttribute('data-width') || '0.8\\linewidth';
    const width = rawWidth ? decodeURIComponent(rawWidth) : '0.8\\linewidth';

    const rawCap = figureEl.getAttribute('data-caption') || '';
    const caption = rawCap ? decodeURIComponent(rawCap) : '';

    const rawLab = figureEl.getAttribute('data-label') || '';
    const label = rawLab ? decodeURIComponent(rawLab) : '';

    const isCentering = figureEl.getAttribute('data-centering') !== 'false';
    const isStarred = figureEl.getAttribute('data-starred') === 'true';

    const figRect = figureEl.getBoundingClientRect();
    const top = Math.max(60, figRect.top - 46);
    const left = Math.max(20, Math.min(window.innerWidth - 450, figRect.left));

    setActiveFigure({
      element: figureEl,
      src,
      width,
      caption,
      label,
      isCentering,
      isStarred,
      position: { top, left },
    });
  }, []);

  const handleChangeFigureWidth = useCallback(
    (newWidth: string) => {
      if (!activeFigure || !contentRef.current) return;
      activeFigure.element.setAttribute('data-width', encodeURIComponent(newWidth));

      // Update badge
      const badge = activeFigure.element.querySelector('.latex-figure-badge span.font-mono');
      if (badge) badge.textContent = newWidth;

      // Update img css width
      const img = activeFigure.element.querySelector('img') as HTMLImageElement | null;
      if (img) {
        let cssWidth = '80%';
        if (newWidth.includes('\\textwidth') || newWidth.includes('\\linewidth')) {
          const numMatch = newWidth.match(/([0-9.]+)/);
          if (numMatch) {
            const pct = Math.round(parseFloat(numMatch[1]) * 100);
            cssWidth = `${Math.min(100, Math.max(10, pct))}%`;
          } else {
            cssWidth = '100%';
          }
        } else if (newWidth.includes('%')) {
          cssWidth = newWidth;
        }
        img.style.width = cssWidth;
      }

      setActiveFigure((prev) => (prev ? { ...prev, width: newWidth } : null));
      syncHtmlToLatex();
    },
    [activeFigure, contentRef, syncHtmlToLatex]
  );

  const handleChangeFigureImage = useCallback(
    (newSrc: string) => {
      if (!activeFigure || !contentRef.current) return;
      activeFigure.element.setAttribute('data-src', encodeURIComponent(newSrc));

      const filename = newSrc.split('/').pop() || newSrc;
      const titleSpan = activeFigure.element.querySelector('.latex-figure-badge span.opacity-75');
      if (titleSpan) titleSpan.textContent = filename;

      const img = activeFigure.element.querySelector('img') as HTMLImageElement | null;
      if (img) {
        img.src = newSrc;
        img.alt = activeFigure.caption || filename;
      }

      setActiveFigure((prev) => (prev ? { ...prev, src: newSrc } : null));
      syncHtmlToLatex();
    },
    [activeFigure, contentRef, syncHtmlToLatex]
  );

  const handleUpdateFigureMetadata = useCallback(
    (newCaption: string, newLabel: string) => {
      if (!activeFigure || !contentRef.current) return;
      activeFigure.element.setAttribute('data-caption', encodeURIComponent(newCaption));
      activeFigure.element.setAttribute('data-label', encodeURIComponent(newLabel));

      // Update caption text
      const capText = activeFigure.element.querySelector('.latex-figure-caption-text');
      if (capText) capText.textContent = newCaption || 'No caption';

      // Update label badge in header
      const headerDiv = activeFigure.element.querySelector('.latex-figure-badge > div.flex');
      if (headerDiv) {
        let labelSpan = headerDiv.querySelector('span.text-primary.font-mono');
        if (newLabel) {
          if (!labelSpan) {
            labelSpan = document.createElement('span');
            labelSpan.className =
              'text-[11px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-mono';
            headerDiv.appendChild(labelSpan);
          }
          labelSpan.textContent = newLabel;
        } else if (labelSpan) {
          labelSpan.remove();
        }
      }

      setActiveFigure((prev) => (prev ? { ...prev, caption: newCaption, label: newLabel } : null));
      syncHtmlToLatex();
    },
    [activeFigure, contentRef, syncHtmlToLatex]
  );

  const handleToggleFigureCentering = useCallback(() => {
    if (!activeFigure || !contentRef.current) return;
    const nextCentering = !activeFigure.isCentering;
    activeFigure.element.setAttribute('data-centering', nextCentering ? 'true' : 'false');
    setActiveFigure((prev) => (prev ? { ...prev, isCentering: nextCentering } : null));
    syncHtmlToLatex();
  }, [activeFigure, contentRef, syncHtmlToLatex]);

  const handleToggleFigureStarred = useCallback(() => {
    if (!activeFigure || !contentRef.current) return;
    const nextStarred = !activeFigure.isStarred;
    activeFigure.element.setAttribute('data-starred', nextStarred ? 'true' : 'false');
    setActiveFigure((prev) => (prev ? { ...prev, isStarred: nextStarred } : null));
    syncHtmlToLatex();
  }, [activeFigure, contentRef, syncHtmlToLatex]);

  const handleDeleteFigure = useCallback(() => {
    if (!activeFigure || !contentRef.current) return;
    activeFigure.element.remove();
    setActiveFigure(null);
    syncHtmlToLatex();
  }, [activeFigure, contentRef, syncHtmlToLatex]);

  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        activeFigure &&
        !target.closest('figure.latex-figure-wrapper') &&
        !target.closest('[role="toolbar"]')
      ) {
        setActiveFigure(null);
      }
    };

    window.addEventListener('mousedown', handleGlobalClick);
    return () => {
      window.removeEventListener('mousedown', handleGlobalClick);
    };
  }, [activeFigure]);

  return {
    activeFigure,
    setActiveFigure,
    projectImageFiles,
    handleFigureClick,
    handleChangeFigureWidth,
    handleChangeFigureImage,
    handleUpdateFigureMetadata,
    handleToggleFigureCentering,
    handleToggleFigureStarred,
    handleDeleteFigure,
  };
}
