import React from 'react';
import type { Card } from '../types';
import { PencilIcon, TrashIcon } from './icons';

interface CardComponentProps {
    card: Card;
    onClick: (card: Card) => void;
    isSelected: boolean;
    onDragStart: () => void;
    onDragEnd: () => void;
    onEdit?: (card: Card) => void;
    onDelete?: (cardId: string, cardName: string) => void;
}

const CardComponent: React.FC<CardComponentProps> = ({ card, onClick, isSelected, onDragStart, onDragEnd, onEdit, onDelete }) => {
    const interactionClasses = isSelected 
        ? "grayscale opacity-60 cursor-not-allowed" 
        : "cursor-pointer active:cursor-grabbing";

    const handleDragStartInternal = (e: React.DragEvent<HTMLDivElement>) => {
        if (isSelected) {
            e.preventDefault();
            return;
        }
        e.dataTransfer.setData('text/plain', card.id);
        onDragStart();
    };

    // Handler for selecting the card. This is on the main container.
    const handleCardClick = () => {
        if (!isSelected) {
            onClick(card);
        }
    };

    // Handler for the edit button. It STOPS the click from bubbling up to the card container.
    const handleEditClick = (e: React.MouseEvent) => {
        e.stopPropagation(); // This is the crucial part.
        onEdit?.(card);
    };

    // Handler for the delete button. It also STOPS the click from bubbling up.
    const handleDeleteClick = (e: React.MouseEvent) => {
        e.stopPropagation(); // This is the crucial part.
        onDelete?.(card.id, card.name);
    };


    return (
        <div 
            className={`flip-card group h-24 ${interactionClasses}`}
            draggable={!isSelected}
            onDragStart={handleDragStartInternal}
            onDragEnd={onDragEnd}
            onClick={handleCardClick} // Attach the selection handler here.
            role={isSelected ? undefined : 'button'}
            aria-disabled={isSelected}
            tabIndex={isSelected ? -1 : 0}
            onKeyDown={(e) => {
                if (!isSelected && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    onClick(card);
                }
            }}
        >
            <div className="flip-card-inner">
                {/* Front of the card */}
                <div className="flip-card-front p-3 bg-white border border-gray-200 shadow-sm flex flex-col items-center justify-center text-center dark:bg-zinc-800 dark:border-zinc-700">
                    <div className={`text-gray-500 mb-2 transition-transform duration-200 ${!isSelected && 'group-hover:text-gray-800 dark:group-hover:text-zinc-200'}`}>
                        {React.cloneElement(card.icon, { className: "w-5 h-5" })}
                    </div>
                    <h4 className="font-semibold text-sm text-gray-700 dark:text-zinc-300">{card.name}</h4>
                </div>
                
                {/* Back of the card */}
                <div className="flip-card-back p-3 bg-slate-50 border border-gray-200 shadow-sm flex flex-col items-center justify-center text-center dark:bg-zinc-700 dark:border-zinc-600">
                    {card.isCustom && onEdit && onDelete && !isSelected && (
                        <div className="absolute top-1 right-1 flex items-center space-x-1 z-10">
                            <button
                                onClick={handleEditClick} // Attach edit handler to button
                                className="p-1 text-gray-400 hover:text-gray-700 rounded-full hover:bg-gray-100 dark:hover:text-zinc-200 dark:hover:bg-zinc-700"
                                aria-label={`编辑 ${card.name}`}
                                title="编辑"
                            >
                                <PencilIcon className="w-3.5 h-3.5" />
                            </button>
                            <button
                                onClick={handleDeleteClick} // Attach delete handler to button
                                className="p-1 text-gray-400 hover:text-red-600 rounded-full hover:bg-red-50 dark:hover:bg-red-900/50"
                                aria-label={`删除 ${card.name}`}
                                title="删除"
                            >
                                <TrashIcon className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    )}
                     <p className="text-sm text-gray-600 font-medium dark:text-zinc-200">{card.name}</p>
                     <div className="w-1/4 h-px bg-gray-300 my-2 dark:bg-zinc-500"></div>
                    <p className="text-sm text-gray-500 px-1 dark:text-zinc-400">{card.tooltipText}</p>
                </div>
            </div>
        </div>
    );
};

export default CardComponent;