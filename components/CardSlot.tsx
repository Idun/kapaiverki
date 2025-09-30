

import React, { useState } from 'react';
import type { Card, CardType } from '../types';
import { CARD_TYPE_NAMES } from '../constants';

interface CardSlotProps {
    cardType: CardType;
    card: Card | null;
    onClear: () => void;
    onDropCard: (card: Card) => void;
    activeDragType: CardType | null;
    allCards: Card[];
}

const CardSlot: React.FC<CardSlotProps> = ({ cardType, card, onClear, onDropCard, activeDragType, allCards }) => {
    const [isOver, setIsOver] = useState(false);

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
    };
    
    const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsOver(true);
    };

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsOver(false);
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsOver(false);
        try {
            const droppedCardId = e.dataTransfer.getData('text/plain');
            if (!droppedCardId) return;

            const droppedCard = allCards.find(c => c.id === droppedCardId);
            if (!droppedCard) return;
            
            // Only accept cards of the matching type
            if (droppedCard.type === cardType) {
                onDropCard(droppedCard);
            }
        } catch (error) {
            console.error("Failed to handle drop:", error);
        }
    };

    const canAcceptDrop = activeDragType === null || activeDragType === cardType;

    return (
        <div className="relative">
            <h3 className="text-md font-medium text-gray-500 mb-2 text-center dark:text-zinc-400">{CARD_TYPE_NAMES[cardType]}</h3>
            <div 
                className="h-28 w-full"
                onDragOver={handleDragOver}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                {card ? (
                    <div className="relative h-full group">
                         <div className="p-3 rounded-lg bg-white border-2 border-gray-400 flex flex-col items-center justify-center text-center shadow-md h-full dark:bg-zinc-700 dark:border-zinc-500">
                            <div className="text-gray-700 mb-2 dark:text-zinc-300">
                               {React.cloneElement(card.icon, { className: "w-5 h-5" })}
                            </div>
                            <h4 className="font-semibold text-sm text-gray-800 dark:text-zinc-100">{card.name}</h4>
                         </div>
                        <button 
                            onClick={onClear} 
                            className="absolute -top-2 -right-2 w-5 h-5 bg-gray-600 text-white rounded-full flex items-center justify-center hover:bg-red-500 transition-colors z-20 text-xs dark:bg-zinc-400 dark:text-zinc-900 dark:hover:bg-red-500"
                            aria-label={`Clear ${cardType}`}
                        >
                            &times;
                        </button>
                         {/* Tooltip for description */}
                        <div className={'absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-xs p-2 text-sm bg-zinc-800 text-white rounded-md shadow-lg transition-opacity duration-300 pointer-events-none z-10 opacity-0 group-hover:opacity-100 dark:bg-zinc-900'}>
                            {card.description}
                            <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-zinc-800 dark:border-t-zinc-900"></div>
                        </div>
                    </div>
                ) : (
                    <div className={`w-full h-full flex items-center justify-center bg-gray-50/50 border-2 border-dashed rounded-lg transition-all duration-200 dark:bg-zinc-800/40 ${
                        isOver && canAcceptDrop 
                        ? 'border-blue-500 bg-blue-100/50 dark:bg-blue-900/30 dark:border-blue-400' 
                        : 'border-gray-300 dark:border-zinc-700'
                    }`}>
                        <p className={`text-sm transition-colors ${isOver && canAcceptDrop ? 'text-blue-600 font-medium dark:text-blue-300' : 'text-gray-400 dark:text-zinc-500'}`}>
                            拖拽卡片至此
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CardSlot;