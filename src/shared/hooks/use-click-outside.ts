'use client';

import { useEffect, useRef, type RefObject } from 'react';

export type EventType = 'mousedown' | 'mouseup' | 'touchstart' | 'touchend' | 'pointerdown';

export interface UseClickOutsideOptions {
  events?: EventType[];
  enabled?: boolean;
}

type TargetRef = RefObject<HTMLElement | null> | HTMLElement | null;

/**
 * Dismiss / Outside-Click Hook.
 * Listens for interaction outside of one or multiple target elements.
 *
 * @example
 * const menuRef = useRef<HTMLDivElement>(null);
 * const buttonRef = useRef<HTMLButtonElement>(null);
 *
 * useClickOutside([menuRef, buttonRef], () => {
 *   setIsOpen(false);
 * });
 */
export function useClickOutside(
  targets: TargetRef | TargetRef[],
  handler: (event: Event) => void,
  options: UseClickOutsideOptions = {},
): void {
  const { events = ['mousedown', 'touchstart'], enabled = true } = options;

  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    if (!enabled || typeof document === 'undefined') return;

    const listener = (event: Event) => {
      const targetElement = event.target as Node | null;
      if (!targetElement) return;

      const targetList = Array.isArray(targets) ? targets : [targets];

      const isInside = targetList.some((t) => {
        const el = t && 'current' in t ? t.current : t;
        return el ? el.contains(targetElement) : false;
      });

      if (!isInside) {
        handlerRef.current(event);
      }
    };

    events.forEach((eventName) => {
      document.addEventListener(eventName, listener, true);
    });

    return () => {
      events.forEach((eventName) => {
        document.removeEventListener(eventName, listener, true);
      });
    };
  }, [targets, enabled, events]);
}
