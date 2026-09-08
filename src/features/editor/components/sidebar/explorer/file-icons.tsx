import React from "react";
import {
  FileCode2,
  FileText,
  Image,
  FileType,
  BookText,
  Braces,
} from "lucide-react";

export function getFileIcon(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "tex" || ext === "sty" || ext === "cls") {
    return <FileCode2 className="size-4 text-success shrink-0" />;
  }
  if (ext === "bib") {
    return <BookText className="size-4 text-warning shrink-0" />;
  }
  if (ext === "json") {
    return <Braces className="size-4 text-warning shrink-0" />;
  }
  if (["png", "jpg", "jpeg", "svg", "gif", "webp", "pdf", "eps"].includes(ext)) {
    return <Image className="size-4 text-primary shrink-0" />;
  }
  if (["ttf", "otf", "woff", "woff2"].includes(ext)) {
    return <FileType className="size-4 text-foreground shrink-0" />;
  }
  return <FileText className="size-4 text-muted-foreground shrink-0" />;
}
