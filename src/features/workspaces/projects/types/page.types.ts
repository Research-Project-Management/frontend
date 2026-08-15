export type { Page, PageComment, CommentReply } from "@/features/editor/types/document.types";
export type { PageVersion, PageEvent } from "@/features/editor/types/document.types";
/** @deprecated Use PageComment instead. */
export type Comment = import("@/features/editor/types/document.types").PageComment;
