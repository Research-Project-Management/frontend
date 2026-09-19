'use client';

import React, { type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { ErrorBoundary, type ErrorBoundaryVariant } from './error-boundary';

export interface FeatureErrorBoundaryProps {
  children: ReactNode;
  featureName: string;
  variant?: ErrorBoundaryVariant;
  description?: string;
  className?: string;
  fallback?: ReactNode;
  onReset?: () => void;
  resetOnPathChange?: boolean;
}

/**
 * Feature-level Error Boundary wrapper.
 * Automatically ties recovery to URL pathname changes, preventing a crash in one
 * feature (e.g. Library) from affecting adjacent features (e.g. Document Editor).
 */
export function FeatureErrorBoundary({
  children,
  featureName,
  variant = 'section',
  description,
  className,
  fallback,
  onReset,
  resetOnPathChange = true,
}: FeatureErrorBoundaryProps) {
  const pathname = usePathname();
  const resetKeys = resetOnPathChange ? [pathname] : undefined;

  return (
    <ErrorBoundary
      featureName={featureName}
      variant={variant}
      description={description}
      className={className}
      fallback={fallback}
      onReset={onReset}
      resetKeys={resetKeys}
    >
      {children}
    </ErrorBoundary>
  );
}

export default FeatureErrorBoundary;
