'use client';

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  FileText,
  Image as ImageIcon,
  Film,
  Archive,
  HardDrive,
  Upload,
  FolderPlus,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/components/ui/button';
import type { StorageItem } from '@/features/workspaces/storage/types/storage.types';
import { getFileType, formatFileSize } from '../../utils/storage.util';
import { useStorageFilterStore } from '../../store/use-filter-store';

interface StorageStatsOverviewProps {
  items: StorageItem[];
  onUploadClick?: () => void;
  onCreateFolderClick?: () => void;
  onExploreClick?: () => void;
  className?: string;
}

export default function StorageStatsOverview({
  items,
  onUploadClick,
  onCreateFolderClick,
  onExploreClick,
  className,
}: StorageStatsOverviewProps) {
  const { selectedTypes, toggleType } = useStorageFilterStore();

  const stats = useMemo(() => {
    let totalSize = 0;
    let folderCount = 0;
    let fileCount = 0;

    const breakdown = {
      document: { count: 0, size: 0 },
      image: { count: 0, size: 0 },
      video: { count: 0, size: 0 },
      audio: { count: 0, size: 0 },
      archive: { count: 0, size: 0 },
      other: { count: 0, size: 0 },
    };

    items.forEach((item) => {
      if (item.isFolder) {
        folderCount++;
      } else {
        fileCount++;
        const size = item.size || 0;
        totalSize += size;

        const type = getFileType(item);
        if (type in breakdown) {
          breakdown[type as keyof typeof breakdown].count++;
          breakdown[type as keyof typeof breakdown].size += size;
        } else {
          breakdown.other.count++;
          breakdown.other.size += size;
        }
      }
    });

    return {
      totalSize,
      folderCount,
      fileCount,
      breakdown,
    };
  }, [items]);

  const categories = [
    {
      id: 'document',
      label: 'Documents',
      sublabel: 'PDF, DOCX, XLS, TXT',
      icon: FileText,
      count: stats.breakdown.document.count,
      size: stats.breakdown.document.size,
      accentClass: 'from-blue-500/10 to-cyan-500/10 text-blue-500 border-blue-500/20 hover:border-blue-500/40',
      activeClass: 'ring-2 ring-blue-500 border-transparent bg-blue-500/10',
      iconBg: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
    },
    {
      id: 'image',
      label: 'Images',
      sublabel: 'PNG, JPG, SVG, WebP',
      icon: ImageIcon,
      count: stats.breakdown.image.count,
      size: stats.breakdown.image.size,
      accentClass: 'from-emerald-500/10 to-teal-500/10 text-emerald-500 border-emerald-500/20 hover:border-emerald-500/40',
      activeClass: 'ring-2 ring-emerald-500 border-transparent bg-emerald-500/10',
      iconBg: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    },
    {
      id: 'video',
      label: 'Media & Audio',
      sublabel: 'MP4, MOV, MP3, WAV',
      icon: Film,
      count: stats.breakdown.video.count + stats.breakdown.audio.count,
      size: stats.breakdown.video.size + stats.breakdown.audio.size,
      accentClass: 'from-sky-500/10 to-blue-500/10 text-sky-500 border-sky-500/20 hover:border-sky-500/40',
      activeClass: 'ring-2 ring-sky-500 border-transparent bg-sky-500/10',
      iconBg: 'bg-sky-500/15 text-sky-600 dark:text-sky-400',
    },
    {
      id: 'archive',
      label: 'Archives & Other',
      sublabel: 'ZIP, RAR, Code, Data',
      icon: Archive,
      count: stats.breakdown.archive.count + stats.breakdown.other.count,
      size: stats.breakdown.archive.size + stats.breakdown.other.size,
      accentClass: 'from-amber-500/10 to-orange-500/10 text-amber-500 border-amber-500/20 hover:border-amber-500/40',
      activeClass: 'ring-2 ring-amber-500 border-transparent bg-amber-500/10',
      iconBg: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
    },
  ];

  return (
    <div className={cn("space-y-4 mb-6", className)}>
      {/* Banner / Header Card */}
      <div className="relative overflow-hidden rounded-md border border-border bg-card p-5 sm:p-6 shadow-none">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-md bg-muted flex items-center justify-center text-primary shrink-0">
                <HardDrive className="size-4 shrink-0" />
              </div>
              <h2 className="text-lg sm:text-xl font-semibold tracking-tight text-foreground">
                Storage Overview
              </h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Storing <span className="font-semibold text-foreground">{stats.fileCount} files</span> and{' '}
              <span className="font-semibold text-foreground">{stats.folderCount} folders</span> (approx.{' '}
              <span className="font-semibold text-foreground">{formatFileSize(stats.totalSize)}</span>).
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
            {onUploadClick && (
              <Button
                onClick={onUploadClick}
                size="sm"
                className="gap-1.5 rounded-md"
              >
                <Upload className="size-3.5 shrink-0" />
                Upload files
              </Button>
            )}
            {onCreateFolderClick && (
              <Button
                onClick={onCreateFolderClick}
                variant="outline"
                size="sm"
                className="gap-1.5 rounded-md border border-border hover:bg-muted"
              >
                <FolderPlus className="size-3.5 shrink-0" />
                New folder
              </Button>
            )}
            {onExploreClick && (
              <Button
                onClick={onExploreClick}
                variant="ghost"
                size="sm"
                className="gap-1.5 rounded-md text-muted-foreground hover:text-foreground"
              >
                <span>View all</span>
                <ArrowRight className="size-3.5 shrink-0" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Category Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3">
        {categories.map((cat) => {
          const Icon = cat.icon;
          const isSelected = selectedTypes.includes(cat.id as any);

          return (
            <motion.div
              key={cat.id}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => toggleType(cat.id as any)}
              className={cn(
                "relative cursor-pointer overflow-hidden rounded-md border bg-card p-4 transition-all duration-200 shadow-none",
                isSelected
                  ? cat.activeClass
                  : "border-border hover:bg-muted hover:border-border",
              )}
            >
              <div className="flex items-center justify-between mb-3">
                <div className={cn("size-9 rounded-md flex items-center justify-center", cat.iconBg)}>
                  <Icon className="size-5 shrink-0" />
                </div>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                  {cat.count} files
                </span>
              </div>

              <h4 className="text-sm font-semibold text-foreground tracking-tight">
                {cat.label}
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {cat.size > 0 ? formatFileSize(cat.size) : cat.sublabel}
              </p>

              {isSelected && (
                <div className="absolute top-2 right-2 size-2 rounded-full bg-primary" />
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
