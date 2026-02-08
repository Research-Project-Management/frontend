import { Outlet } from 'react-router';
import SideBar from './SideBar';

export default function StorageLayout() {
    return (
        <div className="h-full flex overflow-hidden">
            <aside className="border-r">
                <SideBar />
            </aside>

            <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
                <main className="flex-1 min-h-0 overflow-y-auto">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
