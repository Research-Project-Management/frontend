"use client";

import { useCallback } from "react";
import { openInNewTab } from "@/features/library/core/coordinator/browser-io.helpers";
import {
  LibraryInspector,
  type LibraryInspectorProps,
} from "./LibraryInspector";
import {
  INSPECTOR_LEVELS,
} from "./inspector-levels.constants";
import type { Item } from "@/features/library/domain/types/library.types";
import type { ReaderDocument } from "@/features/library/domain/types/reader.types";

export { INSPECTOR_LEVELS };

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
  const defaultSelectItem = useCallback(
    (itemId: string) => {
      openInNewTab(`/library/papers/${itemId}`);
    },
    [],
  );

  const effectiveItem = (item || null) as Item | null;
  const effectiveOnSelect = onSelectItem || defaultSelectItem;

  return (
    <LibraryInspector
      {...rest}
      item={effectiveItem}
      onSelectItem={effectiveOnSelect}
      hideRailToggle={rest.hideRailToggle ?? false}
      defaultOpen={rest.defaultOpen}
      isReader={true}
    />
  );
}

export default ReaderInspector;
