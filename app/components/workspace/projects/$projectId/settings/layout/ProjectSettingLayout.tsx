import { Outlet } from "react-router";
import ProjectSettingSidebar from "./ProjectSettingSidebar";

export default function ProjectSettingLayout() {
  return (
    <div className="h-full flex overflow-hidden">
      <aside className="border-r">
        <ProjectSettingSidebar />
      </aside>

      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <main className="flex-1 min-h-0 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
