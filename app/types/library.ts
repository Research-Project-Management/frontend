// ── Library types ─────────────────────────────────────────────────────────────

export type Collection = {
  _id: string;
  name: string;
  description: string;
  color: string;
  icon: string;
  workspace: string;
  parent: string | null;
  createdBy: {
    _id: string;
    name: string;
    email: string;
    avatar: string;
  };
  paperCount: number;
  createdAt: string;
  updatedAt: string;
};

export type Paper = {
  _id: string;
  title: string;
  authors: string[];
  year: number | null;
  doi: string;
  abstract: string;
  keywords: string[];
  journal: string;
  publisher: string;
  fileUrl: string;
  filename: string;
  mimeType: string;
  size: number;
  tags: string[];
  ragDocId: string | null;
  ragStatus: "pending" | "indexed" | "failed" | null;
  ragIndexedAt: string | null;
  workspace: string;
  collection: string | null;
  uploadedBy: {
    _id: string;
    name: string;
    email: string;
    avatar: string;
  };
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProjectPaperRef = {
  paper: Paper | null; // null = deleted paper (soft-delete)
  addedBy: string;
  note: string;
  addedAt: string;
};

export type ProjectCollection = {
  _id: string;
  name: string;
  description: string;
  project: string;
  workspace: string;
  createdBy: {
    _id: string;
    name: string;
    email: string;
    avatar: string;
  };
  sourceCollection: {
    _id: string;
    name: string;
    color: string;
    icon: string;
  } | null;
  papers: ProjectPaperRef[];
  createdAt: string;
  updatedAt: string;
};
