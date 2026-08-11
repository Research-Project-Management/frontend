import { useState, useEffect } from 'react';
import { API_BASE_URL } from '@/shared/constants';
import { fetchBlobService } from '../services/file-fetch.services';

export function useBlobUrl(url: string | null) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
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
        setError(null);

        const fullUrl = url!.startsWith('http') ? url! : `${API_BASE_URL}${url!.startsWith('/') ? '' : '/'}${url!}`;
        const blob = await fetchBlobService(fullUrl);
        if (isMounted) {
          objectUrlToClean = URL.createObjectURL(blob);
          setBlobUrl(objectUrlToClean);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchBlob();

    return () => {
      isMounted = false;
      if (objectUrlToClean) {
        URL.revokeObjectURL(objectUrlToClean);
      }
    };
  }, [url]);

  return { blobUrl, loading, error };
}

export async function downloadFileAsBlob(url: string, filename: string) {
  try {
    const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
    const blob = await fetchBlobService(fullUrl);
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(blobUrl);
  } catch (err) {
    console.error('Download error:', err);
  }
}

export function resolveFileUrl(url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:') || url.startsWith('blob:')) {
    return url;
  }
  return `${API_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}

export default useBlobUrl;
