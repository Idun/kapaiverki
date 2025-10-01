import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { Card } from '../types';
import { PencilIcon, TrashIcon } from './icons';

interface CardCarouselProps {
    cards: Card[];
    onCardSelect: (card: Card) => void;
    isCardSelected: (cardId: string) => boolean;
    onEdit: (card: Card) => void;
    onDelete: (cardId: string, cardName: string) => void;
}

const AUTOPLAY_INTERVAL = 5000; // 5 seconds
const FLING_THRESHOLD = 50; // pixels

const CardCarousel: React.FC<CardCarouselProps> = ({ cards, onCardSelect, isCardSelected, onEdit, onDelete }) => {
    const [activeIndex, setActiveIndex] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [dragStartX, setDragStartX] = useState(0);
    const [dragDeltaX, setDragDeltaX] = useState(0);
    const [isHovered, setIsHovered] = useState(false);
    const [isFlinging, setIsFlinging] = useState<'left' | 'right' | null>(null);

    const containerRef = useRef<HTMLDivElement>(null);
    const detailViewRef = useRef<HTMLDivElement>(null);
    const autoplayIntervalRef = useRef<number | null>(null);
    let lastWheelTime = 0;

    const goToNext = useCallback(() => {
        setActiveIndex(prev => (prev + 1) % cards.length);
    }, [cards.length]);

    const goToPrev = useCallback(() => {
        setActiveIndex(prev => (prev - 1 + cards.length) % cards.length);
    }, [cards.length]);

    // Autoplay logic
    useEffect(() => {
        // Only autoplay when the user is hovering over the component
        if (isHovered && !isDragging) {
            autoplayIntervalRef.current = window.setInterval(goToNext, AUTOPLAY_INTERVAL);
        } else if (autoplayIntervalRef.current) {
            clearInterval(autoplayIntervalRef.current);
        }
        return () => {
            if (autoplayIntervalRef.current) {
                clearInterval(autoplayIntervalRef.current);
            }
        };
    }, [isHovered, isDragging, goToNext]);


    const handleWheel = useCallback((e: WheelEvent) => {
        e.preventDefault();
        const now = Date.now();
        if (now - lastWheelTime < 150) return; // Throttle wheel events
        lastWheelTime = now;

        if (e.deltaY > 0) { // scroll down
            goToNext();
        } else { // scroll up
            goToPrev();
        }
    }, [goToNext, goToPrev]);

    useEffect(() => {
        const container = containerRef.current;
        container?.addEventListener('wheel', handleWheel, { passive: false });
        return () => {
            container?.removeEventListener('wheel', handleWheel);
        };
    }, [handleWheel]);

    useEffect(() => {
        // Trigger animation for detail view
        const detailView = detailViewRef.current;
        if (detailView) {
            detailView.classList.remove('animate-detail-fade-in');
            // void detailView.offsetWidth; // Trigger reflow
            setTimeout(() => detailView.classList.add('animate-detail-fade-in'), 10);
        }
    }, [activeIndex]);
    
    // Drag handlers
    const onDragStart = (x: number) => {
        setIsDragging(true);
        setDragStartX(x);
    };

    const onDragMove = (x: number) => {
        if (!isDragging) return;
        setDragDeltaX(x - dragStartX);
    };
    
    const onDragEnd = () => {
        if (!isDragging) return;
        setIsDragging(false);

        if (Math.abs(dragDeltaX) > FLING_THRESHOLD) {
            const direction = dragDeltaX < 0 ? 'left' : 'right';
            setIsFlinging(direction);

            setTimeout(() => {
                if (direction === 'left') {
                    goToNext();
                } else {
                    goToPrev();
                }
                setIsFlinging(null);
                 setDragDeltaX(0);
            }, 300); // Match this with CSS transition duration
        } else {
            setDragDeltaX(0); // Snap back
        }
    };
    
    const handleMouseDown = (e: React.MouseEvent) => onDragStart(e.clientX);
    const handleMouseMove = (e: React.MouseEvent) => onDragMove(e.clientX);
    const handleTouchStart = (e: React.TouchEvent) => onDragStart(e.touches[0].clientX);
    const handleTouchMove = (e: React.TouchEvent) => onDragMove(e.touches[0].clientX);


    const activeCard = cards[activeIndex];
    if (!activeCard) return null; // Should not happen if cards array is not empty

    const cardIsSelected = isCardSelected(activeCard.id);

    return (
        <div 
            className="grid grid-cols-2 gap-x-4 items-start"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Left Column: Carousel and Pagination */}
            <div className="flex flex-col items-center justify-center h-40">
                <div ref={containerRef} className="relative h-32 w-full flex items-center justify-center card-carousel-viewport">
                    {cards.map((card, index) => {
                        const offset = index - activeIndex;
                        const isVisible = Math.abs(offset) < 4;
                        const isActive = index === activeIndex;

                        let transform = `translateY(${offset * 8}px) scale(${1 - Math.abs(offset) * 0.1})`;
                        let opacity = isVisible ? 1 : 0;
                        let transition = 'all 0.5s cubic-bezier(0.23, 1, 0.32, 1)';

                        if (offset > 0) {
                            transform = `translateX(${offset * 10}px) translateY(${offset * 6}px) scale(${1 - offset * 0.1}) rotate(${offset * 3}deg)`;
                        } else if (offset < 0) {
                            opacity = 0; // Hide cards behind
                        }

                        if (isActive && isDragging) {
                            transition = 'none'; // Disable transition while dragging
                            transform = `translateX(${dragDeltaX}px) rotate(${dragDeltaX / 10}deg)`;
                        }

                        if (isActive && isFlinging) {
                            transition = 'all 0.3s ease-out';
                            transform = `translateX(${isFlinging === 'left' ? -200 : 200}px) rotate(${isFlinging === 'left' ? -20 : 20}deg)`;
                            opacity = 0;
                        }

                        return (
                            <div
                                key={card.id}
                                className="card-carousel-card absolute w-24 h-28 rounded-lg shadow-md bg-white border border-gray-200 dark:bg-zinc-800 dark:border-zinc-700 flex flex-col items-center justify-center p-3 text-center"
                                style={{
                                    transform,
                                    zIndex: cards.length - Math.abs(offset),
                                    opacity,
                                    pointerEvents: isActive ? 'auto' : (isVisible ? 'auto' : 'none'),
                                    cursor: isActive ? (isDragging ? 'grabbing' : 'grab') : 'pointer',
                                    transition: transition,
                                }}
                                onClick={() => !isActive && setActiveIndex(index)}
                                onMouseDown={isActive ? handleMouseDown : undefined}
                                onMouseMove={isActive ? handleMouseMove : undefined}
                                onMouseUp={isActive ? onDragEnd : undefined}
                                onMouseLeave={isActive ? onDragEnd : undefined}
                                onTouchStart={isActive ? handleTouchStart : undefined}
                                onTouchMove={isActive ? handleTouchMove : undefined}
                                onTouchEnd={isActive ? onDragEnd : undefined}
                            >
                                <div className="text-gray-500 dark:text-zinc-400 mb-2">
                                    {React.cloneElement(card.icon, { className: "w-5 h-5" })}
                                </div>
                                <h4 className="font-semibold text-sm text-gray-700 dark:text-zinc-300">{card.name}</h4>
                            </div>
                        );
                    })}
                </div>
                {/* Pagination */}
                <div className="flex justify-center items-center space-x-2 mt-2">
                    {cards.map((_, index) => (
                        <button
                            key={index}
                            onClick={() => setActiveIndex(index)}
                            className={`w-2 h-2 rounded-full transition-all duration-300 ${
                                activeIndex === index ? 'bg-gray-800 dark:bg-slate-300 scale-125' : 'bg-gray-300 hover:bg-gray-400 dark:bg-zinc-600 dark:hover:bg-zinc-500'
                            }`}
                            aria-label={`Go to card ${index + 1}`}
                        />
                    ))}
                </div>
            </div>

            {/* Right Column: Card Details */}
            <div ref={detailViewRef} className="flex flex-col max-h-56 min-h-0 p-4 bg-slate-50 rounded-lg dark:bg-zinc-800/50">
                <div className="flex items-center gap-2 mb-2">
                    <div className="text-gray-600 dark:text-zinc-300">{React.cloneElement(activeCard.icon, { className: "w-5 h-5" })}</div>
                    <h3 className="text-lg font-bold text-gray-800 dark:text-zinc-100">{activeCard.name}</h3>
                </div>
                <p className="text-sm text-gray-600 dark:text-zinc-400 mb-3 flex-grow custom-scrollbar overflow-y-auto pr-2">
                    {activeCard.description}
                </p>
                <div className="flex-shrink-0 flex items-center gap-2 mt-auto">
                    <button
                        onClick={() => onCardSelect(activeCard)}
                        disabled={cardIsSelected}
                        className="flex-grow bg-gray-800 text-white font-semibold py-2 px-4 rounded-lg shadow-sm transition-colors hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-slate-100 dark:text-gray-800 dark:hover:bg-slate-200 dark:disabled:bg-slate-400 dark:disabled:text-gray-600"
                    >
                        {cardIsSelected ? '已选择' : '选择此卡片'}
                    </button>
                    {activeCard.isCustom && (
                        <>
                            <button
                                onClick={() => onEdit(activeCard)}
                                className="p-2 text-gray-500 hover:text-gray-800 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600"
                                aria-label="编辑卡片"
                                title="编辑"
                            >
                                <PencilIcon className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => onDelete(activeCard.id, activeCard.name)}
                                className="p-2 text-gray-500 hover:text-red-600 bg-gray-200 hover:bg-red-100 rounded-lg transition-colors dark:bg-zinc-700 dark:text-zinc-300 dark:hover:text-red-500 dark:hover:bg-red-900/50"
                                aria-label="删除卡片"
                                title="删除"
                            >
                                <TrashIcon className="w-4 h-4" />
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CardCarousel;