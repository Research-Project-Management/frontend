import React, { createContext, useContext, useRef, useState } from "react";
import type { Page } from "~/types/page";
import type { editor as MonacoEditor } from "monaco-editor";

export interface AssetInfo {
  _id: string;
  filename: string;
  url?: string;
  mimeType?: string;
  size?: number;
}

interface PageContextType {
  /** Callback ref set by EditorLayout so Viewer can grab the current active editor text. */
  getEditorContent: React.MutableRefObject<(() => string) | null>;
  /** Monaco editor instance — set by EditorLayout, used by SearchTab and others. */
  editorRef: React.MutableRefObject<MonacoEditor.IStandaloneCodeEditor | null>;
  /** Compile function ref — set by Viewer so ToolBar/Menu can trigger compilation. */
  compileRef: React.MutableRefObject<(() => Promise<void>) | null>;
  /** The currently-open root page, synced by EditorLayout on load. */
  currentPage: Page | null;
  setCurrentPage: React.Dispatch<React.SetStateAction<Page | null>>;
  /** Scroll Viewer to a given PDF page (1-based); registered by Viewer, called by OutlineTab. */
  gotoPageRef: React.MutableRefObject<((page: number) => void) | null>;
  /** Loaded PDFDocumentProxy from react-pdf; stored by Viewer on load, read by OutlineTab. */
  pdfDocRef: React.MutableRefObject<any>;
  /** Scroll Monaco editor to a specific line; registered by Editor on mount. */
  scrollToLineRef: React.MutableRefObject<((line: number) => void) | null>;
  /** Scroll PDF viewer to the page that corresponds to a given editor line; registered by Viewer. */
  scrollToPdfLineRef: React.MutableRefObject<((line: number) => void) | null>;
  /**
   * List of .tex filenames in the current project (populated by FilesTab after files load).
   * Used by SettingsPanel to populate the main-file dropdown.
   */
  texFiles: string[];
  setTexFiles: React.Dispatch<React.SetStateAction<string[]>>;
  /**
   * When an image asset tab is open, this holds its metadata so EditorLayout can
   * render an image viewer instead of Monaco.
   */
  selectedAsset: AssetInfo | null;
  setSelectedAsset: React.Dispatch<React.SetStateAction<AssetInfo | null>>;
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
  const [currentPage, setCurrentPage] = useState<Page | null>(null);
  const gotoPageRef = useRef<((page: number) => void) | null>(null);
  const pdfDocRef = useRef<any>(null);
  const scrollToLineRef = useRef<((line: number) => void) | null>(null);
  const scrollToPdfLineRef = useRef<((line: number) => void) | null>(null);
  const [texFiles, setTexFiles] = useState<string[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<AssetInfo | null>(null);

  return (
    <PageContext.Provider
      value={{
        getEditorContent,
        editorRef,
        compileRef,
        currentPage,
        setCurrentPage,
        gotoPageRef,
        pdfDocRef,
        scrollToLineRef,
        scrollToPdfLineRef,
        texFiles,
        setTexFiles,
        selectedAsset,
        setSelectedAsset,
      }}
    >
      {children}
    </PageContext.Provider>
  );
}
