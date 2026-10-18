"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  LibraryInspector,
  type LibraryInspectorProps,
  INSPECTOR_LEVELS_FROM_BOTTOM,
  INSPECTOR_LEVELS,
} from "./LibraryInspector";
import { useLibraryUIStore } from "@/features/library/core/store/library-ui.store";
import type { Item } from "@/features/library/domain/types/library.types";
import type { ReaderDocument } from "@/features/library/domain/types/reader.types";

export { INSPECTOR_LEVELS_FROM_BOTTOM, INSPECTOR_LEVELS };

export interface ReaderInspectorProps extends Omit<
  LibraryInspectorProps,
  "item" | "paper"
> {
  item?: Item | ReaderDocument | null;
  paper?: Item | ReaderDocument | null;
}

/**
 * Autonomous Zone 4: ReaderInspector
 * Thin wrapper around the shared LibraryInspector with reader-specific navigation fallbacks.
 */
export function ReaderInspector({
  item,
  paper,
  onSelectItem,
  onSelectPaper,
  ...rest
}: ReaderInspectorProps) {
  const router = useRouter();

  const defaultSelectPaper = useCallback(
    (paperId: string) => {
      router.push(`/library/papers/${paperId}`);
    },
    [router],
  );

  const effectiveItem = (item || paper || null) as Item | null;
  const effectiveOnSelect = onSelectItem || onSelectPaper || defaultSelectPaper;

  return (
    <LibraryInspector
      {...rest}
      item={effectiveItem}
      paper={effectiveItem}
      onSelectItem={effectiveOnSelect}
      onSelectPaper={effectiveOnSelect}
      hideRailToggle={true}
      defaultOpen={true}
    />
  );
}

export default ReaderInspector;
