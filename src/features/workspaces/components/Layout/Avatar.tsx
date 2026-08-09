import React from "react";
import { cn } from "@/shared/lib/utils";
import { API_BASE_URL } from "@/shared/constants";

function resolveFileUrl(url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) {
    return url;
  }
  return `${API_BASE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
}

function useBlobUrl(url?: string | null) {
  const [blobUrl, setBlobUrl] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState<boolean>(false);

  React.useEffect(() => {
    if (!url) {
      setBlobUrl(null);
      setLoading(false);
      return;
    }
    let isMounted = true;
    let objectUrlToClean: string | null = null;

    async function fetchBlob() {
      try {
        setLoading(true);
        const res = await fetch(url!, { credentials: "include" });
        if (res.ok) {
          const blob = await res.blob();
          if (isMounted) {
            objectUrlToClean = URL.createObjectURL(blob);
            setBlobUrl(objectUrlToClean);
          }
        }
      } catch {
        // ignore
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    fetchBlob();
    return () => {
      isMounted = false;
      if (objectUrlToClean) URL.revokeObjectURL(objectUrlToClean);
    };
  }, [url]);

  return { blobUrl, loading };
}

type AvatarProps = {
  src?: string | null;
  name: string;
  className?: string;
  fallbackType?: "workspace" | "user";
};

export const Avatar = ({ src, name, className, fallbackType = "user" }: AvatarProps) => {
  // Normalize the URL — handles relative paths and legacy localhost URLs
  const normalizedSrc = resolveFileUrl(src) ?? src;
  const isInternalProxy = normalizedSrc?.includes("/api/files/");
  const fullUrl = normalizedSrc ?? undefined;

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
          referrerPolicy="no-referrer"
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
