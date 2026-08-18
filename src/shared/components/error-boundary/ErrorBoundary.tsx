'use client';

import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { logger } from '@/shared/lib/logger';

export interface ErrorBoundaryFallbackProps {
  error: Error;
  reset: () => void;
}

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode | ((props: ErrorBoundaryFallbackProps) => ReactNode);
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetKeys?: Array<unknown>;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Global Error Boundary component.
 * Catches unhandled React render crashes, logs telemetry,
 * and presents an accessible recovery fallback UI.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, State> {
  public override state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    logger.error('React component crashed in tree', error, {
      componentStack: errorInfo.componentStack,
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
    this.setState({ hasError: false, error: null });
  };

  public override render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const { fallback } = this.props;
    const error = this.state.error ?? new Error('An unexpected application error occurred');

    if (typeof fallback === 'function') {
      return fallback({ error, reset: this.reset });
    }

    if (fallback) {
      return fallback;
    }

    return (
      <div className="min-h-[400px] w-full flex items-center justify-center p-6 bg-background">
        <div className="max-w-md w-full rounded-xl border border-destructive/20 bg-destructive/5 p-6 shadow-sm text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6" />
          </div>

          <div className="space-y-1.5">
            <h3 className="text-lg font-bold text-foreground">Đã xảy ra sự cố</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Ứng dụng gặp lỗi không mong muốn trong quá trình kết xuất giao diện.
            </p>
          </div>

          {error.message && (
            <div className="p-2.5 rounded-md bg-muted/60 text-left font-mono text-xs text-muted-foreground overflow-x-auto max-h-24">
              {error.message}
            </div>
          )}

          <button
            type="button"
            onClick={this.reset}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-primary-foreground bg-primary hover:bg-primary/90 rounded-md transition-colors shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Thử lại
          </button>
        </div>
      </div>
    );
  }
}
