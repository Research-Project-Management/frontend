import { Outlet, useParams, useLocation } from 'react-router';
import SideBar from './SideBar';
import { useProjects } from '~/hooks/useWorkspace';
import { Cloud, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from "framer-motion";

export default function StorageLayout() {
    const { projectId } = useParams();
    const location = useLocation();
    const { projects } = useProjects();
    const currentProject = projects?.find((p: { _id: string | undefined; }) => p._id === projectId);

    return (
        <div className="h-full flex overflow-hidden">
            <aside className="shrink-0">
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
