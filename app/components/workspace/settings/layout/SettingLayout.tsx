import React from "react";
import { Outlet, useLocation } from "react-router";
import SideBar from "./SideBar";
import TopBar from "./TopBar";
import { motion, AnimatePresence } from "framer-motion";

export default function SettingLayout() {
  const location = useLocation();
  return (
    <div className="h-full flex overflow-hidden">
      <aside className="border-r">
        <SideBar />
      </aside>

      <div className="flex-1 min-w-0 flex flex-col overflow-hidden relative">
        <main className="flex-1 min-h-0 overflow-y-auto relative">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 12, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -12, filter: "blur(4px)" }}
              transition={{ 
                duration: 0.25, 
                ease: [0.22, 1, 0.36, 1] 
              }}
              className="h-full w-full"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
