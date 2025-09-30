

import React, { useState } from 'react';
import type { InspirationCategory, InspirationItem } from '../types';
import CreateInspirationModal from './CreateInspirationModal';
import { PlusIcon, PencilIcon, TrashIcon } from './icons';

interface InspirationViewProps {
    inspirationCards: InspirationCategory[];
    onCreateCard: (categoryId: string, newItemData: { title: string; description: string }) => void;
    onUpdateCard: (categoryId: string, updatedItem: InspirationItem) => void;
    onDeleteCard: (categoryId: string, itemId: number, itemName: string) => void;
    onCardDragStart: () => void;
    onCardClick: (cardId: string) => void;
    selectedInspirationCardId?: string | null;
}

const InspirationView: React.FC<InspirationViewProps> = ({ inspirationCards, onCreateCard, onUpdateCard, onDeleteCard, onCardDragStart, onCardClick, selectedInspirationCardId }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [activeCategory, setActiveCategory] = useState<{ id: string; title: string } | null>(null);
    const [editingItem, setEditingItem] = useState<InspirationItem | null>(null);

    const handleOpenModalForCreate = (categoryId: string, categoryTitle: string) => {
        setEditingItem(null);
        setActiveCategory({ id: categoryId, title: categoryTitle });
        setIsModalOpen(true);
    };

    const handleOpenModalForEdit = (categoryId: string, item: InspirationItem) => {
        const category = inspirationCards.find(c => c.id === categoryId);
        if (!category) return;
        setEditingItem(item);
        setActiveCategory({ id: categoryId, title: category.title });
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setActiveCategory(null);
        setEditingItem(null);
    };

    const handleModalSubmit = (newItemData: { title: string; description: string }) => {
        if (editingItem && activeCategory) {
            onUpdateCard(activeCategory.id, { ...editingItem, ...newItemData });
        } else if (activeCategory) {
            onCreateCard(activeCategory.id, newItemData);
        }
        handleCloseModal();
    };
    
    const handleDelete = (e: React.MouseEvent, categoryId: string, itemId: number, itemName: string) => {
        e.stopPropagation();
        onDeleteCard(categoryId, itemId, itemName);
    };
    
    const handleDragStart = (e: React.DragEvent<HTMLDivElement>, categoryId: string, itemId: number) => {
        const cardId = `inspiration-${categoryId}-${itemId}`;
        e.dataTransfer.setData('text/plain', cardId);
        onCardDragStart();
    };

    const handleClick = (categoryId: string, itemId: number) => {
        const cardId = `inspiration-${categoryId}-${itemId}`;
        onCardClick(cardId);
    };

    const handleKeyDown = (e: React.KeyboardEvent, categoryId: string, itemId: number) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick(categoryId, itemId);
        }
    }


    return (
        <div className="w-full h-full flex flex-col">
            <header className="flex-shrink-0 mb-6">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-zinc-100">灵感集</h1>
                <p className="mt-2 text-gray-600 dark:text-zinc-300">
                    这里汇集了40个独特的世界观设定，涵盖奇幻、科幻、都市怪谈等多个类别，旨在激发您的创作热情，为作品注入新鲜元素。
                </p>
            </header>
            <div className="flex-grow overflow-y-auto custom-scrollbar -mr-4 pr-4">
                <div className="space-y-8">
                    {inspirationCards.map(category => (
                        <section key={category.id} aria-labelledby={category.id}>
                            <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-200 dark:border-zinc-700">
                                <h2 id={category.id} className="text-xl font-semibold text-gray-700 dark:text-zinc-200">
                                    {category.title}
                                </h2>
                                <button
                                    onClick={() => handleOpenModalForCreate(category.id, category.title)}
                                    className="flex items-center gap-1.5 px-3 py-1 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 transition-colors dark:bg-zinc-700 dark:text-zinc-200 dark:border-zinc-600 dark:hover:bg-zinc-600"
                                    title={`为“${category.title}”添加新灵感`}
                                >
                                    <PlusIcon className="w-4 h-4" />
                                    <span>添加</span>
                                </button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {category.items.map(item => {
                                    const cardId = `inspiration-${category.id}-${item.id}`;
                                    const isSelected = selectedInspirationCardId === cardId;
                                    const interactionClasses = isSelected
                                        ? 'cursor-not-allowed'
                                        : 'cursor-pointer active:cursor-grabbing';

                                    return (
                                        <div 
                                            key={item.id} 
                                            className={`flip-card h-36 group relative rounded-lg ${interactionClasses} ${isSelected ? 'ring-2 ring-blue-500 ring-offset-1 dark:ring-blue-400' : ''}`}
                                            role="button" 
                                            tabIndex={isSelected ? -1 : 0}
                                            draggable={!isSelected}
                                            onDragStart={(e) => {
                                                if(isSelected) {
                                                    e.preventDefault();
                                                    return;
                                                }
                                                handleDragStart(e, category.id, item.id)
                                            }}
                                            onClick={() => {
                                                if(!isSelected) handleClick(category.id, item.id)
                                            }}
                                            onKeyDown={(e) => {
                                                if(!isSelected) handleKeyDown(e, category.id, item.id)
                                            }}
                                            aria-disabled={isSelected}
                                        >
                                            <div className="flip-card-inner">
                                                <div className={`flip-card-front p-4 bg-white border border-gray-200 shadow-sm flex flex-col items-center justify-center text-center dark:bg-zinc-800 dark:border-zinc-700 ${isSelected ? 'opacity-70' : ''}`}>
                                                    <h3 className="font-semibold text-gray-800 px-2 dark:text-zinc-100">
                                                        {item.title}
                                                    </h3>
                                                </div>
                                                <div className={`flip-card-back p-4 bg-slate-50 border border-gray-200 shadow-sm flex flex-col items-center justify-center text-center dark:bg-zinc-700 dark:border-zinc-600 ${isSelected ? 'opacity-70' : ''}`}>
                                                     {item.isCustom && (
                                                        <div className="absolute top-1 right-1 flex items-center space-x-1 z-10">
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleOpenModalForEdit(category.id, item); }}
                                                                className="p-1 text-gray-400 hover:text-gray-700 rounded-full hover:bg-gray-100 dark:hover:text-zinc-200 dark:hover:bg-zinc-700"
                                                                aria-label={`编辑 ${item.title}`}
                                                                title="编辑"
                                                            >
                                                                <PencilIcon className="w-3.5 h-3.5" />
                                                            </button>
                                                            <button
                                                                onClick={(e) => handleDelete(e, category.id, item.id, item.title)}
                                                                className="p-1 text-gray-400 hover:text-red-600 rounded-full hover:bg-red-50 dark:hover:bg-red-900/50"
                                                                aria-label={`删除 ${item.title}`}
                                                                title="删除"
                                                            >
                                                                <TrashIcon className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    )}
                                                    <p className="text-sm text-gray-600 leading-relaxed max-h-full overflow-y-auto custom-scrollbar dark:text-zinc-300">
                                                        {item.description}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </section>
                    ))}
                    <footer className="text-center py-6">
                         <p className="text-sm text-gray-500 dark:text-zinc-400">灵感源于创作者总结，旨在为您的创作之旅提供助力。</p>
                    </footer>
                </div>
            </div>
             {isModalOpen && activeCategory && (
                <CreateInspirationModal
                    isOpen={isModalOpen}
                    onClose={handleCloseModal}
                    onSubmit={handleModalSubmit}
                    categoryTitle={activeCategory.title}
                    editingItem={editingItem}
                />
            )}
        </div>
    );
};

export default InspirationView;