'use client';

import React, { createContext, useContext, useRef, useEffect, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { usePage } from '@/features/workspaces/projects';
import type { Page } from "@/features/workspaces/projects/types/page.types";
import { Skeleton } from "@/shared/components/ui";
import dynamic from "next/dynamic";
const Editor = dynamic(() => import("./Editor"), { ssr: false });
import TabBar from "./TabBar";
import type { editor } from "monaco-editor";
import { usePageContext, type AssetInfo } from "@/features/editor/store/page-context";

import { useDocumentTitle } from '@/features/editor/hooks/use-document-title';
import { useEditorTabsStore } from "@/features/editor/store/editor-tabs.store";
import { useEditorSettingsStore } from "@/features/editor/store/editor-settings.store";
import { FileImage, AlertCircle, FileCode2 } from "lucide-react";
import { resolveFileUrl } from '@/features/editor/hooks/use-blob-url';
import { useEditorLayout } from '../../hooks/use-editor-layout';

export const EditorContext = createContext<{ editorRef: React.MutableRefObject<editor.IStandaloneCodeEditor | null> | null }>({ editorRef: null });

export const useEditorContext = () => {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error("useEditorContext must be used within EditorLayout");
  return ctx;
};

// ---------------- Inline image viewer rendered inside the editor column ----------------

function ImagePanel({ asset }: { asset: AssetInfo }) {
  const ext = asset.filename.split(".").pop()?.toUpperCase() ?? "";
  const sizeLabel = asset.size
    ? asset.size < 1024
      ? `${asset.size} B`
      : asset.size < 1024 * 1024
        ? `${(asset.size / 1024).toFixed(1)} KB`
        : `${(asset.size / (1024 * 1024)).toFixed(1)} MB`
    : null;

  return (
    <div className="flex flex-col h-full w-full bg-background">
      {/* Info bar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border text-xs text-muted-foreground shrink-0">
        <FileImage className="size-3.5" />
        <span className="font-medium text-foreground truncate">{asset.filename}</span>
        {ext && (
          <span className="px-1.5 py-0.5 rounded bg-secondary font-mono">{ext}</span>
        )}
        {sizeLabel && <span>{sizeLabel}</span>}
      </div>
      {/* Image viewer */}
      <div className="flex-1 flex items-center justify-center p-8 overflow-auto">
        {asset.url ? (
          <img
            src={resolveFileUrl(asset.url) || ""}
            alt={asset.filename}
            crossOrigin="use-credentials"
            className="max-w-full max-h-full object-contain rounded shadow-sm"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <AlertCircle className="size-6" />
            <span className="text-sm">Image URL not available.</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------- Empty state when no file is open ----------------

function EmptyEditorState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 select-none">
      <FileCode2 className="size-10 text-muted-foreground/20" />
      <p className="text-sm text-muted-foreground">No file open</p>
      <p className="text-xs text-muted-foreground/60">
        Open a file from the Explorer to start editing.
      </p>
    </div>
  );
}

// ---------------- Editor layout ----------------

export default function EditorLayout() {
  const { isLoading, activePage, isAssetTab, displayPage, pageId, fileId, selectedAsset, editorRef } = useEditorLayout();

  if (isLoading) {
    return (
      <div className="h-full w-full flex flex-col animate-in fade-in duration-300">
        {/* Toolbar skeleton */}
        <div className="h-11 border-b border-border flex items-center gap-2 px-3">
          <Skeleton className="h-5 w-5 rounded" />
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-16" />
          <div className="flex-1" />
          <Skeleton className="h-6 w-6 rounded" />
          <Skeleton className="h-6 w-6 rounded" />
        </div>
        {/* TabBar skeleton */}
        <div className="h-11 border-b border-border bg-muted/20 flex items-center gap-px px-1">
          {[90, 110, 75].map((w, i) => (
            <Skeleton key={i} className="h-5 rounded" style={{ width: w }} />
          ))}
        </div>
        {/* Code lines skeleton */}
        <div className="flex-1 bg-[var(--editor-bg,hsl(var(--background)))] p-4 space-y-2">
          {Array.from({ length: 24 }).map((_, i) => {
            const widths = ["60%", "45%", "75%", "30%", "55%", "80%", "40%", "65%", "20%", "70%", "50%", "35%"];
            return (
              <div key={i} className="flex items-center gap-3">
                <span className="w-8 text-right">
                  <Skeleton className="h-3.5 w-5 ml-auto" />
                </span>
                <Skeleton
                  className="h-3.5 rounded-sm"
                  style={{ width: widths[i % widths.length] }}
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (!activePage) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Page not found</p>
      </div>
    );
  }

  return (
    <EditorContext.Provider value={{ editorRef }}>
      <div className="h-full w-full overflow-hidden flex flex-col">
        {/* Tab bar */}
        {pageId && <TabBar rootPageId={pageId} activeFileId={fileId ?? activePage?._id ?? ""} />}
        <div className="flex-1 overflow-hidden">
          {/* Editor / Asset panel */}
          {isAssetTab ? (
            <ImagePanel asset={selectedAsset!} />
          ) : displayPage ? (
            <Editor page={displayPage} />
          ) : (
            <EmptyEditorState />
          )}
        </div>
      </div>
    </EditorContext.Provider>
  );
}
