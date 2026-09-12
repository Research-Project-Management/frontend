'use client';

/**
 * Toast notification system inspired by Plane.so (@plane/propel) design tokens
 * Flat SaaS Elevation, solid semantic circular badges, and 1px neutral border.
 */

import * as React from 'react';
import { Toaster as SonnerToaster } from 'sonner';
import {
  TOAST_ICONS,
  ToastSuccessIcon,
  ToastErrorIcon,
  ToastWarningIcon,
  ToastInfoIcon,
  ToastLoadingIcon,
  ToastCloseIcon,
} from './toast-icons';

type ToasterProps = React.ComponentProps<typeof SonnerToaster>;

export function Toaster({ ...props }: ToasterProps) {
  return (
    <SonnerToaster
      position="bottom-right"
      expand={false}
      visibleToasts={4}
      duration={3200}
      gap={10}
      offset="16px"
      closeButton
      icons={{
        success: TOAST_ICONS.success,
        error: TOAST_ICONS.error,
        warning: TOAST_ICONS.warning,
        info: TOAST_ICONS.info,
        loading: TOAST_ICONS.loading,
        close: TOAST_ICONS.close,
      }}
      toastOptions={{
        classNames: {
          toast: 'group toast font-sans',
          title: 'font-medium',
          description: 'text-muted-foreground',
          actionButton:
            'bg-foreground text-background hover:bg-foreground/90 font-medium text-xs rounded-md px-2.5 py-1 transition-colors',
          cancelButton:
            'border border-border bg-background text-foreground hover:bg-muted font-medium text-xs rounded-md px-2.5 py-1 transition-colors',
        },
      }}
      {...props}
    />
  );
}
