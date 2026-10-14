import type {
  AttachPageItem,
  AttachPaperItem,
  AttachFileItem,
  AttachLinkItem,
} from './work-item.types';

export type ItemAttachment = {
  id: string;
  name: string;
  type?: string | null;
  size?: string | number | null;
  createdAt?: string;
  uploadedAt?: string;
  url: string;
};

export type AttachCenterData = {
  pages?: AttachPageItem[];
  papers?: AttachPaperItem[];
  files?: (ItemAttachment | AttachFileItem)[];
  links?: AttachLinkItem[];
};

export type AttachmentsProps = {
  attachments?: AttachCenterData | ItemAttachment[];
  itemId?: string;
  workItemId?: string;
  projectId?: string;
  onRenameAttachment?: (attachmentId: string, newName: string) => void;
  onRemoveAttachment?: (attachmentId: string) => void;
  onAttachPage?: (page: { pageId: string; title: string }) => void;
  onDetachPage?: (pageId: string) => void;
  onAttachPaper?: (paper: { paperId: string; title: string; doi?: string; citationKey?: string }) => void;
  onDetachPaper?: (paperId: string) => void;
  onAttachFile?: (file: { name: string; url: string; size?: number; type?: string; fileId?: string }) => void;
  onDetachFile?: (fileId: string) => void;
  onAttachLink?: (link: { title: string; url: string }) => void;
  onDetachLink?: (linkIndex: number | string) => void;
  onCommentAttachment?: (attachment: ItemAttachment) => void;
  onDownloadAttachment?: (attachment: ItemAttachment) => void;
  isReadOnly?: boolean;
};
