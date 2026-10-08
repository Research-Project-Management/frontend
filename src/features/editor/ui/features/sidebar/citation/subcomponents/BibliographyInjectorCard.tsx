'use client';

import React, { useState, useCallback } from 'react';
import { BookOpen, Copy, Check, RefreshCw, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { copyToClipboard } from '@/shared/lib/utils';
import { libraryServices } from '@/features/library';
import type { Item } from '@/features/library';
import {
  isLatexDocument,
  detectDocumentCitationStyle,
  buildBibliographySection,
  injectBibliographyIntoDocument,
} from '@/features/editor/domain/citation/bibliography-generator';

export interface BibliographyInjectorCardProps {
  citedCount: number;
  citedItems: Item[];
  projectId?: string;
  engine?: any;
  getContent?: () => string;
  refreshContent?: () => void;
  activeFilePath?: string;
}

export const BibliographyInjectorCard = React.memo(function BibliographyInjectorCard({
  citedCount,
  citedItems,
  projectId,
  engine,
  getContent,
  refreshContent,
  activeFilePath,
}: BibliographyInjectorCardProps) {
  const [isInjecting, setIsInjecting] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const fetchFormattedBibliography = useCallback(async () => {
    const itemIds = (citedItems || []).map((i) => i.id).filter(Boolean);
    if (itemIds.length === 0) {
      throw new Error('Chưa có tài liệu nào trong thư viện được trích dẫn');
    }

    const currentContent = getContent ? getContent() : engine?.getContent?.() || '';
    const detectedStyle = detectDocumentCitationStyle(currentContent, activeFilePath);

    return await libraryServices.citations.batchFormat(projectId, itemIds, detectedStyle);
  }, [citedItems, projectId, getContent, engine, activeFilePath]);

  // Handler: Insert bibliography section directly into document content
  const handleInsert = useCallback(async () => {
    if (!engine && !getContent) {
      toast.error('Trình soạn thảo chưa sẵn sàng');
      return;
    }

    const currentContent = getContent ? getContent() : engine?.getContent?.() || '';
    const format = isLatexDocument(currentContent, activeFilePath) ? 'latex' : 'markdown';
    const detectedStyle = detectDocumentCitationStyle(currentContent, activeFilePath);

    setIsInjecting(true);
    const toastId = toast.loading('Đang tự động định dạng danh mục tài liệu...');

    try {
      const res = await fetchFormattedBibliography();
      const rawText = res.bibliographyText || '';

      const citationsList = (res.citations || []).map((c, idx) => ({
        key: citedItems[idx]?.citationKey || `ref_${idx + 1}`,
        inText: c.citation?.inText || '',
        bibliography: c.citation?.bibliography || '',
      }));

      const newSection = buildBibliographySection({
        bibliographyText: rawText,
        format,
        styleId: detectedStyle,
        citations: citationsList,
      });

      const { nextContent, action } = injectBibliographyIntoDocument({
        currentContent,
        newSection,
        format,
      });

      if (engine && typeof engine.setContent === 'function') {
        engine.setContent(nextContent);
        if (refreshContent) refreshContent();
      }

      const actionText = action === 'replaced' ? 'Cập nhật' : 'Chèn';
      toast.success(
        `Đã ${actionText.toLowerCase()} danh mục ${citedItems.length} tài liệu vào đề cương!`,
        { id: toastId },
      );
    } catch (err: any) {
      toast.error('Không thể tạo danh mục tài liệu', {
        description: err?.message || 'Lỗi khi gọi engine trích dẫn',
        id: toastId,
      });
    } finally {
      setIsInjecting(false);
    }
  }, [
    engine,
    getContent,
    activeFilePath,
    fetchFormattedBibliography,
    citedItems,
    refreshContent,
  ]);

  // Handler: Copy full bibliography directly to clipboard
  const handleCopy = useCallback(async () => {
    const toastId = toast.loading('Đang sao chép danh mục tài liệu...');
    try {
      const res = await fetchFormattedBibliography();
      const text = res.bibliographyText || '';
      if (!text.trim()) {
        toast.error('Danh mục tài liệu rỗng', { id: toastId });
        return;
      }

      const ok = await copyToClipboard(text);
      if (ok) {
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
        toast.success(
          `Đã sao chép danh mục ${citedItems.length} tài liệu vào clipboard!`,
          { id: toastId },
        );
      } else {
        toast.error('Không thể sao chép vào clipboard', { id: toastId });
      }
    } catch (err: any) {
      toast.error('Sao chép thất bại', {
        description: err?.message || 'Lỗi khi định dạng trích dẫn',
        id: toastId,
      });
    }
  }, [fetchFormattedBibliography, citedItems.length]);

  if (citedCount === 0) return null;

  return (
    <div className="p-2.5 mb-2.5 rounded-md bg-muted/40 border border-border text-foreground space-y-2 select-none">
      {/* Header Info */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-12 font-medium">
          <BookOpen className="size-3.5 text-primary shrink-0" strokeWidth={1.5} />
          <span>Danh mục tài liệu ({citedCount})</span>
        </div>

        {/* Auto-detect badge */}
        <span
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary border border-primary/20"
          title="Tự động nhận diện cú pháp bài viết và chuẩn hóa tên tác giả Việt Nam"
        >
          <Sparkles className="size-2.5 shrink-0" />
          <span>Tự động nhận diện</span>
        </span>
      </div>

      <p className="text-11 leading-relaxed text-muted-foreground">
        Tự động phát hiện định dạng bài viết & chuẩn hóa tên tác giả Việt Nam theo quy chuẩn.
      </p>

      {/* Action Buttons */}
      <div className="flex items-center gap-1.5 pt-0.5">
        <button
          type="button"
          onClick={handleInsert}
          disabled={isInjecting}
          className="flex-1 h-7 px-2.5 rounded bg-primary text-primary-foreground hover:bg-primary/90 text-11 font-medium flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors shadow-none outline-none focus-visible:ring-1 focus-visible:ring-primary"
        >
          {isInjecting ? (
            <RefreshCw className="size-3 animate-spin shrink-0" />
          ) : (
            <BookOpen className="size-3 shrink-0" />
          )}
          <span>{isInjecting ? 'Đang tạo...' : 'Chèn vào đề cương'}</span>
        </button>

        <button
          type="button"
          onClick={handleCopy}
          className="h-7 px-2.5 rounded border border-border bg-background hover:bg-muted text-foreground text-11 font-medium flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-none outline-none focus-visible:ring-1 focus-visible:ring-primary"
          title="Sao chép toàn bộ danh mục tài liệu vào clipboard"
        >
          {isCopied ? (
            <Check className="size-3 text-primary shrink-0" />
          ) : (
            <Copy className="size-3 shrink-0 text-muted-foreground" />
          )}
          <span>{isCopied ? 'Đã chép' : 'Sao chép'}</span>
        </button>
      </div>
    </div>
  );
});
