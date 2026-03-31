import React from "react";
import { useBlobUrl } from "~/hooks/useBlobUrl";
import { cn } from "~/lib/utils";
import { API_URL } from "~/lib/api";

type AvatarProps = {
  src?: string | null;
  name: string;
  className?: string;
  fallbackType?: "workspace" | "user";
};

export const Avatar = ({ src, name, className, fallbackType = "user" }: AvatarProps) => {
  // Only use useBlobUrl for internal proxy URLs that require authentication
  const isInternalProxy = src?.startsWith("/api/files/") || (src && src.includes("/api/files/"));
  const fullUrl = isInternalProxy && src?.startsWith("/") ? `${API_URL}${src}` : src;

  // We only call useBlobUrl if it's an internal proxy URL
  const { blobUrl, loading } = useBlobUrl(isInternalProxy ? fullUrl : null);

  const initial = (name || "U").charAt(0).toUpperCase();
  const fallbackUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(name || (fallbackType === 'workspace' ? 'Workspace' : 'User'))}&background=eee&color=888`;

  // Determine final source
  const displaySrc = isInternalProxy ? blobUrl : src;

  return (
    <div className={cn("relative shrink-0 overflow-hidden bg-muted flex items-center justify-center font-semibold text-muted-foreground uppercase", className)}>
      {displaySrc ? (
        <img
          src={displaySrc}
          alt={name}
          className="size-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).src = fallbackUrl;
          }}
        />
      ) : (
        <span>{initial}</span>
      )}
      {loading && isInternalProxy && (
        <div className="absolute inset-0 bg-background/20 flex items-center justify-center">
            <div className="size-full animate-pulse bg-muted" />
        </div>
      )}
    </div>
  );
};
