import { apiGet, apiPost, apiPut, apiDelete } from "@/shared/lib/api";
import type { ActivityLog } from "../types/work-item.types";

export const CommentService = {
  getComments: (itemId: string) =>
    apiGet<ActivityLog[] | { comments?: ActivityLog[]; data?: ActivityLog[] }>(`/api/work-items/${itemId}/comments`),

  addComment: (itemId: string, content: string) =>
    apiPost<ActivityLog>(`/api/work-items/${itemId}/comments`, { content }),

  updateComment: (itemId: string, commentId: string, content: string) =>
    apiPut<{ comment: ActivityLog }>(`/api/work-items/comments/${commentId}`, { content }),

  reactComment: (itemId: string, commentId: string, emoji: string) =>
    apiPost<{ comment: ActivityLog }>(`/api/work-items/comments/${commentId}/reactions`, { emoji }),

  deleteComment: (itemId: string, commentId: string) =>
    apiDelete(`/api/work-items/comments/${commentId}`),

  addReply: (commentId: string, content: string) =>
    apiPost<{ message: string; reply: unknown }>(`/api/work-items/comments/${commentId}/replies`, { content }),
};
