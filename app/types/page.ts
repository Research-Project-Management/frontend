export type Page = {
  _id: string;
  title: string;
  content: any; // JSON structure for editor
  status: "draft" | "approved" | "archived";
  project: string | { _id: string; name: string }; // Project ID or populated object
  author: {
    _id: string;
    name: string;
    avatar?: string;
  };
  views: number;
  lastAccessedAt: string;
  createdAt: string;
  updatedAt: string;
};
