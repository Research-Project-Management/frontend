/**
 * comment.service.ts
 *
 * Frontend service mirroring Backend Manuscript Review Comments:
 *  - Inline comments on pages/lines
 *  - Threading & replies
 *  - Resolve / Delete
 *
 * Delegates to unified manuscriptService.comments (`/api/v1/manuscripts/docs/:docId/comments`).
 */

import { manuscriptService } from './manuscript.service';

export const commentService = {
  getComments: manuscriptService.comments.getComments,
  createComment: manuscriptService.comments.createComment,
  updateComment: manuscriptService.comments.updateComment,
  deleteComment: manuscriptService.comments.deleteComment,
  deleteReply: manuscriptService.comments.deleteReply,
  addReply: manuscriptService.comments.addReply,
  resolveComment: manuscriptService.comments.resolveComment,
};

export const DocumentCommentService = commentService;
