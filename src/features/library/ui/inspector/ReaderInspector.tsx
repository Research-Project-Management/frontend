"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  LibraryInspector,
  type LibraryInspectorProps,
  INSPECTOR_LEVELS_FROM_BOTTOM,
  INSPECTOR_LEVELS,
} from "./LibraryInspector";
import type { Item } from "@/features/library/domain/types/library.types";
import type { ReaderDocument } from "@/features/library/domain/types/reader.types";

export { INSPECTOR_LEVELS_FROM_BOTTOM, INSPECTOR_LEVELS };

export interface ReaderInspectorProps extends Omit<
  LibraryInspectorProps,
  "item"
> {
  item?: Item | ReaderDocument | null;
}

/**
 * Autonomous Zone 4: ReaderInspector
 * Thin wrapper around the shared LibraryInspector with reader-specific navigation fallbacks.
 */
export function ReaderInspector({
  item,
  onSelectItem,
  ...rest
}: ReaderInspectorProps) {
  const router = useRouter();

  const defaultSelectItem = useCallback(
    (itemId: string) => {
      router.push(`/library/papers/${itemId}`);
    },
    [router],
  );

  const effectiveItem = (item || null) as Item | null;
  const effectiveOnSelect = onSelectItem || defaultSelectItem;

  return (
    <LibraryInspector
      {...rest}
      item={effectiveItem}
      onSelectItem={effectiveOnSelect}
      hideRailToggle={false}
      defaultOpen={rest.defaultOpen ?? false}
    />
  );
}

export default ReaderInspector;
