import React, { useState, useEffect } from 'react';
import type { Card, CardType } from '../types';
import { CARD_TYPE_NAMES } from '../constants';
import { CardType as CardTypeEnum } from '../types';

interface CreateCardModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: { name: string; tooltipText: string; description:string; id?: string; }) => void;
    cardType: CardType;
    editingCard?: Card | null;
}

const PLACEHOLDER_EXAMPLES: Record<CardType, string> = {
    [CardTypeEnum.Theme]: '例如：爱与责任',
    [CardTypeEnum.Genre]: '例如：赛博朋克',
    [CardTypeEnum.Character]: '例如：不情愿的英雄',
    [CardTypeEnum.Plot]: '例如：底层逆袭',
    [CardTypeEnum.Structure]: '例如：单线型结构',
    [CardTypeEnum.Technique]: '例如：平行叙事',
    [CardTypeEnum.Ending]: '例如：开放式结局',
    [CardTypeEnum.Inspiration]: '例如：魔法源于情绪',
};


const CreateCardModal: React.FC<CreateCardModalProps> = ({ isOpen, onClose, onSubmit, cardType, editingCard }) => {
    const [name, setName] = useState('');
    const [tooltipText, setTooltipText] = useState('');
    const [description, setDescription] = useState('');
    
    const isEditing = !!editingCard;

    useEffect(() => {
        if (isOpen && isEditing && editingCard) {
            setName(editingCard.name);
            setTooltipText(editingCard.tooltipText);
            setDescription(editingCard.description);
        } else if (isOpen && !isEditing) {
            // Reset fields for new card creation
            setName('');
            setTooltipText('');
            setDescription('');
        }
    }, [isOpen, isEditing, editingCard]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || !tooltipText.trim() || !description.trim()) {
            alert('所有字段均为必填项。');
            return;
        }
        onSubmit({ 
            name, 
            tooltipText, 
            description,
            id: isEditing ? editingCard.id : undefined,
        });
    };

    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4 transition-opacity duration-300"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-card-title"
        >
            <div 
                className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 transform transition-all duration-300 scale-95 opacity-0 animate-fade-in-scale dark:bg-zinc-800"
                onClick={e => e.stopPropagation()}
                style={{ animation: 'fade-in-scale 0.3s forwards' }}
            >
                <h2 id="create-card-title" className="text-xl font-bold mb-4 text-gray-800 dark:text-zinc-100">
                    {isEditing ? `编辑 ${CARD_TYPE_NAMES[cardType]} 卡片` : `新建 ${CARD_TYPE_NAMES[cardType]} 卡片`}
                </h2>
                <form onSubmit={handleSubmit}>
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="card-name" className="block text-sm font-medium text-gray-700 dark:text-zinc-300">名称</label>
                            <input
                                id="card-name"
                                type="text"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-500 focus:border-gray-500 dark:bg-zinc-700 dark:border-zinc-600 dark:text-white"
                                required
                                placeholder={PLACEHOLDER_EXAMPLES[cardType] || '例如：自定义卡片'}
                            />
                        </div>
                        <div>
                            <label htmlFor="card-tooltip" className="block text-sm font-medium text-gray-700 dark:text-zinc-300">提示 (Tooltip)</label>
                            <input
                                id="card-tooltip"
                                type="text"
                                value={tooltipText}
                                onChange={e => setTooltipText(e.target.value)}
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-500 focus:border-gray-500 dark:bg-zinc-700 dark:border-zinc-600 dark:text-white"
                                required
                                placeholder="对卡片的简短描述"
                            />
                        </div>
                        <div>
                            <label htmlFor="card-description" className="block text-sm font-medium text-gray-700 dark:text-zinc-300">内容 (Description)</label>
                            <textarea
                                id="card-description"
                                rows={4}
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-500 focus:border-gray-500 custom-scrollbar dark:bg-zinc-700 dark:border-zinc-600 dark:text-white"
                                required
                                placeholder="对卡片的详细说明，将用于 AI prompt"
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
                           {isEditing ? '保存更改' : '创建卡片'}
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

export default CreateCardModal;