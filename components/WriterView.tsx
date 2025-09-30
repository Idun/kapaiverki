

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import type { Card, CombinedCards, AIConfig, CardType, NovelInfo } from '../types';
import { CardType as CardTypeEnum } from '../types';
import { DEFAULT_CARDS, CORE_CARD_TYPES, CARD_TYPE_NAMES, OPTIONAL_CARD_TYPES } from '../constants';
import { fetchModels } from '../services/aiService';
import CardComponent from './CardComponent';
import CardSlot from './CardSlot';
import Spinner from './Spinner';
import CreateCardModal from './CreateCardModal';
import { PlusIcon, UploadIcon } from './icons';


interface WriterViewProps {
    config: AIConfig;
    setConfig: React.Dispatch<React.SetStateAction<AIConfig>>;
    onStartGeneration: () => void;
    combinedCards: CombinedCards;
    onCardSelect: (card: Card) => void;
    onClearCard: (cardType: CardType) => void;
    novelInfo: NovelInfo;
    setNovelInfo: React.Dispatch<React.SetStateAction<NovelInfo>>;
    allCards: Card[];
    onCreateCard: (cardData: Omit<Card, 'id' | 'icon' | 'isCustom'>) => void;
    onUpdateCard: (card: Card) => void;
    onDeleteCard: (cardId: string) => void;
}

const LENGTH_PRESETS: Record<string, string> = {
  'short': '2万字',
  'medium': '5万字',
  'long': '10万字',
};

const getLengthCategory = (wordCount: string): string => {
    if (!wordCount) return '';
    // Allow parsing numbers with or without "万"
    const num = parseInt(wordCount.replace(/[^0-9]/g, ''), 10);
    if (isNaN(num)) return '';
    const value = wordCount.includes('万') ? num * 10000 : num;

    if (value > 0 && value < 30000) return 'short';
    if (value >= 30000 && value < 80000) return 'medium';
    if (value >= 80000) return 'long';
    return '';
};


const WriterView: React.FC<WriterViewProps> = ({ config, setConfig, onStartGeneration, combinedCards, onCardSelect, onClearCard, novelInfo, setNovelInfo, allCards, onCreateCard, onUpdateCard, onDeleteCard }) => {
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [activeDragType, setActiveDragType] = useState<CardType | null>(null);
    const [activePanel, setActivePanel] = useState(0);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalCardType, setModalCardType] = useState<CardType | null>(null);
    const [editingCard, setEditingCard] = useState<Card | null>(null);
    const [modelList, setModelList] = useState<string[]>([]);
    const [isModelListLoading, setIsModelListLoading] = useState(false);
    const [isModelSelectOpen, setIsModelSelectOpen] = useState(false);
    const [modelSearch, setModelSearch] = useState('');
    const modelSelectRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const totalPanels = 2;

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (modelSelectRef.current && !modelSelectRef.current.contains(event.target as Node)) {
                setIsModelSelectOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);
    
    useEffect(() => {
        const loadModels = async () => {
            if (!config.provider) return;
            if (config.provider === 'gemini') {
                setModelList(['gemini-2.5-flash']);
                if (config.model !== 'gemini-2.5-flash') {
                    setConfig(prev => ({ ...prev, model: 'gemini-2.5-flash' }));
                }
                return;
            }

            setIsModelListLoading(true);
            try {
                const models = await fetchModels(config);
                setModelList(models);
            // FIX: The original error handling was correct but the comment was misleading. 
            // This updated implementation is slightly more robust for different error types.
            } catch (error) {
                if (error instanceof Error) {
                    console.error("Failed to fetch models for writer view dropdown:", error.message);
                } else {
                    console.error("Failed to fetch models for writer view dropdown:", error);
                }
                setModelList([]); // Clear list on error
            } finally {
                setIsModelListLoading(false);
            }
        };

        loadModels();
    }, [config.provider, config.apiKey, config.endpoint, setConfig]);
    
    const isGenerationReady = useMemo(() => {
        const coreCardsMet = CORE_CARD_TYPES.every(type => combinedCards[type] != null);
        const novelInfoMet = novelInfo.name && novelInfo.wordCount && novelInfo.synopsis && novelInfo.perspective;
        return coreCardsMet && !!novelInfoMet;
    }, [combinedCards, novelInfo]);

    const isCardSelected = useCallback((cardId: string) => {
        return Object.values(combinedCards).some(c => c?.id === cardId);
    }, [combinedCards]);

    const handleGenerate = async () => {
        if (!isGenerationReady) return;
        onStartGeneration();
    };
    
    const handleDrawCards = useCallback(() => {
        const allTypes = [...CORE_CARD_TYPES, ...OPTIONAL_CARD_TYPES];

        allTypes.forEach(type => {
          const candidateCards = allCards.filter(card => card.type === type);
          
          if (candidateCards.length > 0) {
            const randomIndex = Math.floor(Math.random() * candidateCards.length);
            const selectedCard = candidateCards[randomIndex];
            onCardSelect(selectedCard);
          }
        });
      }, [onCardSelect, allCards]);

    const handleInfoChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { id, value } = e.target;
        setNovelInfo(prev => ({ ...prev, [id]: value }));
    };
    
    const handleCardDragStart = (cardType: CardType) => {
        setActiveDragType(cardType);
        setActivePanel(0); // Always switch to panel 0 on drag start
    };
    
    const lengthCategory = useMemo(() => getLengthCategory(novelInfo.wordCount), [novelInfo.wordCount]);

    const handleLengthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newLength = e.target.value;
        const newWordCount = LENGTH_PRESETS[newLength] || '';
        setNovelInfo(prev => ({ ...prev, wordCount: newWordCount }));
    };

    const handleOpenModalForCreate = (type: CardType) => {
        setEditingCard(null);
        setModalCardType(type);
        setIsModalOpen(true);
    };

    const handleOpenModalForEdit = (card: Card) => {
        setModalCardType(null);
        setEditingCard(card);
        setIsModalOpen(true);
    };
    
    const handleDeleteRequest = (cardId: string, cardName: string) => {
        if (window.confirm(`您确定要删除自定义卡片 “${cardName}” 吗？`)) {
            onDeleteCard(cardId);
        }
    };
    
    const handleModalSubmit = (cardData: { name: string; tooltipText: string; description: string; id?: string; }) => {
        if (cardData.id && editingCard) { // It's an update
            onUpdateCard({
                ...editingCard,
                ...cardData,
            });
        } else if (modalCardType) { // It's a creation
            onCreateCard({ ...cardData, type: modalCardType });
        }
        setIsModalOpen(false);
        setEditingCard(null);
        setModalCardType(null);
    };
    
    const filteredModels = useMemo(() => {
        if (!modelSearch) return modelList;
        return modelList.filter(m => m.toLowerCase().includes(modelSearch.toLowerCase()));
    }, [modelList, modelSearch]);

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target?.result as string;
            setNovelInfo(prev => ({ ...prev, synopsis: content }));
        };
        reader.onerror = () => {
            alert('读取文件失败。');
        };
        reader.readAsText(file);
        
        e.target.value = ''; // Reset file input
    };


    return (
        <div className="w-full max-w-7xl mx-auto flex flex-col h-full">
            <header className="flex justify-start items-center mb-6 gap-4">
                <button
                    onClick={handleGenerate}
                    disabled={!isGenerationReady || isLoading}
                    className="bg-gray-800 text-white font-semibold py-2 px-5 rounded-lg shadow-sm transition-all duration-300 ease-in-out hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-700 flex items-center justify-center gap-2 dark:bg-slate-100 dark:text-gray-800 dark:hover:bg-slate-200 dark:disabled:bg-slate-400 dark:disabled:text-gray-600"
                >
                    {isLoading ? <><Spinner /> 生成中...</> : '一键生成'}
                </button>
                 <button
                    onClick={handleDrawCards}
                    disabled={isLoading}
                    className="bg-white text-gray-800 font-semibold py-2 px-5 rounded-lg shadow-sm transition-all duration-300 ease-in-out border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 dark:bg-zinc-700 dark:text-zinc-100 dark:border-zinc-600 dark:hover:bg-zinc-600"
                >
                    抽卡
                </button>
                <div ref={modelSelectRef} className="relative w-48">
                    <button
                        type="button"
                        onClick={() => setIsModelSelectOpen(!isModelSelectOpen)}
                        disabled={isModelListLoading}
                        className="w-full flex items-center justify-between pl-3 pr-2 py-2 text-sm bg-white border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-gray-500 focus:border-gray-500 disabled:opacity-60 disabled:bg-gray-100 transition-all dark:bg-zinc-700 dark:border-zinc-600 dark:text-zinc-100 dark:disabled:bg-zinc-600"
                        aria-haspopup="listbox"
                        aria-expanded={isModelSelectOpen}
                        aria-label="选择模型"
                    >
                        <span className="truncate">{isModelListLoading ? '加载中...' : config.model || '选择模型'}</span>
                        <svg className="fill-current h-4 w-4 opacity-50" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                    </button>
                    {isModelSelectOpen && (
                        <div className="absolute z-10 mt-1 w-full bg-white dark:bg-zinc-700 rounded-md shadow-lg border border-gray-200 dark:border-zinc-600">
                            <div className="p-2">
                                <input
                                    type="text"
                                    value={modelSearch}
                                    onChange={e => setModelSearch(e.target.value)}
                                    placeholder="搜索模型..."
                                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-500 focus:border-gray-500 dark:bg-zinc-600 dark:border-zinc-500 dark:text-white"
                                />
                            </div>
                            <ul className="max-h-60 overflow-y-auto text-sm custom-scrollbar" role="listbox">
                                {filteredModels.length > 0 ? (
                                    filteredModels.map(modelName => (
                                        <li
                                            key={modelName}
                                            onClick={() => {
                                                setConfig(prev => ({ ...prev, model: modelName }));
                                                setIsModelSelectOpen(false);
                                                setModelSearch('');
                                            }}
                                            className="px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-zinc-600"
                                            role="option"
                                            aria-selected={config.model === modelName}
                                        >
                                            {modelName}
                                        </li>
                                    ))
                                ) : (
                                    <li className="px-3 py-2 text-gray-500 dark:text-zinc-400">无匹配模型</li>
                                )}
                            </ul>
                        </div>
                    )}
                </div>
                <div className="relative">
                    <select
                        id="prompt-template-select"
                        value={config.activePromptId}
                        onChange={(e) => setConfig(prev => ({ ...prev, activePromptId: e.target.value }))}
                        className="w-48 pl-3 pr-8 py-2 text-sm bg-white border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-gray-500 focus:border-gray-500 appearance-none transition-all dark:bg-zinc-700 dark:border-zinc-600 dark:text-zinc-100"
                        aria-label="选择提示词模板"
                    >
                        {config.prompts.map(prompt => (
                            <option key={prompt.id} value={prompt.id}>
                                {prompt.name}
                            </option>
                        ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700 dark:text-zinc-300">
                        <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                    </div>
                </div>
            </header>

            <div className="flex-grow flex flex-col min-h-0">
                <div className="flex-1 overflow-hidden">
                    <div
                        className="flex h-full transition-transform duration-500 ease-in-out"
                        style={{ transform: `translateX(-${activePanel * 100}%)` }}
                    >
                        {/* Panel 1: Novel Info & Story Combination */}
                        <div className="w-full flex-shrink-0 p-1">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full">
                                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col h-full dark:bg-zinc-800 dark:border-zinc-700">
                                    <h2 className="text-xl font-semibold mb-5 text-gray-700 dark:text-zinc-200">小说信息</h2>
                                    <div className="flex flex-col flex-grow">
                                        <div className="space-y-4">
                                            <div>
                                                <label htmlFor="name" className="block text-sm font-medium text-gray-600 mb-1 dark:text-zinc-300">小说名称 <span className="text-red-500">*</span></label>
                                                <input type="text" id="name" value={novelInfo.name} onChange={handleInfoChange} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-500 focus:border-gray-500 dark:bg-zinc-700 dark:border-zinc-600 dark:text-white" placeholder="例如：深渊回响" />
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label htmlFor="length" className="block text-sm font-medium text-gray-600 mb-1 dark:text-zinc-300">篇幅 <span className="text-red-500">*</span></label>
                                                    <select id="length" value={lengthCategory} onChange={handleLengthChange} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-500 focus:border-gray-500 bg-white dark:bg-zinc-700 dark:border-zinc-600 dark:text-white">
                                                        <option value="">无</option>
                                                        <option value="short">短篇 (&lt;3万字)</option>
                                                        <option value="medium">中篇 (3-8万字)</option>
                                                        <option value="long">长篇 (&gt;8万字)</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label htmlFor="wordCount" className="block text-sm font-medium text-gray-600 mb-1 dark:text-zinc-300">字数 <span className="text-red-500">*</span></label>
                                                    <input type="text" id="wordCount" value={novelInfo.wordCount} onChange={handleInfoChange} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-500 focus:border-gray-500 dark:bg-zinc-700 dark:border-zinc-600 dark:text-white" placeholder="例如：10万字" />
                                                </div>
                                            </div>
                                            <div>
                                                <label htmlFor="perspective" className="block text-sm font-medium text-gray-600 mb-1 dark:text-zinc-300">叙事视角 <span className="text-red-500">*</span></label>
                                                <select id="perspective" value={novelInfo.perspective || ''} onChange={handleInfoChange} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-500 focus:border-gray-500 bg-white dark:bg-zinc-700 dark:border-zinc-600 dark:text-white">
                                                    <option value="">请选择...</option>
                                                    <option value="全知视角(零视角)">全知视角(零视角)</option>
                                                    <option value="第三人称叙述">第三人称叙述</option>
                                                    <option value="第一人称叙述">第一人称叙述</option>
                                                    <option value="第二人称叙述">第二人称叙述</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div className="flex flex-col flex-grow mt-4">
                                            <div className="flex justify-between items-center mb-1">
                                                <label htmlFor="synopsis" className="block text-sm font-medium text-gray-600 dark:text-zinc-300">概要 <span className="text-red-500">*</span></label>
                                                <button
                                                    type="button"
                                                    onClick={handleImportClick}
                                                    className="p-1.5 text-gray-400 hover:text-gray-700 rounded-full hover:bg-gray-100 transition-colors dark:text-zinc-500 dark:hover:text-zinc-200 dark:hover:bg-zinc-700"
                                                    title="导入本地文档"
                                                >
                                                    <UploadIcon className="w-4 h-4" />
                                                </button>
                                                <input
                                                    type="file"
                                                    ref={fileInputRef}
                                                    onChange={handleFileImport}
                                                    accept=".md,.txt"
                                                    className="hidden"
                                                />
                                            </div>
                                            <textarea id="synopsis" value={novelInfo.synopsis} onChange={handleInfoChange} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-500 focus:border-gray-500 flex-grow dark:bg-zinc-700 dark:border-zinc-600 dark:text-white" placeholder="故事核心概念的一句话总结"></textarea>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col dark:bg-zinc-800 dark:border-zinc-700">
                                    <h2 className="text-xl font-semibold mb-5 text-gray-700 dark:text-zinc-200">故事组合</h2>
                                    <div className="grid grid-cols-2 gap-4">
                                        {CORE_CARD_TYPES.map(type => (
                                            <CardSlot
                                                key={type}
                                                cardType={type}
                                                card={combinedCards[type] || null}
                                                onClear={() => onClearCard(type)}
                                                onDropCard={onCardSelect}
                                                activeDragType={activeDragType}
                                                allCards={allCards}
                                            />
                                        ))}
                                    </div>
                                    
                                    <div className="mt-4 pt-4 border-t border-gray-200/60 dark:border-zinc-600/60">
                                        <CardSlot
                                            key={CardTypeEnum.Inspiration}
                                            cardType={CardTypeEnum.Inspiration}
                                            card={combinedCards[CardTypeEnum.Inspiration] || null}
                                            onClear={() => onClearCard(CardTypeEnum.Inspiration)}
                                            onDropCard={onCardSelect}
                                            activeDragType={activeDragType}
                                            allCards={allCards}
                                        />
                                    </div>

                                    <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-4">
                                        {OPTIONAL_CARD_TYPES.filter(type => type !== CardTypeEnum.Inspiration).map(type => (
                                             <CardSlot
                                                key={type}
                                                cardType={type}
                                                card={combinedCards[type] || null}
                                                onClear={() => onClearCard(type)}
                                                onDropCard={onCardSelect}
                                                activeDragType={activeDragType}
                                                allCards={allCards}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                         {/* Panel 2: Card Libraries */}
                        <div className="w-full flex-shrink-0 h-full p-1">
                             <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full">
                                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col dark:bg-zinc-800 dark:border-zinc-700">
                                    <h2 className="text-xl font-semibold mb-5 text-gray-700 dark:text-zinc-200">卡片库</h2>
                                    <div className="flex-grow overflow-y-auto -mr-2 pr-2 custom-scrollbar">
                                        <div className="space-y-5">
                                            {CORE_CARD_TYPES.map(type => (
                                                <div key={type}>
                                                    <div className="flex justify-between items-center mb-3">
                                                        <h3 className="text-md font-medium text-gray-500 dark:text-zinc-400">{CARD_TYPE_NAMES[type]}</h3>
                                                        <button
                                                            onClick={() => handleOpenModalForCreate(type)}
                                                            className="p-1 text-gray-400 hover:text-gray-700 rounded-full hover:bg-gray-100 transition-colors dark:text-zinc-500 dark:hover:text-zinc-200 dark:hover:bg-zinc-700"
                                                            title={`新建${CARD_TYPE_NAMES[type]}卡片`}
                                                        >
                                                            <PlusIcon className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                    <div className="grid grid-cols-3 gap-3">
                                                        {allCards.filter(card => card.type === type).map(card => (
                                                            <CardComponent
                                                                key={card.id}
                                                                card={card}
                                                                onClick={onCardSelect}
                                                                isSelected={isCardSelected(card.id)}
                                                                onDragStart={() => handleCardDragStart(card.type)}
                                                                onDragEnd={() => setActiveDragType(null)}
                                                                onEdit={handleOpenModalForEdit}
                                                                onDelete={handleDeleteRequest}
                                                            />
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col dark:bg-zinc-800 dark:border-zinc-700">
                                    <div className="flex-grow overflow-y-auto -mr-2 pr-2 custom-scrollbar">
                                        <div className="mb-8">
                                            <h2 className="text-xl font-semibold mb-5 text-gray-700 dark:text-zinc-200">{CARD_TYPE_NAMES[CardTypeEnum.Structure]}</h2>
                                            <div className="grid grid-cols-3 gap-3">
                                                {allCards.filter(card => card.type === CardTypeEnum.Structure).map(card => (
                                                    <CardComponent
                                                        key={card.id}
                                                        card={card}
                                                        onClick={onCardSelect}
                                                        isSelected={isCardSelected(card.id)}
                                                        onDragStart={() => handleCardDragStart(card.type)}
                                                        onDragEnd={() => setActiveDragType(null)}
                                                        onEdit={handleOpenModalForEdit}
                                                        onDelete={handleDeleteRequest}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                        <div className="mb-8">
                                            <h2 className="text-xl font-semibold mb-5 text-gray-700 dark:text-zinc-200">{CARD_TYPE_NAMES[CardTypeEnum.Technique]}</h2>
                                            <div className="grid grid-cols-3 gap-3">
                                                {allCards.filter(card => card.type === CardTypeEnum.Technique).map(card => (
                                                    <CardComponent
                                                        key={card.id}
                                                        card={card}
                                                        onClick={onCardSelect}
                                                        isSelected={isCardSelected(card.id)}
                                                        onDragStart={() => handleCardDragStart(card.type)}
                                                        onDragEnd={() => setActiveDragType(null)}
                                                        onEdit={handleOpenModalForEdit}
                                                        onDelete={handleDeleteRequest}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                        <div className="mb-8">
                                            <h2 className="text-xl font-semibold mb-5 text-gray-700 dark:text-zinc-200">{CARD_TYPE_NAMES[CardTypeEnum.Ending]}</h2>
                                            <div className="grid grid-cols-3 gap-3">
                                                {allCards.filter(card => card.type === CardTypeEnum.Ending).map(card => (
                                                    <CardComponent
                                                        key={card.id}
                                                        card={card}
                                                        onClick={onCardSelect}
                                                        isSelected={isCardSelected(card.id)}
                                                        onDragStart={() => handleCardDragStart(card.type)}
                                                        onDragEnd={() => setActiveDragType(null)}
                                                        onEdit={handleOpenModalForEdit}
                                                        onDelete={handleDeleteRequest}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Pager Controls */}
                <div className="mt-4 flex justify-center items-center space-x-2">
                    {Array.from({ length: totalPanels }).map((_, index) => (
                        <button
                            key={index}
                            onClick={() => setActivePanel(index)}
                            className={`w-10 h-1.5 rounded-full transition-colors ${
                                activePanel === index ? 'bg-gray-700 dark:bg-slate-300' : 'bg-gray-300 hover:bg-gray-400 dark:bg-zinc-600 dark:hover:bg-zinc-500'
                            }`}
                            aria-label={`Go to panel ${index + 1}`}
                        />
                    ))}
                </div>
            </div>
            {isModalOpen && (
                <CreateCardModal
                    isOpen={isModalOpen}
                    onClose={() => { setIsModalOpen(false); setEditingCard(null); }}
                    onSubmit={handleModalSubmit}
                    cardType={editingCard?.type ?? modalCardType!}
                    editingCard={editingCard}
                />
            )}
        </div>
    );
};

export default WriterView;
