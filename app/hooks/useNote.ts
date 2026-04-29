import { useEffect } from "react";
import type { Note } from "../components/workspace/projects/stickies/types/note.type";

interface RealtimeConfig {
  workspaceId: string;
  projectId?: string;
  queryKey: any[];
  userId: string;
}

export const useNote = ({ workspaceId, projectId, queryKey, userId }: RealtimeConfig) => {
  // Real-time disabled as requested to prioritize stability and manual state management
  useEffect(() => {
    return () => {};
  }, [workspaceId, projectId, JSON.stringify(queryKey)]);
};
