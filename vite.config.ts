import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import svgr from "vite-plugin-svgr";
import devtoolsJson from 'vite-plugin-devtools-json';
export default defineConfig({
  plugins: [tailwindcss(), reactRouter(), tsconfigPaths(), svgr(), devtoolsJson()],
  appType: "spa",
  server: {
    port: 2916,
    strictPort: true,
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Core React ecosystem
          if (id.includes("node_modules/react/") ||
              id.includes("node_modules/react-dom/") ||
              id.includes("node_modules/react-router/") ||
              id.includes("node_modules/scheduler/")) {
            return "vendor-react";
          }
          // TipTap editor
          if (id.includes("node_modules/@tiptap/") ||
              id.includes("node_modules/prosemirror") ||
              id.includes("node_modules/@hocuspocus/")) {
            return "vendor-tiptap";
          }
          // PDF viewer
          if (id.includes("node_modules/react-pdf/") ||
              id.includes("node_modules/pdfjs-dist/")) {
            return "vendor-pdf";
          }
          // Monaco editor
          if (id.includes("node_modules/monaco-editor/") ||
              id.includes("node_modules/@monaco-editor/")) {
            return "vendor-monaco";
          }
          // DnD kit
          if (id.includes("node_modules/@dnd-kit/")) {
            return "vendor-dndkit";
          }
          // Radix UI
          if (id.includes("node_modules/@radix-ui/")) {
            return "vendor-radix";
          }
          // TanStack
          if (id.includes("node_modules/@tanstack/")) {
            return "vendor-tanstack";
          }
        },
      },
    },
  },
});
