

import React, { useState, useEffect } from 'react';
import type { InspirationItem } from '../types';

interface CreateInspirationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: { title: string; description: string; }) => void;
    categoryTitle: string;
    editingItem?: InspirationItem | null;
}

const CreateInspirationModal: React.FC<CreateInspirationModalProps> = ({ isOpen, onClose, onSubmit, categoryTitle, editingItem }) => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');

    const isEditing = !!editingItem;

    useEffect(() => {
        if (isOpen) {
            if (isEditing && editingItem) {
                setTitle(editingItem.title);
                setDescription(editingItem.description);
            } else {
                // Reset for creation
                setTitle('');
                setDescription('');
            }
        }
    }, [isOpen, isEditing, editingItem]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || !description.trim()) {
            alert('所有字段均为必填项。');
            return;
        }
        onSubmit({ title, description });
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4 transition-opacity duration-300"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-inspiration-title"
        >
            <div 
                className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 transform transition-all duration-300 scale-95 opacity-0 animate-fade-in-scale dark:bg-zinc-800"
                onClick={e => e.stopPropagation()}
                style={{ animation: 'fade-in-scale 0.3s forwards' }}
            >
                <h2 id="create-inspiration-title" className="text-xl font-bold mb-4 text-gray-800 dark:text-zinc-100">
                    {isEditing ? '编辑灵感' : `为 “${categoryTitle}” 添加新灵感`}
                </h2>
                <form onSubmit={handleSubmit}>
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="inspiration-title" className="block text-sm font-medium text-gray-700 dark:text-zinc-300">标题</label>
                            <input
                                id="inspiration-title"
                                type="text"
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-500 focus:border-gray-500 dark:bg-zinc-700 dark:border-zinc-600 dark:text-white"
                                required
                                placeholder="输入一个简洁的标题"
                            />
                        </div>
                        <div>
                            <label htmlFor="inspiration-description" className="block text-sm font-medium text-gray-700 dark:text-zinc-300">描述</label>
                            <textarea
                                id="inspiration-description"
                                rows={4}
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-500 focus:border-gray-500 custom-scrollbar dark:bg-zinc-700 dark:border-zinc-600 dark:text-white"
                                required
                                placeholder="详细描述这个世界观设定"
                            ></textarea>
                        </div>
                    </div>
                    <div className="mt-6 flex justify-end space-x-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none dark:bg-zinc-600 dark:text-zinc-200 dark:border-zinc-500 dark:hover:bg-zinc-500"
                        >
                            取消
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 text-sm font-medium text-white bg-gray-800 border border-transparent rounded-md shadow-sm hover:bg-gray-900 focus:outline-none dark:bg-slate-100 dark:text-gray-800 dark:hover:bg-slate-200"
                        >
                           {isEditing ? '保存更改' : '添加灵感'}
                        </button>
                    </div>
                </form>
            </div>
             <style>{`
                @keyframes fade-in-scale {
                    from { transform: scale(0.95); opacity: 0; }
                    to { transform: scale(1); opacity: 1; }
                }
                .animate-fade-in-scale {
                    animation: fade-in-scale 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }
            `}</style>
        </div>
    );
};

export default CreateInspirationModal;