import { Outlet, useParams } from 'react-router';
import SideBar from './SideBar';
import { useProjects } from '~/hooks/useWorkspace';
import { Cloud, ChevronRight } from 'lucide-react';

export default function StorageLayout() {
    const { projectId } = useParams();
    const { projects } = useProjects();
    const currentProject = projects?.find((p) => p._id === projectId);

    return (
        <div className="h-full flex overflow-hidden">
            <aside className="border-r">
                <SideBar />
            </aside>

            <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
                {projectId && currentProject && (
                    <header className="shrink-0 border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-10">
                        <div className="flex items-center justify-between px-4 h-13">
                            <div className="flex items-center gap-2.5">
                                <div className="flex items-center gap-2">
                                    <span className="text-base leading-none">
                                        {currentProject.avatar}
                                    </span>
                                    <span className="text-sm font-semibold text-primary truncate max-w-[120px]">
                                        {currentProject.name}
                                    </span>
                                </div>
                                <ChevronRight className="size-3.5 text-muted-foreground/50" />
                                <div className="flex items-center gap-2">
                                    <Cloud className="size-4.5 text-primary" />
                                    <h1 className="text-sm font-semibold text-primary transition-all duration-300">
                                        Storage
                                    </h1>
                                </div>
                            </div>
                        </div>
                    </header>
                )}
                <main className="flex-1 min-h-0 overflow-y-auto">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
