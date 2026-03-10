import React, { createContext, useContext, useRef, useState } from "react";
import type { Page } from "~/types/page";
import type { editor as MonacoEditor } from "monaco-editor";

interface PageContextType {
  /** Callback ref set by EditorLayout so Viewer can grab the current editor text at compile time. */
  getEditorContent: React.MutableRefObject<(() => string) | null>;
  /** Monaco editor instance — set by EditorLayout, used by SearchTab and others. */
  editorRef: React.MutableRefObject<MonacoEditor.IStandaloneCodeEditor | null>;
  /** Compile function ref — set by Viewer so ToolBar/Menu can trigger compilation. */
  compileRef: React.MutableRefObject<(() => Promise<void>) | null>;
  pdfUrl: string | null;
  setPdfUrl: (url: string | null) => void;
  isCompiling: boolean;
  setIsCompiling: React.Dispatch<React.SetStateAction<boolean>>;
  compileLog: string | null;
  setCompileLog: React.Dispatch<React.SetStateAction<string | null>>;
  /** The currently-open page, synced by EditorLayout on load. */
  currentPage: Page | null;
  setCurrentPage: React.Dispatch<React.SetStateAction<Page | null>>;
  /** Scroll Viewer to a given PDF page (1-based); registered by Viewer, called by OutlineTab. */
  gotoPageRef: React.MutableRefObject<((page: number) => void) | null>;
  /** Loaded PDFDocumentProxy from react-pdf; stored by Viewer on load, read by OutlineTab. */
  pdfDocRef: React.MutableRefObject<any>;
}

const PageContext = createContext<PageContextType | null>(null);

export function usePageContext(): PageContextType {
  const ctx = useContext(PageContext);
  if (!ctx) {
    throw new Error("usePageContext must be used within PageContextProvider");
  }
  return ctx;
}

export function PageContextProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const getEditorContent = useRef<(() => string) | null>(null);
  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
  const compileRef = useRef<(() => Promise<void>) | null>(null);
  const [pdfUrl, setPdfUrlState] = useState<string | null>(null);
  const [isCompiling, setIsCompiling] = useState(false);
  const [compileLog, setCompileLog] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<Page | null>(null);
  const gotoPageRef = useRef<((page: number) => void) | null>(null);
  const pdfDocRef = useRef<any>(null);

  // Revoke previous blob URL before setting a new one to prevent memory leaks.
  const setPdfUrl = (url: string | null) => {
    setPdfUrlState((prev) => {
      if (prev && prev.startsWith("blob:")) URL.revokeObjectURL(prev);
      return url;
    });
  };

  return (
    <PageContext.Provider
      value={{
        getEditorContent,
        editorRef,
        compileRef,
        pdfUrl,
        setPdfUrl,
        isCompiling,
        setIsCompiling,
        compileLog,
        setCompileLog,
        currentPage,
        setCurrentPage,
        gotoPageRef,
        pdfDocRef,
      }}
    >
      {children}
    </PageContext.Provider>
  );
}
