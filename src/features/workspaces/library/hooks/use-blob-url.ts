import { API_BASE_URL } from "@/shared/constants";

export function resolveFileUrl(fileUrl?: string | null): string {
  if (!fileUrl) return "";
  if (fileUrl.startsWith("http://") || fileUrl.startsWith("https://") || fileUrl.startsWith("blob:")) {
    return fileUrl;
  }
  const cleanUrl = fileUrl.startsWith("/") ? fileUrl : `/${fileUrl}`;
  return `${API_BASE_URL}${cleanUrl}`;
}
