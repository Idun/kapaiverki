



import React from 'react';
import { PenSparkleIcon, SettingsIcon, DocumentTextIcon, LightbulbIcon, InformationCircleIcon, ArchiveBoxIcon, QuestionMarkCircleIcon } from './icons';

interface SidebarProps {
    currentView: 'writer' | 'result' | 'inspiration' | 'settings' | 'about' | 'archive' | 'tips';
    setView: (view: 'writer' | 'result' | 'inspiration' | 'settings' | 'about' | 'archive' | 'tips') => void;
}

// Moved NavItem outside the Sidebar component to prevent re-creation on re-renders.
const NavItem: React.FC<{
    label: string;
    view: 'writer' | 'result' | 'inspiration' | 'settings' | 'about' | 'archive' | 'tips';
    // FIX: Use React.ReactElement instead of JSX.Element to avoid namespace error
    // FIX: Specify props for ReactElement to allow cloning with className.
    icon: React.ReactElement<React.SVGProps<SVGSVGElement>>;
    currentView: 'writer' | 'result' | 'inspiration' | 'settings' | 'about' | 'archive' | 'tips';
    setView: (view: 'writer' | 'result' | 'inspiration' | 'settings' | 'about' | 'archive' | 'tips') => void;
}> = ({ label, view, icon, currentView, setView }) => {
    const isActive = currentView === view;
    return (
        <button
            onClick={() => setView(view)}
            className={`w-full flex flex-col items-center justify-center gap-1.5 px-1 py-3 rounded-md text-xs font-medium transition-colors ${
                isActive ? 'bg-slate-100 text-gray-800 dark:bg-zinc-700 dark:text-zinc-100' : 'text-gray-600 hover:bg-slate-100/60 dark:text-zinc-300 dark:hover:bg-zinc-800'
            }`}
            aria-current={isActive ? 'page' : undefined}
        >
            {React.cloneElement(icon, { className: "w-5 h-5" })}
            <span>{label}</span>
        </button>
    );
};


const Sidebar: React.FC<SidebarProps> = ({ currentView, setView }) => {
    return (
        <aside className="w-24 bg-white p-4 flex flex-col border-r border-gray-200 dark:bg-zinc-900 dark:border-zinc-800">
            <div className="mb-8 text-center">
                <h1 className="text-lg font-bold text-gray-800 dark:text-zinc-100">故事家</h1>
            </div>
            <nav className="flex-grow space-y-2">
                 <NavItem label="卡牌写作" view="writer" icon={<PenSparkleIcon />} currentView={currentView} setView={setView} />
                 <NavItem label="灵感集" view="inspiration" icon={<LightbulbIcon />} currentView={currentView} setView={setView} />
                 <NavItem label="大纲内容" view="result" icon={<DocumentTextIcon />} currentView={currentView} setView={setView} />
                 <NavItem label="故事存档" view="archive" icon={<ArchiveBoxIcon />} currentView={currentView} setView={setView} />
                 <NavItem label="故事技巧" view="tips" icon={<QuestionMarkCircleIcon />} currentView={currentView} setView={setView} />
            </nav>
            <div className="mt-auto space-y-2">
                 <NavItem label="设置" view="settings" icon={<SettingsIcon />} currentView={currentView} setView={setView} />
                 <NavItem label="关于" view="about" icon={<InformationCircleIcon />} currentView={currentView} setView={setView} />
            </div>
        </aside>
    );
};

export default Sidebar;