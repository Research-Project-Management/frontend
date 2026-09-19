'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { FileCode, RefreshCw, FolderOpen } from 'lucide-react';
import { logger } from '@/shared/lib/logger';

export default function EditorRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error('Editor route error captured', error, { digest: error.digest });
  }, [error]);

  return (
    <div className="h-dvh w-full flex items-center justify-center p-6 bg-background">
      <div className="max-w-md w-full rounded-xl border border-destructive/20 bg-destructive/5 p-6 text-center space-y-4 shadow-sm">
        <div className="size-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto shrink-0">
          <FileCode className="size-6 shrink-0" />
        </div>

        <div className="space-y-1.5">
          <h3 className="text-base font-semibold text-foreground">
            Sự cố trong Trình soạn thảo
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Đã xảy ra lỗi không mong muốn trong khi hiển thị tài liệu. Các nội dung đã gõ trước đó có thể vẫn an toàn trong bộ nhớ đệm.
          </p>
        </div>

        {error.message && (
          <div className="p-2.5 rounded-md bg-muted text-left font-mono text-xs text-muted-foreground overflow-x-auto max-h-24 border border-border/50">
            {error.message}
          </div>
        )}

        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-primary-foreground bg-primary hover:bg-primary/90 rounded-md transition-colors cursor-pointer"
          >
            <RefreshCw className="size-3.5 shrink-0" />
            Thử khôi phục
          </button>
          <Link
            href="/projects"
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-medium text-foreground bg-background hover:bg-muted rounded-md border border-border transition-colors cursor-pointer"
          >
            <FolderOpen className="size-3.5 shrink-0" />
            Danh sách Dự án
          </Link>
        </div>
      </div>
    </div>
  );
}
