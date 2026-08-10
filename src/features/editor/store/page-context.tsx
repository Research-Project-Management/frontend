'use client';
import React, { createContext, useContext } from 'react';
import type { RefObject } from 'react';
import type { editor } from 'monaco-editor';

export interface AssetInfo {
  _id?: string;
  url?: string;
  filename: string;
  size?: number;
  mimeType?: string;
}

interface PageContextType {
  getEditorContent: React.MutableRefObject<(() => string) | null>;
  setCurrentPage: (page: any) => void;
  setWorkspaceId: (id: string) => void;
  editorRef: React.MutableRefObject<editor.IStandaloneCodeEditor | null>;
  selectedAsset: AssetInfo | null;
  setSelectedAsset: (asset: AssetInfo | null) => void;
  compileRef: React.MutableRefObject<any>;
  setActiveFilePage: (page: any) => void;
  currentPage: any;
  workspaceId: string;
  activeFilePage: any;
  isAiPreviewingRef: React.MutableRefObject<boolean>;
  scrollToLineRef: React.MutableRefObject<any>;
  scrollToPdfLineRef: React.MutableRefObject<any>;
  gotoPageRef: React.MutableRefObject<any>;
  pdfDocRef: React.MutableRefObject<any>;
  texFiles: string[];
  setTexFiles: (files: string[]) => void;
}

export const PageContext = createContext<PageContextType | null>(null);

export const usePageContext = () => {
  const context = useContext(PageContext);
  if (!context) {
    throw new Error('usePageContext must be used within a PageContextProvider');
  }
  return context;
};

export function PageContextProvider({ children }: { children: React.ReactNode }) {
  const getEditorContent = React.useRef<(() => string) | null>(null);
  const [currentPage, setCurrentPage] = React.useState<any>(null);
  const [workspaceId, setWorkspaceId] = React.useState<string>('');
  const editorRef = React.useRef<editor.IStandaloneCodeEditor | null>(null);
  const [selectedAsset, setSelectedAsset] = React.useState<AssetInfo | null>(null);
  const compileRef = React.useRef<any>(null);
  const [activeFilePage, setActiveFilePage] = React.useState<any>(null);
  
  const isAiPreviewingRef = React.useRef<boolean>(false);
  const scrollToLineRef = React.useRef<any>(null);
  const scrollToPdfLineRef = React.useRef<any>(null);
  const gotoPageRef = React.useRef<any>(null);
  const pdfDocRef = React.useRef<any>(null);
  const [texFiles, setTexFiles] = React.useState<string[]>([]);

  const value = React.useMemo(() => ({
    getEditorContent,
    setCurrentPage,
    setWorkspaceId,
    editorRef,
    selectedAsset,
    setSelectedAsset,
    compileRef,
    setActiveFilePage,
    currentPage,
    workspaceId,
    activeFilePage,
    isAiPreviewingRef,
    scrollToLineRef,
    scrollToPdfLineRef,
    gotoPageRef,
    pdfDocRef,
    texFiles,
    setTexFiles,
  }), [currentPage, workspaceId, selectedAsset, activeFilePage, texFiles]);

  return <PageContext.Provider value={value}>{children}</PageContext.Provider>;
}
