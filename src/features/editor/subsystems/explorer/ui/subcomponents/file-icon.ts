import {
  FileCode2,
  BookText,
  Braces,
  FileType,
  Image,
} from 'lucide-react';

const COLORED_ICONS = {
  tex: { icon: FileCode2, color: 'text-primary' },
  bib: { icon: BookText, color: 'text-foreground/85' },
  cls: { icon: Braces, color: 'text-foreground/70' },
  txt: { icon: FileType, color: 'text-muted-foreground' },
  img: { icon: Image, color: 'text-muted-foreground' },
  default: { icon: FileCode2, color: 'text-muted-foreground' },
} as const;

const MONOCHROME_ICONS = {
  tex: { icon: FileCode2, color: 'text-foreground' },
  bib: { icon: BookText, color: 'text-foreground' },
  cls: { icon: Braces, color: 'text-foreground' },
  txt: { icon: FileType, color: 'text-foreground' },
  img: { icon: Image, color: 'text-foreground' },
  default: { icon: FileCode2, color: 'text-foreground' },
} as const;

export function getFileIcon(filename: string, options?: { monochrome?: boolean }) {
  const palette = options?.monochrome ? MONOCHROME_ICONS : COLORED_ICONS;
  const ext = filename?.split('.').pop()?.toLowerCase() ?? '';
  switch (ext) {
    case 'tex':
    case 'ltx':
    case 'dtx':
      return palette.tex;
    case 'bib':
    case 'bst':
      return palette.bib;
    case 'cls':
    case 'sty':
    case 'ins':
      return palette.cls;
    case 'md':
    case 'txt':
      return palette.txt;
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'svg':
    case 'gif':
    case 'webp':
    case 'eps':
    case 'pdf':
      return palette.img;
    default:
      return palette.default;
  }
}
