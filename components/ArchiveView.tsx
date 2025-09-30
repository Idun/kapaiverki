
import React, { useState, useMemo } from 'react';
import type { StoryArchiveItem } from '../types';
import { TrashIcon } from './icons';

interface ArchiveViewProps {
    archive: StoryArchiveItem[];
    onLoadStory: (storyId: string) => void;
    onDeleteStory: (storyId: string) => void;
}

const ArchiveCard: React.FC<{
    item: StoryArchiveItem;
    onLoad: () => void;
    onDelete: () => void;
}> = ({ item, onLoad, onDelete }) => {
    
    const handleDeleteClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onDelete();
    };
    
    return (
        <div 
            className="relative w-64 h-80 rounded-2xl overflow-hidden flex flex-col items-center justify-center transition-transform hover:scale-105 cursor-pointer group border border-gray-200 dark:border-zinc-700/50"
            onClick={onLoad}
        >
            <div className="absolute w-full h-full bg-white dark:bg-zinc-800/30"></div>

            {/* Animated Blob */}
            <div className="absolute z-[1] top-1/2 left-1/2 w-48 h-48 rounded-full bg-purple-300 dark:bg-purple-900/80 opacity-80 filter blur-2xl animate-blob-bounce" />

            {/* Card Content */}
            <div className="absolute top-1.5 left-1.5 w-[calc(100%-12px)] h-[calc(100%-12px)] z-[2] bg-white/80 backdrop-blur-xl rounded-xl overflow-hidden outline-2 outline-white p-4 flex flex-col justify-between dark:bg-zinc-800/80">
                <div>
                    <h3 className="font-bold text-lg text-gray-800 dark:text-zinc-100 break-words">{item.novelInfo.name}</h3>
                    <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1">{new Date(item.lastModified).toLocaleString()}</p>
                </div>
                <p className="text-sm text-gray-600 dark:text-zinc-300 overflow-hidden text-ellipsis" style={{ display: '-webkit-box', WebkitLineClamp: 5, WebkitBoxOrient: 'vertical' }}>
                    {item.novelInfo.synopsis || '无概要'}
                </p>
            </div>

            {/* Delete button */}
            <button
                onClick={handleDeleteClick}
                className="absolute top-3 right-3 z-10 p-2 text-gray-400 hover:text-red-600 rounded-full bg-white/50 hover:bg-red-50 dark:bg-zinc-700/50 dark:hover:bg-red-900/50 opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label={`删除 ${item.novelInfo.name}`}
                title="删除"
            >
                <TrashIcon className="w-4 h-4" />
            </button>
        </div>
    );
};

const ArchiveView: React.FC<ArchiveViewProps> = ({ archive, onLoadStory, onDeleteStory }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState('time'); // 'time' or 'name'

    const filteredAndSortedArchive = useMemo(() => {
        let processedArchive = [...archive];

        // 1. Filter by search term
        if (searchTerm.trim() !== '') {
            processedArchive = processedArchive.filter(item =>
                item.novelInfo.name.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        // 2. Sort the filtered results
        if (sortBy === 'time') {
            // Newest first
            processedArchive.sort((a, b) => b.lastModified - a.lastModified);
        } else if (sortBy === 'name') {
            // Alphabetical A-Z, respecting Chinese characters
            processedArchive.sort((a, b) => a.novelInfo.name.localeCompare(b.novelInfo.name, 'zh-CN'));
        }

        return processedArchive;
    }, [archive, searchTerm, sortBy]);


    return (
        <div className="w-full h-full flex flex-col">
            <header className="flex-shrink-0 mb-6">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-zinc-100">故事存档</h1>
                <p className="mt-2 text-gray-600 dark:text-zinc-300">
                    这里是您保存的所有故事大纲。点击卡片即可载入编辑器继续创作。
                </p>
            </header>

            {/* Search and Sort controls */}
            <div className="flex-shrink-0 mb-6 flex items-center gap-4">
                <div className="relative flex-grow">
                    <input
                        type="text"
                        placeholder="按小说名称搜索..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-400 dark:bg-zinc-700 dark:border-zinc-600 dark:text-white dark:placeholder-zinc-400"
                    />
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                         <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-gray-400 dark:text-zinc-400">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                        </svg>
                    </div>
                </div>
                <div className="relative">
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className="appearance-none w-40 pl-3 pr-8 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-400 bg-white dark:bg-zinc-700 dark:border-zinc-600 dark:text-white"
                        aria-label="排序方式"
                    >
                        <option value="time">按时间排序</option>
                        <option value="name">按名称排序</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700 dark:text-zinc-300">
                        <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                    </div>
                </div>
            </div>

            <div className="flex-grow overflow-y-auto custom-scrollbar -mr-4 pr-4">
                {filteredAndSortedArchive.length > 0 ? (
                    <div className="flex flex-wrap gap-8">
                        {filteredAndSortedArchive.map(item => (
                            <ArchiveCard 
                                key={item.id} 
                                item={item}
                                onLoad={() => onLoadStory(item.id)}
                                onDelete={() => onDeleteStory(item.id)}
                            />
                        ))}
                    </div>
                ) : (
                     <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 dark:text-zinc-400">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-16 h-16 mb-4 text-gray-400 dark:text-zinc-500">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                        </svg>
                        <h2 className="text-xl font-semibold">{searchTerm ? '未找到匹配项' : '存档为空'}</h2>
                        <p className="mt-2 max-w-sm">
                            {searchTerm 
                                ? '请尝试使用其他关键词进行搜索。' 
                                : '您还没有保存任何故事。在“大纲内容”页面点击“保存”按钮即可将您的作品存档到这里。'
                            }
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ArchiveView;
