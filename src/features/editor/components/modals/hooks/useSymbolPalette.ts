'use client';

/**
 * useSymbolPalette.ts
 *
 * Dedicated hook for SymbolPaletteModal:
 * - Symbol insertion logic
 * - Encapsulated toast notifications
 * - Dialog dismissal control
 */

import { useState, useCallback } from 'react';
import { toast } from 'sonner';

export interface MathSymbol {
  command: string;
  name: string;
  category: string;
  display: string;
}

export interface UseSymbolPaletteOptions {
  onInsert: (text: string) => void;
  onOpenChange: (open: boolean) => void;
}

export function useSymbolPalette({ onInsert, onOpenChange }: UseSymbolPaletteOptions) {
  const [lastInserted, setLastInserted] = useState<string | null>(null);
  const [keepOpen, setKeepOpen] = useState(true);

  const insertSymbol = useCallback(
    (sym: MathSymbol) => {
      onInsert(`${sym.command} `);
      setLastInserted(sym.command);
      toast.success(`Inserted ${sym.command}`, { duration: 1200 });

      if (!keepOpen) {
        onOpenChange(false);
      }
    },
    [onInsert, keepOpen, onOpenChange],
  );

  return {
    lastInserted,
    keepOpen,
    setKeepOpen,
    insertSymbol,
  };
}
