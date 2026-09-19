'use client';

import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, ChevronRight } from 'lucide-react';
import { logger } from '@/shared/lib/logger';
import { cn } from '@/shared/lib/utils';

export interface ErrorBoundaryFallbackProps {
  error: Error;
  reset: () => void;
}

export type ErrorBoundaryVariant = 'full' | 'section' | 'compact' | 'inline';

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode | ((props: ErrorBoundaryFallbackProps) => ReactNode);
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  onReset?: () => void;
  resetKeys?: Array<unknown>;
  variant?: ErrorBoundaryVariant;
  featureName?: string;
  description?: string;
  className?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Global & Granular Error Boundary UI component.
 * Catches unhandled React render crashes, logs telemetry,
 * and presents an accessible recovery fallback UI scoped to the crashed component.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, State> {
  public override state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    // Ignore benign abort/cancellation events caused by React Query, navigation or unmounting
    if (
      error.name === 'AbortError' ||
      error.name === 'TimeoutError' ||
      error.message?.toLowerCase().includes('aborted') ||
      error.message?.toLowerCase().includes('canceled')
    ) {
      return { hasError: false, error: null };
    }
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    if (
      error.name === 'AbortError' ||
      error.name === 'TimeoutError' ||
      error.message?.toLowerCase().includes('aborted') ||
      error.message?.toLowerCase().includes('canceled')
    ) {
      return;
    }
    logger.error(`React component crashed [${this.props.featureName || 'Tree'}]`, error, {
      componentStack: errorInfo.componentStack,
      featureName: this.props.featureName,
    });
    this.props.onError?.(error, errorInfo);
  }

  public override componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    if (!this.state.hasError) return;

    // Auto-recover when any resetKeys change (e.g. pathname changes)
    if (this.props.resetKeys && prevProps.resetKeys) {
      const hasChanged = this.props.resetKeys.some(
        (key, idx) => key !== prevProps.resetKeys?.[idx],
      );
      if (hasChanged) {
        this.reset();
      }
    }
  }

  public reset = (): void => {
    this.props.onReset?.();
    this.setState({ hasError: false, error: null });
  };

  public override render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const { fallback, variant = 'full', featureName, description, className } = this.props;
    const error = this.state.error ?? new Error('An unexpected application error occurred');

    if (typeof fallback === 'function') {
      return fallback({ error, reset: this.reset });
    }

    if (fallback) {
      return fallback;
    }

    // ── Variant: Inline / Compact (For widgets, side panels, cards, dropdowns) ──
    if (variant === 'inline' || variant === 'compact') {
      return (
        <div
          role="alert"
          className={cn(
            'flex items-center justify-between gap-3 p-3 rounded-md border border-destructive/30 bg-destructive/10 text-xs text-foreground select-none',
            className
          )}
        >
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle className="size-4 shrink-0 text-destructive" />
            <span className="truncate text-muted-foreground">
              {featureName ? `Không thể tải ${featureName}` : 'Đã xảy ra sự cố'}
            </span>
          </div>
          <button
            type="button"
            onClick={this.reset}
            className="inline-flex items-center gap-1 shrink-0 px-2 py-1 rounded bg-background hover:bg-muted text-foreground font-medium border border-border transition-colors cursor-pointer text-xs"
          >
            <RefreshCw className="size-3 shrink-0" />
            Thử lại
          </button>
        </div>
      );
    }

    // ── Variant: Section (For sub-views, tabs, modular panels) ──
    if (variant === 'section') {
      return (
        <div
          role="alert"
          className={cn(
            'min-h-[220px] w-full flex flex-col items-center justify-center p-6 text-center rounded-lg border border-border/60 bg-card/60 backdrop-blur-xs space-y-3',
            className
          )}
        >
          <div className="size-9 rounded-full bg-destructive/10 text-destructive flex items-center justify-center shrink-0">
            <AlertTriangle className="size-4 shrink-0" />
          </div>

          <div className="space-y-1 max-w-sm">
            <h4 className="text-sm font-semibold text-foreground">
              {featureName ? `Sự cố tại ${featureName}` : 'Không thể kết xuất phân hệ này'}
            </h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {description || 'Đã có sự cố xảy ra nhưng các phân hệ khác vẫn hoạt động bình thường.'}
            </p>
          </div>

          {error.message && process.env.NODE_ENV === 'development' && (
            <div className="max-w-md w-full p-2 rounded bg-muted/80 text-left font-mono text-11 text-muted-foreground overflow-x-auto max-h-20">
              {error.message}
            </div>
          )}

          <button
            type="button"
            onClick={this.reset}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary-foreground bg-primary hover:bg-primary/90 rounded-md transition-colors cursor-pointer"
          >
            <RefreshCw className="size-3.5 shrink-0" />
            Tải lại phân hệ
          </button>
        </div>
      );
    }

    // ── Variant: Full (For main page content) ──
    return (
      <div
        role="alert"
        className={cn(
          'min-h-[360px] w-full flex-1 flex items-center justify-center p-6 bg-background',
          className
        )}
      >
        <div className="max-w-md w-full rounded-lg border border-destructive/20 bg-destructive/5 p-6 text-center space-y-4">
          <div className="size-11 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto shrink-0">
            <AlertTriangle className="size-5 shrink-0" />
          </div>

          <div className="space-y-1.5">
            <h3 className="text-base font-semibold text-foreground">
              {featureName ? `Không thể tải ${featureName}` : 'Đã xảy ra sự cố'}
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {description ||
                'Phân hệ này gặp lỗi không mong muốn. Các mô-đun và dữ liệu khác trên thanh điều hướng vẫn an toàn.'}
            </p>
          </div>

          {error.message && (
            <div className="p-2.5 rounded-md bg-muted text-left font-mono text-xs text-muted-foreground overflow-x-auto max-h-24">
              {error.message}
            </div>
          )}

          <div className="flex items-center justify-center gap-2 pt-1">
            <button
              type="button"
              onClick={this.reset}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-primary-foreground bg-primary hover:bg-primary/90 rounded-md transition-colors cursor-pointer"
            >
              <RefreshCw className="size-3.5 shrink-0" />
              Thử lại
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
