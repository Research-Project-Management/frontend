'use client';

import { useEffect, useRef } from 'react';

export interface UseHotkeysOptions {
  enabled?: boolean;
  preventDefault?: boolean;
  enableOnFormTags?: boolean;
}

type HotkeyHandler = (event: KeyboardEvent) => void;

function isMac(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  return /macintosh|mac os x/i.test(navigator.userAgent);
}

function parseHotkey(combo: string): {
  key: string;
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  meta: boolean;
} {
  const parts = combo.toLowerCase().split('+').map((p) => p.trim());
  const mac = isMac();

  let ctrl = false;
  let shift = false;
  let alt = false;
  let meta = false;
  let key = '';

  for (const part of parts) {
    if (part === 'mod' || part === 'cmd' || part === 'command') {
      if (mac) meta = true;
      else ctrl = true;
    } else if (part === 'ctrl' || part === 'control') {
      ctrl = true;
    } else if (part === 'shift') {
      shift = true;
    } else if (part === 'alt' || part === 'option') {
      alt = true;
    } else if (part === 'meta') {
      meta = true;
    } else if (part === 'esc') {
      key = 'escape';
    } else {
      key = part;
    }
  }

  return { key, ctrl, shift, alt, meta };
}

function isFormTag(element: HTMLElement | EventTarget | null): boolean {
  if (
    !element ||
    !('tagName' in element) ||
    typeof (element as HTMLElement).tagName !== 'string'
  ) {
    return false;
  }
  const el = element as HTMLElement;
  const tagName = el.tagName.toLowerCase();
  return (
    tagName === 'input' ||
    tagName === 'textarea' ||
    tagName === 'select' ||
    Boolean(el.isContentEditable)
  );
}

/**
 * Keyboard Shortcut & Hotkey Hook.
 * Supports cross-platform modifier normalization ('mod' -> Cmd on Mac / Ctrl on Windows)
 * and form input protection.
 *
 * @example
 * useHotkeys('mod+k', () => openCommandPalette());
 * useHotkeys('escape', () => closeModal());
 * useHotkeys(['mod+s', 'ctrl+s'], (e) => saveDocument());
 */
export function useHotkeys(
  hotkeys: string | string[],
  handler: HotkeyHandler,
  options: UseHotkeysOptions = {},
): void {
  const { enabled = true, preventDefault = true, enableOnFormTags = false } = options;

  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const hotkeyList = Array.isArray(hotkeys) ? hotkeys : [hotkeys];
    const parsedList = hotkeyList.map(parseHotkey);

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (!enableOnFormTags && isFormTag(target)) {
        return;
      }

      const eventKey = event.key.toLowerCase();

      for (const parsed of parsedList) {
        const keyMatch =
          eventKey === parsed.key ||
          (parsed.key === 'enter' && eventKey === 'enter') ||
          (parsed.key === 'escape' && (eventKey === 'escape' || eventKey === 'esc'));

        const ctrlMatch = parsed.ctrl === event.ctrlKey;
        const shiftMatch = parsed.shift === event.shiftKey;
        const altMatch = parsed.alt === event.altKey;
        const metaMatch = parsed.meta === event.metaKey;

        if (keyMatch && ctrlMatch && shiftMatch && altMatch && metaMatch) {
          if (preventDefault) {
            event.preventDefault();
          }
          handlerRef.current(event);
          break;
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [hotkeys, enabled, preventDefault, enableOnFormTags]);
}
