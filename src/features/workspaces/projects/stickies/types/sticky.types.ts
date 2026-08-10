import { z } from "zod";
import { 
  StickyLabelSchema, 
  StickyColorSchema, 
  StickySchema, 
  StickyChildLinkSchema 
} from "../schemas/sticky.schema";

export type Label = z.infer<typeof StickyLabelSchema>;

export type StickyColor = z.infer<typeof StickyColorSchema>;

export const STICKY_COLOR_MAP: Record<
  StickyColor,
  {
    bg: string;
    text: string;
    border?: string;
  }
> = {
  "cyan-1": { bg: "#B3EBF2", text: "#134E4A" },
  "cyan-2": { bg: "#85D1DB", text: "#083344" },
  "mint-1": { bg: "#B6F2D1", text: "#064E3B" },
  "mint-2": { bg: "#C9FDF2", text: "#115E59" },
  "yellow-1": { bg: "#FFFFC5", text: "#713F12" },
  "lavender-1": { bg: "#CEC4FF", text: "#3730A3" },
  "pink-1": { bg: "#F4C4FF", text: "#701A75" },
  "purple-1": { bg: "#754480", text: "#FAE8FF" },
  default: { bg: "#ffffff", text: "#111827", border: "#e5e7eb" },
  yellow: { bg: "#fff9c4", text: "#713f12", border: "#fde68a" },
  green: { bg: "#dcfce7", text: "#064e3b", border: "#86efac" },
  blue: { bg: "#dbeafe", text: "#1e3a8a", border: "#93c5fd" },
  pink: { bg: "#fce7f3", text: "#831843", border: "#f9a8d4" },
  purple: { bg: "#f3e8ff", text: "#581c87", border: "#d8b4fe" },
};

export const STICKY_COLOR_CYCLE = [
  "cyan-1",
  "cyan-2",
  "mint-1",
  "mint-2",
  "yellow-1",
  "lavender-1",
  "pink-1",
  "purple-1",
] as StickyColor[];

export type Sticky = z.infer<typeof StickySchema>;

export type StickyChildLink = z.infer<typeof StickyChildLinkSchema>;

export type NoteColor = StickyColor;
export const NOTE_COLOR_MAP = STICKY_COLOR_MAP;
export const NOTE_COLOR_CYCLE = STICKY_COLOR_CYCLE;
export type Note = Sticky;
