import React, { useState, useCallback, useRef } from "react";
import { Outlet, useParams } from "react-router";
import ToolBar from "./ToolBar";
import SideBar from "./SideBar/SideBar";
import Viewer from "./Viewer/Viewer";

interface ResizeHandleProps {
  onMouseDown: (e: React.MouseEvent) => void;
}

function ResizeHandle({ onMouseDown }: ResizeHandleProps) {
  return (
    <div
      className="w-1 hover:w-1 bg-transparent hover:bg-primary/20 border-r cursor-col-resize shrink-0 transition-colors group relative"
      onMouseDown={onMouseDown}
    >
      <div className="absolute inset-y-0 -left-1 -right-1" />
    </div>
  );
}

export default function PageLayout() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [sidebarWidth, setSidebarWidth] = useState(320);
  // editorFlex is the ratio of editor width to the total (editor + viewer) width
  // 0.5 means 50% editor, 50% viewer
  const [editorFlex, setEditorFlex] = useState(0.5);

  const minSidebarWidth = 200;
  const maxSidebarWidth = 500;
  const minEditorFlex = 0.2;
  const maxEditorFlex = 0.8;

  const handleSidebarResize = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startWidth = sidebarWidth;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const delta = moveEvent.clientX - startX;
        const newWidth = Math.min(
          Math.max(startWidth + delta, minSidebarWidth),
          maxSidebarWidth
        );
        setSidebarWidth(newWidth);
      };

      const handleMouseUp = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [sidebarWidth]
  );

  const handleEditorViewerResize = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const container = containerRef.current;
      if (!container) return;

      const containerRect = container.getBoundingClientRect();
      const availableWidth = containerRect.width - sidebarWidth - 8; // 8px for resize handles

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const mouseX =
          moveEvent.clientX - containerRect.left - sidebarWidth - 4;
        const newFlex = Math.min(
          Math.max(mouseX / availableWidth, minEditorFlex),
          maxEditorFlex
        );
        setEditorFlex(newFlex);
      };

      const handleMouseUp = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [sidebarWidth]
  );

  return (
    <div className="flex flex-col h-screen">
      <ToolBar />
      <div ref={containerRef} className="flex-1 flex h-full overflow-hidden">
        <div style={{ width: sidebarWidth }} className="shrink-0">
          <SideBar />
        </div>
        <ResizeHandle onMouseDown={handleSidebarResize} />
        <div style={{ flex: editorFlex }} className="min-w-0">
          <Outlet />
        </div>
        <ResizeHandle onMouseDown={handleEditorViewerResize} />
        <div style={{ flex: 1 - editorFlex }} className="min-w-0">
          <Viewer />
        </div>
      </div>
    </div>
  );
}
