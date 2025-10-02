import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import type { Card, CombinedCards, AIConfig, CardType, NovelInfo, UISettings, SavedCombination } from '../types';
import { CardType as CardTypeEnum } from '../types';
import { CORE_CARD_TYPES, CARD_TYPE_NAMES, OPTIONAL_CARD_TYPES } from '../constants';
import { fetchModels } from '../services/aiService';
import CardComponent from './CardComponent';
import CardCarousel from './CardCarousel';
import CardSlot from './CardSlot';
import Spinner from './Spinner';
import CreateCardModal from './CreateCardModal';
import { PlusIcon, UploadIcon, TrashIcon, BookmarkSquareIcon, ArrowDownOnSquareIcon } from './icons';


interface WriterViewProps {
    config: AIConfig;
    setConfig: React.Dispatch<React.SetStateAction<AIConfig>>;
    onStartGeneration: () => void;
    combinedCards: CombinedCards;
    onCardSelect: (card: Card, index: number) => void;
    onClearCard: (cardType: CardType, index: number) => void;
    onAddCardSlot: (cardType: CardType) => void;
    onRemoveCardSlot: (cardType: CardType, index: number) => void;
    novelInfo: NovelInfo;
    setNovelInfo: React.Dispatch<React.SetStateAction<NovelInfo>>;
    allCards: Card[];
    onCreateCard: (cardData: Omit<Card, 'id' | 'icon' | 'isCustom'>) => void;
    onUpdateCard: (card: Card) => void;
    onDeleteCard: (cardId: string) => void;
    uiSettings: UISettings;
    savedCombinations: SavedCombination[];
    onSaveCombination: (name: string) => void;
    onLoadCombination: (id: string) => void;
    onDeleteCombination: (id: string) => void;
}

const LENGTH_PRESETS: Record<string, string> = {
  'short': '2万字',
  'medium': '5万字',
  'long': '10万字',
};

const EMOTION_PRESETS = ['无', '纯爱', 'HE', 'BE', '甜宠', '暗恋', '虐恋', '先虐后甜', '沙雕', '爽文', '复仇', '反转'];


const getLengthCategory = (wordCount: string): string => {
    if (!wordCount) return '';
    const num = parseInt(wordCount.replace(/[^0-9]/g, ''), 10);
    if (isNaN(num)) return '';
    const value = wordCount.includes('万') ? num * 10000 : num;

    if (value > 0 && value < 30000) return 'short';
    if (value >= 30000 && value < 80000) return 'medium';
    if (value >= 80000) return 'long';
    return '';
};


const WriterView: React.FC<WriterViewProps> = ({ 
    config, setConfig, onStartGeneration, combinedCards, onCardSelect, 
    onClearCard, onAddCardSlot, onRemoveCardSlot, novelInfo, setNovelInfo, 
    allCards, onCreateCard, onUpdateCard, onDeleteCard, uiSettings,
    savedCombinations, onSaveCombination, onLoadCombination, onDeleteCombination
}) => {
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [activeDragType, setActiveDragType] = useState<CardType | null>(null);
    const [activePanel, setActivePanel] = useState(0);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalCardType, setModalCardType] = useState<CardType | null>(null);
    const [editingCard, setEditingCard] = useState<Card | null>(null);
    const [modelList, setModelList] = useState<string[]>([]);
    const [isModelListLoading, setIsModelListLoading] = useState(false);
    const [isModelSelectOpen, setIsModelSelectOpen] = useState(false);
    const [isCombinationManagerOpen, setIsCombinationManagerOpen] = useState(false);
    const [modelSearch, setModelSearch] = useState('');
    const modelSelectRef = useRef<HTMLDivElement>(null);
    const combinationManagerRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const totalPanels = 2;

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (modelSelectRef.current && !modelSelectRef.current.contains(event.target as Node)) {
                setIsModelSelectOpen(false);
            }
            if (combinationManagerRef.current && !combinationManagerRef.current.contains(event.target as Node)) {
                setIsCombinationManagerOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            const activeElement = document.activeElement;
            if (activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeElement.tagName)) {
                return;
            }

            if (event.key === 'ArrowLeft') {
                setActivePanel(prev => Math.max(0, prev - 1));
            } else if (event.key === 'ArrowRight') {
                setActivePanel(prev => Math.min(totalPanels - 1, prev + 1));
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [totalPanels]);
    
    useEffect(() => {
        const loadModels = async () => {
            if (!config.provider) return;

            // Don't fetch models if key/endpoint are missing, except for Ollama which doesn't need a key
            if (config.provider !== 'ollama' && (!config.apiKey || !config.endpoint)) {
                 if (config.provider === 'gemini' && config.apiKey) {
                    // Gemini is a special case that doesn't need an endpoint check here
                 } else {
                    setModelList([]);
                    return;
                 }
            }

            setIsModelListLoading(true);
            try {
                const models = await fetchModels(config);
                setModelList(models);
                if (models.length > 0 && !models.includes(config.model)) {
                    setConfig(prev => ({...prev, model: models[0]}));
                }
            } catch (error) {
                if (error instanceof Error) {
                    console.error("Failed to fetch models for writer view dropdown:", error.message);
                } else {
                    console.error("An unexpected error occurred while fetching models:", error);
                }
                setModelList([]);
            } finally {
                setIsModelListLoading(false);
            }
        };

        loadModels();
    }, [config.provider, config.apiKey, config.endpoint, setConfig]);
    
    const isGenerationReady = useMemo(() => {
        const coreCardsMet = CORE_CARD_TYPES.every(type => combinedCards[type]?.some(c => c !== null));
        const novelInfoMet = 
            novelInfo.name && 
            novelInfo.wordCount && 
            novelInfo.synopsis && 
            novelInfo.perspective && 
            (novelInfo.channel != null) && // FIX: Allow '' (None) as a valid choice
            novelInfo.emotion;
        return coreCardsMet && !!novelInfoMet;
    }, [combinedCards, novelInfo]);

    const isCardSelected = useCallback((cardId: string) => {
        return Object.values(combinedCards).flat().some(c => c?.id === cardId);
    }, [combinedCards]);

    const handleGenerate = async () => {
        if (!isGenerationReady) return;
        onStartGeneration();
    };
    
    const handleDrawCards = useCallback(() => {
        const allTypes = [...CORE_CARD_TYPES, ...OPTIONAL_CARD_TYPES];

        allTypes.forEach(type => {
            const currentSlots = combinedCards[type] || [null];
            const availableCards = allCards.filter(card => card.type === type);
            if (availableCards.length === 0) return;

            const selectedInThisDraw = new Set<string>();

            currentSlots.forEach((_, index) => {
                let candidateCards = availableCards.filter(card => !selectedInThisDraw.has(card.id));

                // If we run out of unique cards (e.g., more slots than available cards), allow re-picking from all available cards for that type.
                if (candidateCards.length === 0) {
                    candidateCards = availableCards;
                }

                if (candidateCards.length > 0) {
                    const randomIndex = Math.floor(Math.random() * candidateCards.length);
                    const selectedCard = candidateCards[randomIndex];
                    onCardSelect(selectedCard, index); 
                    // Add to set to try to avoid duplicates within the same type for this draw operation
                    selectedInThisDraw.add(selectedCard.id);
                }
            });
        });
    }, [combinedCards, allCards, onCardSelect]);

    const handleInfoChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { id, value } = e.target;
        setNovelInfo(prev => ({ ...prev, [id]: value }));
    };
    
    const handleCardDragStart = (cardType: CardType) => {
        setActiveDragType(cardType);
        setActivePanel(0); 
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
        if (cardData.id && editingCard) { 
            onUpdateCard({
                ...editingCard,
                ...cardData,
            });
        } else if (modalCardType) { 
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
        
        e.target.value = ''; 
    };

    const handleSaveCombinationClick = () => {
        const name = prompt("请输入要保存的组合名称：", "我的故事组合");
        if (name) {
            onSaveCombination(name);
        }
    };


    return (
        <div className="w-full max-w-7xl mx-auto flex flex-col h-full">
            <header className="flex justify-start items-center mb-6 gap-4 flex-wrap">
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
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={handleSaveCombinationClick}
                        className="flex items-center gap-2 pl-3 pr-4 py-2 text-sm bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-100 transition-all dark:bg-zinc-700 dark:border-zinc-600 dark:text-zinc-100 dark:hover:bg-zinc-600"
                        title="保存当前卡牌组合"
                    >
                        <BookmarkSquareIcon className="w-4 h-4" />
                        <span>保存组合</span>
                    </button>
                    <div ref={combinationManagerRef} className="relative">
                        <button
                            type="button"
                            onClick={() => setIsCombinationManagerOpen(prev => !prev)}
                            className="p-2.5 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-100 transition-all dark:bg-zinc-700 dark:border-zinc-600 dark:text-zinc-100 dark:hover:bg-zinc-600"
                            title="管理已保存的组合"
                        >
                            <ArrowDownOnSquareIcon className="w-4 h-4" />
                        </button>
                        {isCombinationManagerOpen && (
                            <div className="absolute z-20 mt-2 w-72 right-0 bg-white dark:bg-zinc-800 rounded-lg shadow-xl border border-gray-200 dark:border-zinc-700">
                                <div className="p-3 border-b border-gray-200 dark:border-zinc-700">
                                    <h3 className="font-semibold text-gray-800 dark:text-zinc-100">已存组合</h3>
                                </div>
                                {savedCombinations.length > 0 ? (
                                    <ul className="max-h-80 overflow-y-auto custom-scrollbar p-2">
                                        {savedCombinations.map(combo => (
                                            <li key={combo.id} className="group flex justify-between items-center p-2 rounded-md hover:bg-gray-100 dark:hover:bg-zinc-700">
                                                <span className="text-sm font-medium text-gray-700 dark:text-zinc-200 truncate pr-2" title={combo.name}>{combo.name}</span>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => {
                                                            onLoadCombination(combo.id);
                                                            setIsCombinationManagerOpen(false);
                                                        }}
                                                        className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-semibold"
                                                        title="加载此组合"
                                                    >
                                                        加载
                                                    </button>
                                                    <button
                                                        onClick={() => onDeleteCombination(combo.id)}
                                                        className="p-1 text-gray-400 hover:text-red-600 dark:text-zinc-500 dark:hover:text-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                                        title="删除此组合"
                                                    >
                                                        <TrashIcon className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="p-4 text-sm text-gray-500 dark:text-zinc-400 text-center">还没有保存任何组合。</p>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </header>

            <div className="flex-grow flex flex-col min-h-0">
                <div className="flex-1 overflow-x-hidden overflow-y-visible">
                    <div
                        className="flex h-full transition-transform duration-500 ease-in-out"
                        style={{ transform: `translateX(-${activePanel * 100}%)` }}
                    >
                        {/* Panel 1: Novel Info & Story Combination */}
                        <div className="w-full flex-shrink-0 p-1">
                            <div className="grid grid-cols-1 lg:grid-cols-5 gap-2 h-full">
                                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col h-full dark:bg-zinc-800 dark:border-zinc-700 lg:col-span-2">
                                    <h2 className="text-xl font-semibold mb-5 text-gray-700 dark:text-zinc-200">小说信息</h2>
                                    <div className="flex flex-col flex-grow">
                                        <div className="space-y-4">
                                            <div>
                                                <label htmlFor="name" className="block text-sm font-medium text-gray-600 mb-1 dark:text-zinc-300">小说名称 <span className="text-red-500">*</span></label>
                                                <input type="text" id="name" value={novelInfo.name} onChange={handleInfoChange} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-500 focus:border-gray-500 dark:bg-zinc-700 dark:border-zinc-600 dark:text-white" placeholder="例如：深渊回响" />
                                            </div>

                                             <div>
                                                <label className="block text-sm font-medium text-gray-600 mb-2 dark:text-zinc-300">书籍频道 <span className="text-red-500">*</span></label>
                                                <div className="flex items-center space-x-4">
                                                    {['', 'male', 'female'].map(channelValue => {
                                                        const labels: Record<string, string> = { '': '无', 'male': '男频', 'female': '女频' };
                                                        return (
                                                            <label key={channelValue} className="flex items-center space-x-2 cursor-pointer text-sm">
                                                                <input
                                                                    type="radio"
                                                                    name="channel"
                                                                    value={channelValue}
                                                                    checked={novelInfo.channel === channelValue}
                                                                    onChange={(e) => setNovelInfo(prev => ({ ...prev, channel: e.target.value as NovelInfo['channel'] }))}
                                                                    className="h-4 w-4 text-gray-600 focus:ring-gray-500 border-gray-300"
                                                                />
                                                                <span className="text-gray-700 dark:text-zinc-300">{labels[channelValue]}</span>
                                                            </label>
                                                        )
                                                    })}
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label htmlFor="emotion" className="block text-sm font-medium text-gray-600 mb-1 dark:text-zinc-300">情绪 <span className="text-red-500">*</span></label>
                                                    <select id="emotion" value={novelInfo.emotion || '无'} onChange={handleInfoChange} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-500 focus:border-gray-500 bg-white dark:bg-zinc-700 dark:border-zinc-600 dark:text-white">
                                                        {EMOTION_PRESETS.map(e => <option key={e} value={e}>{e}</option>)}
                                                    </select>
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
                                
                                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col min-h-0 dark:bg-zinc-800 dark:border-zinc-700 lg:col-span-3">
                                    <h2 className="text-xl font-semibold mb-5 text-gray-700 dark:text-zinc-200 flex-shrink-0">故事组合</h2>
                                    <div className="flex-grow overflow-y-auto custom-scrollbar -mr-4 pr-4">
                                         <div className="grid grid-cols-2 gap-x-4 gap-y-6">
                                            {CORE_CARD_TYPES.map(type => (
                                                <div key={type} className="flex flex-col gap-2">
                                                    <div className="flex justify-between items-center">
                                                        <h3 className="text-md font-medium text-gray-500 dark:text-zinc-400">{CARD_TYPE_NAMES[type]}</h3>
                                                        {(combinedCards[type]?.length ?? 0) < 3 && (
                                                            <button 
                                                                onClick={() => onAddCardSlot(type)}
                                                                className="p-1 text-gray-400 hover:text-gray-700 rounded-full hover:bg-gray-100 transition-colors dark:text-zinc-500 dark:hover:text-zinc-200 dark:hover:bg-zinc-700"
                                                                title={`为“${CARD_TYPE_NAMES[type]}”添加一个新栏位`}
                                                            >
                                                                <PlusIcon className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                    </div>
                                                    {combinedCards[type]?.map((card, index) => (
                                                        <div key={`${type}-${index}`} className="relative">
                                                            <CardSlot
                                                                cardType={type}
                                                                card={card}
                                                                onClear={() => onClearCard(type, index)}
                                                                onDropCard={(droppedCard) => onCardSelect(droppedCard, index)}
                                                                activeDragType={activeDragType}
                                                                allCards={allCards}
                                                            />
                                                            {index > 0 && (
                                                                <button
                                                                    onClick={() => onRemoveCardSlot(type, index)}
                                                                    className="absolute -top-2 -right-2 w-5 h-5 bg-gray-600 text-white rounded-full flex items-center justify-center hover:bg-red-500 transition-colors z-20"
                                                                    aria-label={`移除“${CARD_TYPE_NAMES[type]}”栏位`}
                                                                    title="移除栏位"
                                                                >
                                                                    <TrashIcon className="w-3 h-3" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            ))}
                                        </div>
                                        
                                        <div className="mt-6 pt-4 border-t border-gray-200/60 dark:border-zinc-600/60">
                                            <h3 className="text-md font-medium text-gray-500 dark:text-zinc-400 mb-2">{CARD_TYPE_NAMES[CardTypeEnum.Inspiration]}</h3>
                                            <CardSlot
                                                key={CardTypeEnum.Inspiration}
                                                cardType={CardTypeEnum.Inspiration}
                                                card={combinedCards[CardTypeEnum.Inspiration]?.[0] || null}
                                                onClear={() => onClearCard(CardTypeEnum.Inspiration, 0)}
                                                onDropCard={(card) => onCardSelect(card, 0)}
                                                activeDragType={activeDragType}
                                                allCards={allCards}
                                            />
                                        </div>

                                        <div className="mt-4 flex flex-wrap -mx-2">
                                            {OPTIONAL_CARD_TYPES.filter(type => type !== CardTypeEnum.Inspiration).map(type => (
                                                <div key={type} className="w-1/2 md:w-1/3 px-2 mb-4">
                                                     <h3 className="text-md font-medium text-gray-500 dark:text-zinc-400 mb-2">{CARD_TYPE_NAMES[type]}</h3>
                                                    <CardSlot
                                                        cardType={type}
                                                        card={combinedCards[type]?.[0] || null}
                                                        onClear={() => onClearCard(type, 0)}
                                                        onDropCard={(card) => onCardSelect(card, 0)}
                                                        activeDragType={activeDragType}
                                                        allCards={allCards}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                         {/* Panel 2: Card Libraries */}
                        <div className="w-full flex-shrink-0 h-full p-1">
                             <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 h-full">
                                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col dark:bg-zinc-800 dark:border-zinc-700 min-h-0">
                                    <h2 className="text-xl font-semibold mb-5 text-gray-700 dark:text-zinc-200 flex-shrink-0">卡片库</h2>
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
                                                    {uiSettings.cardStyle === 'carousel' ? (
                                                        <CardCarousel
                                                            cards={allCards.filter(card => card.type === type)}
                                                            onCardSelect={(card) => {
                                                                let targetIndex = combinedCards[card.type]?.findIndex(slot => slot === null);
                                                                if (targetIndex === -1) {
                                                                    targetIndex = 0;
                                                                }
                                                                onCardSelect(card, targetIndex ?? 0);
                                                            }}
                                                            isCardSelected={isCardSelected}
                                                            onEdit={handleOpenModalForEdit}
                                                            onDelete={handleDeleteRequest}
                                                        />
                                                    ) : (
                                                        <div className="grid grid-cols-3 gap-3">
                                                            {allCards.filter(card => card.type === type).map(card => (
                                                                <CardComponent
                                                                    key={card.id}
                                                                    card={card}
                                                                    onClick={(c) => {
                                                                        let targetIndex = combinedCards[c.type]?.findIndex(slot => slot === null);
                                                                        if (targetIndex === -1) {
                                                                            targetIndex = 0;
                                                                        }
                                                                        onCardSelect(c, targetIndex ?? 0);
                                                                    }}
                                                                    isSelected={isCardSelected(card.id)}
                                                                    onDragStart={() => handleCardDragStart(card.type)}
                                                                    onDragEnd={() => setActiveDragType(null)}
                                                                    onEdit={handleOpenModalForEdit}
                                                                    onDelete={handleDeleteRequest}
                                                                />
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col dark:bg-zinc-800 dark:border-zinc-700 min-h-0">
                                    <div className="flex-grow overflow-y-auto -mr-2 pr-2 custom-scrollbar">
                                        <div className="space-y-8">
                                            {OPTIONAL_CARD_TYPES.filter(type => type !== CardTypeEnum.Inspiration).map(type => (
                                                <div key={type}>
                                                    <h2 className="text-xl font-semibold mb-5 text-gray-700 dark:text-zinc-200">{CARD_TYPE_NAMES[type]}</h2>
                                                    {uiSettings.cardStyle === 'carousel' ? (
                                                        <CardCarousel
                                                            cards={allCards.filter(card => card.type === type)}
                                                            onCardSelect={(card) => onCardSelect(card, 0)}
                                                            isCardSelected={isCardSelected}
                                                            onEdit={handleOpenModalForEdit}
                                                            onDelete={handleDeleteRequest}
                                                        />
                                                    ) : (
                                                        <div className="grid grid-cols-3 gap-3">
                                                            {allCards.filter(card => card.type === type).map(card => (
                                                                <CardComponent
                                                                    key={card.id}
                                                                    card={card}
                                                                    onClick={(c) => onCardSelect(c, 0)}
                                                                    isSelected={isCardSelected(card.id)}
                                                                    onDragStart={() => handleCardDragStart(card.type)}
                                                                    onDragEnd={() => setActiveDragType(null)}
                                                                    onEdit={handleOpenModalForEdit}
                                                                    onDelete={handleDeleteRequest}
                                                                />
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
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
                    config={config}
                />
            )}
        </div>
    );
};

export default WriterView;