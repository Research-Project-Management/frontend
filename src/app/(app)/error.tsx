'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { logger } from '@/shared/lib/logger';

export default function AppRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error('App route crashed', error, { digest: error.digest });
  }, [error]);

  return (
    <div className="flex-1 w-full h-full min-h-[380px] flex items-center justify-center p-6 bg-background">
      <div className="max-w-md w-full rounded-lg border border-destructive/20 bg-destructive/5 p-6 text-center space-y-4">
        <div className="size-11 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto shrink-0">
          <AlertTriangle className="size-5 shrink-0" />
        </div>

        <div className="space-y-1.5">
          <h3 className="text-base font-semibold text-foreground">
            Phân hệ này đang gặp sự cố
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Không thể tải dữ liệu hoặc kết nối tới dịch vụ của trang hiện tại. Thanh điều hướng và các tính năng khác vẫn an toàn.
          </p>
        </div>

        {error.message && process.env.NODE_ENV === 'development' && (
          <div className="p-2.5 rounded-md bg-muted text-left font-mono text-xs text-muted-foreground overflow-x-auto max-h-24">
            {error.message}
          </div>
        )}

        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-primary-foreground bg-primary hover:bg-primary/90 rounded-md transition-colors cursor-pointer"
          >
            <RefreshCw className="size-3.5 shrink-0" />
            Thử lại
          </button>
          <Link
            href="/home"
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-medium text-foreground bg-background hover:bg-muted rounded-md border border-border transition-colors cursor-pointer"
          >
            <Home className="size-3.5 shrink-0" />
            Về Trang chủ
          </Link>
        </div>
      </div>
    </div>
  );
}
