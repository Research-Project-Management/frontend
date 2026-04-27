import type { NoteColor } from "./noteColor.type";
import type { TypeUser } from "~/types/user";
export interface Tag {
  _id: string;
  id?: string;
  name: string;
  color: string;
  projectId: string;
}

export interface Note {
  _id: string; // MongoDB ID
  id?: string; // Fallback helper if needed
  title: string;
  content: string;
  color: NoteColor;
  tags: Tag[];
  author: TypeUser;
  createdAt: string;
  updatedAt: string;
  workspace: string;
  position?: {
    x: number;
    y: number;
  };
}

