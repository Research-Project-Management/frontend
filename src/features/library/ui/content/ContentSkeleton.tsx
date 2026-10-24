import React from "react";
import { WorkspaceRowListSkeleton } from "@/shared/components/layout/WorkspaceSkeleton";

export function ContentSkeleton({ rowCount = 10 }: { rowCount?: number }) {
  return (
    <WorkspaceRowListSkeleton
      rows={rowCount}
      variant="library"
      showTableHeader={true}
    />
  );
}
