'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  X,
  Download,
  FileText,
  Calendar,
  User,
  Maximize2,
  Save,
  Loader2,
  FileCode2,
  FileSpreadsheet,
  Table2,
  History,
  Folder,
  HardDrive,
  Clock,
  Star,
  Tag,
} from 'lucide-react';
import { Button } from '@/shared/components/ui';
import { Textarea } from '@/shared/components/ui';
import ScientificViewerModal from './ScientificViewerModal';
import VersionHistoryModal from '../modal/VersionHistoryModal';
import {
  getFileType,
  getFileIcon,
  getFileColor,
  formatFileSize,
  formatMimeType,
} from '../../utils/file';
import {
  formatDetailedSize,
  formatFileLocation,
  formatDetailedDate,
} from '../../utils/preview.util';
import { resolveFileUrl, downloadFileUrl } from '@/shared/lib/file-client';
import { usePreview } from '../../hooks/use-preview';
import { usePreviewStore } from '../../store/use-preview-store';

export default function Preview() {
  const params = useParams();
  const projectId = (params?.projectId as string) || (params?.id as string) || '';
  const { selectedItem: item, setSelectedItem } = usePreviewStore();
  const [imageError, setImageError] = useState(false);
  const [scientificViewerOpen, setScientificViewerOpen] = useState(false);
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);

  useEffect(() => {
    setImageError(false);
  }, [item?.id, item?.url]);

  const {
    previewDataUrl,
    loading: pdfLoading,
    description,
    setDescription,
    isSaved,
    isSavingDescription,
    handleSaveDescription,
  } = usePreview(item);

  if (!item) return null;

  const fileType = getFileType(item as any);
  const isImage = fileType === 'image';
  const isPdf =
    item.filename.toLowerCase().endsWith('.pdf') ||
    item.mimeType === 'application/pdf';
  const ext = item.filename.split('.').pop()?.toLowerCase() || '';
  const isScientificText = [
    'csv',
    'tsv',
    'ipynb',
    'tex',
    'md',
    'json',
    'py',
    'txt',
    'bib',
  ].includes(ext);
  const resolvedUrl = resolveFileUrl(item.url);
  const color = getFileColor(fileType);

  const handleDownload = async () => {
    if (!resolvedUrl) return;
    try {
      await downloadFileUrl(resolvedUrl, item.filename);
    } catch {
      // ignore
    }
  };

  const fileDetails = [
    {
      icon: <Tag className="size-3.5 text-muted-foreground/70 shrink-0" />,
      label: 'Loại tệp',
      value: formatMimeType(item as any),
    },
    {
      icon: <HardDrive className="size-3.5 text-muted-foreground/70 shrink-0" />,
      label: 'Kích thước',
      value: formatDetailedSize(item.size),
    },
    {
      icon: <Folder className="size-3.5 text-muted-foreground/70 shrink-0" />,
      label: 'Vị trí',
      value: formatFileLocation(item, item.project?.name),
    },
    {
      icon: <User className="size-3.5 text-muted-foreground/70 shrink-0" />,
      label: 'Chủ sở hữu',
      value: item.author?.name || 'Researcher',
    },
    {
      icon: <Calendar className="size-3.5 text-muted-foreground/70 shrink-0" />,
      label: 'Đã tạo',
      value: formatDetailedDate(item.createdAt),
    },
    {
      icon: <Clock className="size-3.5 text-muted-foreground/70 shrink-0" />,
      label: 'Sửa đổi lần cuối',
      value: formatDetailedDate(item.updatedAt),
    },
  ];

  return (
    <div className="w-[320px] shrink-0 h-full border-l border-border bg-background flex flex-col overflow-hidden animate-in slide-in-from-right-3 duration-200 ease-out">
      {/* ─── Header ──────────────────────────────────────────────────── */}
      <div className="flex items-start gap-3 px-4 py-3.5 border-b border-border bg-muted/20">
        <span className="mt-0.5 shrink-0 [&>svg]:size-5" style={{ color }}>
          {getFileIcon(fileType, 4)}
        </span>

        <div className="flex-1 min-w-0">
          <p
            className="text-sm font-semibold text-foreground leading-snug break-words line-clamp-2 pr-1"
            title={item.filename}
          >
            {item.filename}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-xs text-muted-foreground/70 truncate">
              {formatMimeType(item as any)}
            </span>
            {item.starred && (
              <Star className="size-3 fill-amber-400 text-amber-400 shrink-0" />
            )}
          </div>
        </div>

        <button
          onClick={() => setSelectedItem(null)}
          aria-label="Close preview"
          className="mt-0.5 shrink-0 size-6 flex items-center justify-center rounded hover:bg-muted transition-colors text-muted-foreground outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
        >
          <X className="size-4 shrink-0" />
        </button>
      </div>

      {/* ─── Scrollable body ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {/* Thumbnail preview zone */}
        <div
          className="relative border-b border-border flex items-center justify-center h-44 overflow-hidden shrink-0"
          style={{
            background:
              isImage && !imageError && resolvedUrl
                ? 'repeating-conic-gradient(var(--color-muted) 0% 25%, var(--color-background) 0% 50%) 0 0 / 14px 14px'
                : 'color-mix(in oklch, var(--color-muted) 30%, transparent)',
          }}
        >
          {isImage ? (
            !imageError && resolvedUrl ? (
              <img
                src={resolvedUrl}
                alt={item.filename}
                onError={() => setImageError(true)}
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="flex flex-col items-center gap-2 py-8">
                <div
                  className="opacity-25 transition-opacity hover:opacity-40"
                  style={{ color }}
                >
                  {getFileIcon('image', 10)}
                </div>
                <span className="text-xs text-muted-foreground/50">
                  Không thể hiển thị xem trước
                </span>
              </div>
            )
          ) : isPdf ? (
            pdfLoading ? (
              <div className="relative w-[calc(100%-32px)] mx-4 my-6 rounded-md overflow-hidden bg-muted h-32 flex items-center justify-center">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground/70">
                  <Loader2 className="size-3.5 animate-spin shrink-0" />
                  Đang tải hình xem trước…
                </div>
              </div>
            ) : previewDataUrl ? (
              <img
                src={previewDataUrl}
                alt={`${item.filename} preview`}
                className="w-full max-h-44 object-contain animate-in fade-in duration-300"
              />
            ) : (
              <div className="flex flex-col items-center gap-2 py-8">
                <FileText className="size-9 text-muted-foreground/20 shrink-0" />
                <span className="text-xs text-muted-foreground/50">
                  Tài liệu PDF
                </span>
              </div>
            )
          ) : isScientificText ? (
            <div
              onClick={() => setScientificViewerOpen(true)}
              className="flex flex-col items-center gap-2.5 py-6 px-4 cursor-pointer hover:bg-muted/40 rounded-lg transition-all group"
              title="Nhấp để xem bảng dữ liệu và mã nguồn"
            >
              <div className="size-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary group-hover:scale-105 transition-transform shadow-xs">
                {ext === 'csv' || ext === 'tsv' ? (
                  <FileSpreadsheet className="size-6" />
                ) : (
                  <FileCode2 className="size-6" />
                )}
              </div>
              <div className="text-center">
                <span className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                  Dữ liệu {ext.toUpperCase()}
                </span>
                <p className="text-11 text-muted-foreground mt-0.5">
                  Bấm để xem dữ liệu khoa học
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-8">
              <div
                className="opacity-20 transition-opacity hover:opacity-30"
                style={{ color }}
              >
                {getFileIcon(fileType, 10)}
              </div>
              <span className="text-xs text-muted-foreground/40">
                {item.isFolder ? 'Thư mục' : 'Tập tin'}
              </span>
            </div>
          )}
        </div>

        {/* Quick actions toolbar */}
        <div className="flex gap-1.5 px-3 py-2 border-b border-border bg-muted/10">
          <button
            onClick={handleDownload}
            className="flex-1 flex items-center justify-center gap-1.5 h-7 rounded-md text-xs text-foreground hover:bg-muted transition-colors cursor-pointer"
            title="Tải tệp xuống máy tính"
          >
            <Download className="size-3.5 shrink-0" />
            Tải xuống
          </button>

          {!item.isFolder && (
            <button
              onClick={() => setVersionHistoryOpen(true)}
              className="flex-1 flex items-center justify-center gap-1.5 h-7 rounded-md text-xs text-foreground hover:bg-muted transition-colors cursor-pointer"
              title="Lịch sử phiên bản & Tải bản mới lên"
            >
              <History className="size-3.5 shrink-0 text-muted-foreground" />
              Phiên bản
            </button>
          )}

          {isScientificText && (
            <button
              onClick={() => setScientificViewerOpen(true)}
              className="flex-1 flex items-center justify-center gap-1.5 h-7 rounded-md text-xs text-primary font-medium bg-primary/10 hover:bg-primary/20 transition-colors cursor-pointer"
              title="Xem bảng tính & mã nguồn nghiên cứu"
            >
              <Table2 className="size-3.5 shrink-0" />
              Dữ liệu
            </button>
          )}

          {(isPdf || isImage) && (
            <button
              onClick={() => window.open(resolvedUrl || item.url, '_blank')}
              className="flex-1 flex items-center justify-center gap-1.5 h-7 rounded-md text-xs text-foreground hover:bg-muted transition-colors cursor-pointer"
              title="Mở toàn màn hình trong tab mới"
            >
              <Maximize2 className="size-3.5 shrink-0" />
              Mở rộng
            </button>
          )}
        </div>

        {/* ─── Google Drive: Chi tiết tệp (File details) ──────────────── */}
        <div className="px-3.5 py-3.5 border-b border-border">
          <p className="text-xs font-semibold text-foreground mb-3 flex items-center gap-1.5">
            Chi tiết tệp
          </p>
          <div className="divide-y divide-border/30">
            {fileDetails.map(({ icon, label, value }) => (
              <div
                key={label}
                className="flex items-start justify-between gap-3 py-2 text-xs"
              >
                <div className="flex items-center gap-2 text-muted-foreground shrink-0">
                  {icon}
                  <span>{label}</span>
                </div>
                <span className="font-medium text-foreground text-right break-words max-w-[160px]">
                  {value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ─── Google Drive: Mô tả tệp (Description / Notes) ───────────── */}
        <div className="px-3.5 py-3.5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-foreground">
              Mô tả tệp
            </p>
            {!isSaved && (
              <span className="text-11 text-amber-500 font-medium">
                Chưa lưu
              </span>
            )}
          </div>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Thêm mô tả về tài liệu này..."
            rows={3}
            className="text-xs resize-none bg-muted/20 border-border placeholder:text-muted-foreground/40 focus-visible:ring-1"
          />

          {!isSaved && (
            <div className="mt-2 flex justify-end">
              <Button
                size="sm"
                onClick={handleSaveDescription}
                disabled={isSavingDescription}
                className="h-7 text-xs gap-1.5 px-3 cursor-pointer"
              >
                {isSavingDescription ? (
                  <Loader2 className="size-3 animate-spin shrink-0" />
                ) : (
                  <Save className="size-3 shrink-0" />
                )}
                Lưu mô tả
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* ─── Scientific Data & Code Viewer Modal ───────────────────── */}
      <ScientificViewerModal
        open={scientificViewerOpen}
        onOpenChange={setScientificViewerOpen}
        file={item as any}
      />

      {/* ─── Version History Modal ─────────────────────────────────── */}
      <VersionHistoryModal
        open={versionHistoryOpen}
        onOpenChange={setVersionHistoryOpen}
        file={item as any}
      />
    </div>
  );
}
