export type FileType = "folder" | "document" | "image" | "video" | "audio" | "archive" | "other";

export type StorageItem = {
  _id: string;
  filename: string;
  isFolder: boolean;
  size?: number;
  mimeType?: string;
  url?: string;
  thumbnail?: string;
  starred: boolean;
  author: {
    name: string;
    email: string;
    avatar: string;
  };
  project?: {
    _id: string;
    name: string;
  };
  createdAt: string;
  updatedAt: string;
};
