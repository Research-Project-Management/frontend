import { useState, useEffect } from "react";

/**
 * Fetches a file URL with credentials and returns a blob URL.
 * Automatically revokes the blob URL on cleanup or URL change.
 *
 * Usage:
 *   const { blobUrl, loading, error } = useBlobUrl(item.url);
 *   <img src={blobUrl || item.url} />
 */
export function useBlobUrl(url: string | undefined | null) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!url) {
      setBlobUrl(null);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;

    setLoading(true);
    setError(null);

    fetch(url, { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
        return res.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("useBlobUrl error:", err);
        setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);

  return { blobUrl, loading, error };
}

/**
 * Downloads a file by fetching it as a blob with credentials,
 * then triggering a download with the correct filename.
 */
export async function downloadFileAsBlob(
  url: string,
  filename: string,
): Promise<void> {
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) throw new Error(`Download failed: ${response.status}`);

  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();

  // Cleanup
  setTimeout(() => {
    URL.revokeObjectURL(blobUrl);
    document.body.removeChild(link);
  }, 100);
}
