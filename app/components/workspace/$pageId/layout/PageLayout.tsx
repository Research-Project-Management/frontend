import React, { useState, useCallback, useRef } from "react";
import { Outlet } from "react-router";
import SideBar from "./SideBar/SideBar";
import Viewer from "./Viewer/Viewer";
import ToolBar from "./ToolBar";
import SettingsPanel from "./SettingsPanel";
import { PageContextProvider, usePageContext } from "./PageContext";
import { useEditorSettingsStore } from "~/stores/editor-settings";

function ResizeHandle({
  onMouseDown,
}: {
  onMouseDown: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      onMouseDown={onMouseDown}
      className="w-px bg-border hover:bg-primary/40 active:bg-primary/60 cursor-col-resize shrink-0 transition-colors relative"
    >
      {/* wider hit area */}
      <div className="absolute inset-y-0 -left-1 -right-1" />
    </div>
  );
}

/** Inner component so it can consume PageContext (layout state) */
function PageInner() {
  const { layout, sidebarWidth, editorFlex, setSidebarWidth, setEditorFlex, settingsPanelOpen } =
    useEditorSettingsStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const sidebarWidthRef = useRef(sidebarWidth);
  const editorFlexRef = useRef(editorFlex);

  // Keep state as local for smooth dragging, initialised from store
  const [localSidebarWidth, setLocalSidebarWidth] = useState(sidebarWidth);
  const [localEditorFlex, setLocalEditorFlex] = useState(editorFlex);

  const MIN_SIDEBAR = 180;
  const MAX_SIDEBAR = 500;
  const MIN_EDITOR_FLEX = 0.2;
  const MAX_EDITOR_FLEX = 0.8;

  const handleSidebarResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = sidebarWidthRef.current;

    const onMove = (ev: MouseEvent) => {
      const newW = Math.min(
        Math.max(startWidth + (ev.clientX - startX), MIN_SIDEBAR),
        MAX_SIDEBAR,
      );
      sidebarWidthRef.current = newW;
      setLocalSidebarWidth(newW);
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      setSidebarWidth(sidebarWidthRef.current);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  const handleEditorViewerResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const available = rect.width - sidebarWidthRef.current - 2;

    const onMove = (ev: MouseEvent) => {
      const mouseX = ev.clientX - rect.left - sidebarWidthRef.current - 1;
      const newFlex = Math.min(
        Math.max(mouseX / available, MIN_EDITOR_FLEX),
        MAX_EDITOR_FLEX,
      );
      editorFlexRef.current = newFlex;
      setLocalEditorFlex(newFlex);
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      setEditorFlex(editorFlexRef.current);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  const showEditor = layout !== "viewer-only";
  const showViewer = layout !== "editor-only";
  const showDivider = layout === "split";

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      <ToolBar />
      <div ref={containerRef} className="flex-1 flex overflow-hidden">
        {/* Sidebar — always visible */}
        <div
          style={{ width: localSidebarWidth }}
          className="shrink-0 overflow-hidden"
        >
          <SideBar />
        </div>
        <ResizeHandle onMouseDown={handleSidebarResize} />

        {/* Editor panel */}
        {showEditor && (
          <div
            style={{ flex: showDivider ? localEditorFlex : 1 }}
            className="min-w-0 overflow-hidden"
          >
            <Outlet />
          </div>
        )}

        {/* Editor ↔ Viewer splitter — only in split mode */}
        {showDivider && <ResizeHandle onMouseDown={handleEditorViewerResize} />}

        {/* Viewer panel */}
        {showViewer && (
          <div
            style={{ flex: showDivider ? 1 - localEditorFlex : 1 }}
            className="min-w-0 overflow-hidden"
          >
            <Viewer />
          </div>
        )}

        {/* Settings panel — right edge */}
        {settingsPanelOpen && <SettingsPanel />}
      </div>
    </div>
  );
}

export default function PageLayout() {
  return (
    <PageContextProvider>
      <PageInner />
    </PageContextProvider>
  );
}
