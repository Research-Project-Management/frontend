'use client';

/**
 * Toast notification system inspired by Plane.so (@plane/propel) design tokens
 * Flat SaaS Elevation, solid semantic circular badges, and 1px neutral border.
 * Strictly ephemeral notifications — no inline interactive action buttons or clutter.
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
} from './toast-icons';

type ToasterProps = React.ComponentProps<typeof SonnerToaster>;

export function Toaster({ ...props }: ToasterProps) {
  React.useEffect(() => {
    const sanitizeSonnerStyles = () => {
      // 1. Sanitize raw style tags injected into head
      const styleTags = document.querySelectorAll('style');
      styleTags.forEach((tag) => {
        if (tag.textContent && tag.textContent.includes('height')) {
          tag.textContent = tag.textContent
            .replace(/,?\s*height(?:\s+[^,;}]*)?/gi, '')
            .replace(/height(?:\s+[^,;}]*)?,?\s*/gi, '')
            .replace(/transition:\s*,/g, 'transition: ');
        }
      });

      // 2. Sanitize CSSStyleRules across all stylesheets
      for (const sheet of document.styleSheets) {
        try {
          for (let i = 0; i < sheet.cssRules.length; i++) {
            const rule = sheet.cssRules[i];
            if (
              rule instanceof CSSStyleRule &&
              (rule.selectorText === '[data-sonner-toast]' || rule.selectorText?.includes('data-sonner'))
            ) {
              const transitionVal = rule.style.transition;
              if (transitionVal && transitionVal.includes('height')) {
                rule.style.transition = transitionVal
                  .replace(/height[^,]*,?\s*/g, '')
                  .trim()
                  .replace(/,\s*$/, '');
              }
            }
          }
        } catch {
          // Cross-origin stylesheet guard
        }
      }
    };

    sanitizeSonnerStyles();
    const observer = new MutationObserver(sanitizeSonnerStyles);
    observer.observe(document.head, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return (
    <SonnerToaster
      position="bottom-right"
      expand={false}
      visibleToasts={2}
      duration={2400}
      gap={10}
      offset="16px"
      closeButton={false}
      icons={{
        success: TOAST_ICONS.success,
        error: TOAST_ICONS.error,
        warning: TOAST_ICONS.warning,
        info: TOAST_ICONS.info,
        loading: TOAST_ICONS.loading,
      }}
      toastOptions={{
        classNames: {
          toast: 'group toast font-sans',
          title: 'font-medium',
          description: 'text-muted-foreground',
          actionButton: '!hidden',
          cancelButton: '!hidden',
          closeButton: '!hidden',
        },
      }}
      {...props}
    />
  );
}
