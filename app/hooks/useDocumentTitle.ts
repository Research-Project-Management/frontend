import { useEffect } from "react";

/**
 * Custom hook to dynamically change the document title.
 * Automatically restores the previous title when the component unmounts.
 * 
 * @param title The title to set (e.g., "Overview")
 * @param suffix Optional suffix (defaults to "Flux")
 */
export function useDocumentTitle(title: string | undefined | null, suffix: string = "Flux") {
  useEffect(() => {
    if (!title) return;
    const originalTitle = document.title;
    
    // Format: "Title · Suffix" or just "Title" if suffix is empty
    document.title = suffix ? `${title} · ${suffix}` : title;
    
    return () => {
      document.title = originalTitle;
    };
  }, [title, suffix]);
}
