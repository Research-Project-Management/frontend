import { Outlet, useLocation } from "react-router";
import LibrarySideBar from "./LibrarySideBar";

export default function LibraryLayout() {
  const location = useLocation();
  const isReader = location.pathname.includes("/reader");

  return (
    <div className="h-full flex overflow-hidden">
      {!isReader && (
        <aside className="shrink-0">
          <LibrarySideBar />
        </aside>
      )}

      <div className="flex-1 min-w-0 flex flex-col overflow-hidden bg-background">
        <main className={`flex-1 min-h-0 relative ${isReader ? "flex flex-col" : "overflow-y-auto"}`}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
