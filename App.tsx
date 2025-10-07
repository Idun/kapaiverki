import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { AIConfig, Card, CombinedCards, CardType, NovelInfo, PromptTemplate, InspirationCategory, InspirationItem, UISettings, StoryArchiveItem, ChatMessage, Topic, SavedCombination, CharacterProfile } from './types';
import { DEFAULT_CARDS, BRAINSTORM_TOOLS } from './constants';
import { DEFAULT_PROMPTS, DEFAULT_SNOWFLAKE_PROMPT_TEMPLATE } from './prompts';
import { DEFAULT_INSPIRATION_DATA } from './inspirationConstants';
import Sidebar from './components/Sidebar';
import WriterView from './components/WriterView';
import SettingsView from './components/SettingsView';
import ResultView from './components/ResultView';
import InspirationView from './components/InspirationView';
import AboutView from './components/AboutView';
import ArchiveView from './components/ArchiveView';
import TipsView from './components/TipsView';
import CharacterShapingView from './components/CharacterShapingView';
import { CardType as CardTypeEnum } from './types';
import { SparklesIcon, LightbulbIcon } from './components/icons';

// Helper function to load and migrate chat history from localStorage
const loadAndMigrateChatHistory = (key: string, defaultMessage: ChatMessage): ChatMessage[] => {
    try {
        const saved = localStorage.getItem(key);
        if (!saved) return [defaultMessage];

        let history = JSON.parse(saved);
        if (!Array.isArray(history)) return [defaultMessage];

        // Migration: Add IDs if they don't exist
        let needsUpdate = false;
        history = history.map((msg: any, index: number) => {
            if (!msg.id) {
                needsUpdate = true;
                return {
                    id: `${key}-${Date.now()}-${index}`,
                    role: msg.role,
                    content: msg.content,
                    images: msg.images,
                };
            }
            return msg;
        });

        if (needsUpdate) {
            try {
                localStorage.setItem(key, JSON.stringify(history));
            } catch (e) {
                console.error(`Failed to save migrated history for ${key}`, e);
            }
        }
        
        return history.length > 0 ? history : [defaultMessage];
    } catch {
        return [defaultMessage];
    }
};


const App: React.FC = () => {
    const [view, setView] = useState<'writer' | 'result' | 'inspiration' | 'settings' | 'about' | 'archive' | 'tips' | 'characterShaping'>('writer');
    
    const [outline, setOutline] = useState<string>(() => {
        try {
            return localStorage.getItem('storyOutline') || '';
        } catch (e) {
            console.error("Failed to read outline from localStorage", e);
            return '';
        }
    });

    const [isGenerating, setIsGenerating] = useState<boolean>(false);

    const [config, setConfig] = useState<AIConfig>(() => {
        const defaultConfig: AIConfig = {
            provider: 'gemini',
            apiKey: '',
            endpoint: '',
            model: 'gemini-2.5-flash',
            prompts: [...DEFAULT_PROMPTS],
            activePromptId: DEFAULT_SNOWFLAKE_PROMPT_TEMPLATE.id,
            temperature: 0.8,
            maxTokens: 8192,
            topP: 0.9,
            frequencyPenalty: 0,
            presencePenalty: 0,
            streaming: true,
        };

        try {
            const savedConfig = localStorage.getItem('aiConfig');
            if (savedConfig) {
                const parsed = JSON.parse(savedConfig);

                // Start with user's saved prompts, or an empty array
                let userPrompts = (parsed.prompts && Array.isArray(parsed.prompts)) ? parsed.prompts : [];
                
                // Migration from old `prompt` string
                if (parsed.prompt && !parsed.prompts) {
                    const isDifferentFromDefaults = !DEFAULT_PROMPTS.some(p => p.content.trim() === parsed.prompt.trim());
                    if (isDifferentFromDefaults) {
                        const migratedPrompt: PromptTemplate = {
                            id: `migrated-${Date.now()}`,
                            name: '我的自定义提示词 (已迁移)',
                            content: parsed.prompt,
                        };
                        userPrompts.push(migratedPrompt);
                        // Set active prompt to the newly migrated one
                        parsed.activePromptId = migratedPrompt.id; 
                    }
                    delete parsed.prompt;
                }

                // Combine default prompts with user prompts, ensuring defaults are present and user's are preserved.
                // User prompts with same ID as a default will be ignored.
                const finalPrompts = [...DEFAULT_PROMPTS];
                const defaultIds = new Set(DEFAULT_PROMPTS.map(p => p.id));
                userPrompts.forEach((p: PromptTemplate) => {
                    if (p.id && !defaultIds.has(p.id)) {
                        finalPrompts.push(p);
                    }
                });

                parsed.prompts = finalPrompts;

                // Validate activePromptId
                if (!parsed.prompts.some((p: PromptTemplate) => p.id === parsed.activePromptId)) {
                    parsed.activePromptId = DEFAULT_SNOWFLAKE_PROMPT_TEMPLATE.id;
                }
                
                return { ...defaultConfig, ...parsed };
            }
            return defaultConfig;
        } catch (error) {
            console.error("Failed to parse AI config from localStorage", error);
            return defaultConfig;
        }
    });

    const [novelInfo, setNovelInfo] = useState<NovelInfo>(() => {
        const defaultState: NovelInfo = { name: '', wordCount: '', synopsis: '', perspective: '', channel: '', emotion: '无', characterProfileIds: [] };
        try {
            const savedInfo = localStorage.getItem('novelInfo');
            if (savedInfo) {
                const parsed = JSON.parse(savedInfo);
                // Migration for old single character ID
                if (parsed.characterProfileId && !parsed.characterProfileIds) {
                    parsed.characterProfileIds = [parsed.characterProfileId];
                    delete parsed.characterProfileId;
                }
                return { ...defaultState, ...parsed };
            }
            return defaultState;
        } catch (error) {
            console.error("Failed to parse novel info from localStorage", error);
            return defaultState;
        }
    });

    const [selectedCardIds, setSelectedCardIds] = useState<{[key in CardType]?: (string | null)[] }>(() => {
        try {
            const savedIds = localStorage.getItem('selectedCardIds');
            const defaultState = {
                [CardTypeEnum.Theme]: [null], 
                [CardTypeEnum.Genre]: [null], 
                [CardTypeEnum.Character]: [null], 
                [CardTypeEnum.Plot]: [null],
                [CardTypeEnum.Structure]: [null],
                [CardTypeEnum.Technique]: [null],
                [CardTypeEnum.Ending]: [null],
                [CardTypeEnum.Inspiration]: [null],
            };
            if (savedIds) {
                const parsed = JSON.parse(savedIds);
                // Migration from old format (string) to new format (array of strings)
                for (const key in parsed) {
                    if (parsed[key] && !Array.isArray(parsed[key])) {
                        parsed[key] = [parsed[key]]; // Wrap old string value in an array
                    }
                }
                 // Ensure all types from defaultState are present
                for (const key in defaultState) {
                    if (!parsed[key]) {
                        parsed[key] = defaultState[key as CardType];
                    }
                }
                return parsed;
            }
            return defaultState;
        } catch (error) {
            console.error("Failed to parse selected card IDs from localStorage", error);
            return { 
                [CardTypeEnum.Theme]: [null], 
                [CardTypeEnum.Genre]: [null], 
                [CardTypeEnum.Character]: [null], 
                [CardTypeEnum.Plot]: [null],
                [CardTypeEnum.Structure]: [null],
                [CardTypeEnum.Technique]: [null],
                [CardTypeEnum.Ending]: [null],
                [CardTypeEnum.Inspiration]: [null],
            };
        }
    });

    const [customCards, setCustomCards] = useState<Card[]>(() => {
        try {
            const savedCards = localStorage.getItem('customCards');
            return savedCards ? JSON.parse(savedCards) : [];
        } catch (e) {
            console.error("Failed to read custom cards from localStorage", e);
            return [];
        }
    });

    const [inspirationCards, setInspirationCards] = useState<InspirationCategory[]>(() => {
        try {
            const saved = localStorage.getItem('inspirationCards');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].id && parsed[0].title && parsed[0].items) {
                    return parsed;
                }
            }
            return DEFAULT_INSPIRATION_DATA;
        } catch (e) {
            console.error("Failed to load inspiration cards from localStorage", e);
            return DEFAULT_INSPIRATION_DATA;
        }
    });

    const [uiSettings, setUISettings] = useState<UISettings>(() => {
        const defaultSettings: UISettings = {
            theme: 'light',
            editorFontFamily: 'sans-serif',
            editorFontSize: 16,
            cardStyle: 'grid',
        };
        try {
            const saved = localStorage.getItem('uiSettings');
            return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
        } catch (e) {
            console.error("Failed to load UI settings from localStorage", e);
            return defaultSettings;
        }
    });

     const [currentStoryId, setCurrentStoryId] = useState<string | null>(() => {
        try {
            return localStorage.getItem('currentStoryId') || null;
        } catch { return null; }
    });

    const [storyArchive, setStoryArchive] = useState<StoryArchiveItem[]>(() => {
        try {
            const saved = localStorage.getItem('storyArchive');
            return saved ? JSON.parse(saved) : [];
        } catch { return []; }
    });

    const [savedCombinations, setSavedCombinations] = useState<SavedCombination[]>(() => {
        try {
            const saved = localStorage.getItem('savedCombinations');
            return saved ? JSON.parse(saved) : [];
        } catch { return []; }
    });
    
    // Chat histories are lifted here for persistence
    const [assistantHistory, setAssistantHistory] = useState<ChatMessage[]>(() => 
        loadAndMigrateChatHistory('assistantHistory', { id: `sys-asst-${Date.now()}`, role: 'system', content: '您可以通过对话来修改和完善大纲。' })
    );

    const [chatHistory, setChatHistory] = useState<ChatMessage[]>(() => 
        loadAndMigrateChatHistory('chatHistory', { id: `sys-chat-${Date.now()}`, role: 'system', content: '您可以像和朋友一样与 AI 聊天。' })
    );
    
    const [topics, setTopics] = useState<Topic[]>(() => {
        try {
            const savedTopicsRaw = localStorage.getItem('topics');
            let currentTopics: Topic[] = savedTopicsRaw ? JSON.parse(savedTopicsRaw) : [];

            // One-time migration from old `tipsHistories` to `topics`
            const savedHistoriesRaw = localStorage.getItem('tipsHistories');
            if (savedHistoriesRaw) {
                const histories = JSON.parse(savedHistoriesRaw);
                const migratedTopics: Topic[] = [];
                for (const toolId in histories) {
                    // Prevent duplicates if already migrated
                    if (!currentTopics.some(t => t.toolId === toolId)) {
                        const tool = BRAINSTORM_TOOLS.find(t => t.id === toolId);
                        // Only migrate if the user has actually chatted (more than the 2 initial messages)
                        if (tool && Array.isArray(histories[toolId]) && histories[toolId].length > 2) {
                            migratedTopics.push({
                                id: `topic-migrated-${toolId}-${Date.now()}`,
                                name: tool.name,
                                toolId: tool.id,
                                lastModified: Date.now(),
                                history: histories[toolId],
                            });
                        }
                    }
                }
                if (migratedTopics.length > 0) {
                    currentTopics = [...currentTopics, ...migratedTopics];
                }
                localStorage.removeItem('tipsHistories'); // Clean up old data after migration
            }
            
            return currentTopics;
        } catch(e) { 
            console.error("Failed to load or migrate topics", e);
            return []; 
        }
    });

    const defaultCharacterProfile: CharacterProfile = { 
        role: '其他角色',
        name: '',
        image: '', 
        selfAwareness: '', 
        reactionLogic: '', 
        stakes: '', 
        emotion: '',
        likability: '',
        competence: '',
        proactivity: '',
        power: ''
    };

    const [characterProfile, setCharacterProfile] = useState<CharacterProfile>(() => {
        try {
            const saved = localStorage.getItem('characterProfile');
            return saved ? { ...defaultCharacterProfile, ...JSON.parse(saved) } : defaultCharacterProfile;
        } catch (error) {
            console.error("Failed to parse character profile from localStorage", error);
            return defaultCharacterProfile;
        }
    });

    useEffect(() => {
        try {
            localStorage.setItem('characterProfile', JSON.stringify(characterProfile));
        } catch (e) { console.error("Failed to save character profile", e); }
    }, [characterProfile]);

    useEffect(() => {
        try {
            localStorage.setItem('topics', JSON.stringify(topics));
        } catch (e) { console.error("Failed to save topics", e); }
    }, [topics]);


    useEffect(() => {
        try {
            localStorage.setItem('storyArchive', JSON.stringify(storyArchive));
        } catch (e) { console.error("Failed to save story archive", e); }
    }, [storyArchive]);

    useEffect(() => {
        try {
            localStorage.setItem('savedCombinations', JSON.stringify(savedCombinations));
        } catch (e) { console.error("Failed to save combinations", e); }
    }, [savedCombinations]);

    useEffect(() => {
        try {
            localStorage.setItem('assistantHistory', JSON.stringify(assistantHistory));
        } catch (e) { console.error("Failed to save assistant history", e); }
    }, [assistantHistory]);

    useEffect(() => {
        try {
            localStorage.setItem('chatHistory', JSON.stringify(chatHistory));
        } catch (e) { console.error("Failed to save chat history", e); }
    }, [chatHistory]);

     useEffect(() => {
        try {
            if (currentStoryId) {
                localStorage.setItem('currentStoryId', currentStoryId);
            } else {
                localStorage.removeItem('currentStoryId');
            }
        } catch (e) { console.error("Failed to save current story ID", e); }
    }, [currentStoryId]);

    useEffect(() => {
        try {
            localStorage.setItem('uiSettings', JSON.stringify(uiSettings));
            // Apply theme to the root element for CSS targeting
            document.documentElement.classList.toggle('dark', uiSettings.theme === 'dark');
        } catch (error) {
            console.error("Failed to save UI settings to localStorage", error);
        }
    }, [uiSettings]);

    useEffect(() => {
        try {
            const cardsToSave = customCards.map(({ icon, ...rest }) => rest);
            localStorage.setItem('customCards', JSON.stringify(cardsToSave));
        } catch (error) {
            console.error("Failed to save custom cards to localStorage", error);
        }
    }, [customCards]);

    useEffect(() => {
        try {
            localStorage.setItem('inspirationCards', JSON.stringify(inspirationCards));
        } catch (error) {
            console.error("Failed to save inspiration cards to localStorage", error);
        }
    }, [inspirationCards]);
    

    const allCards = useMemo((): Card[] => {
        // Re-hydrate custom writing cards with an icon
        const rehydratedCustomCards = customCards.map(card => ({
            ...card,
            icon: <SparklesIcon className="w-6 h-6" /> 
        }));

        // Transform inspiration items into the standard Card format
        const transformedInspirationCards: Card[] = inspirationCards.flatMap(category => 
            category.items.map(item => ({
                id: `inspiration-${category.id}-${item.id}`,
                type: CardTypeEnum.Inspiration,
                name: item.title,
                description: item.description,
                tooltipText: item.description,
                icon: <LightbulbIcon className="w-6 h-6" />,
                isCustom: item.isCustom,
            }))
        );

        return [...DEFAULT_CARDS, ...rehydratedCustomCards, ...transformedInspirationCards];
    }, [customCards, inspirationCards]);


    useEffect(() => {
        try {
            localStorage.setItem('aiConfig', JSON.stringify(config));
        } catch (error) {
            console.error("Failed to save AI config to localStorage", error);
        }
    }, [config]);
    
    useEffect(() => {
        try {
            localStorage.setItem('novelInfo', JSON.stringify(novelInfo));
        } catch (error) {
            console.error("Failed to save novel info to localStorage", error);
        }
    }, [novelInfo]);

    useEffect(() => {
        try {
            localStorage.setItem('selectedCardIds', JSON.stringify(selectedCardIds));
        } catch (error) {
            console.error("Failed to save selected card IDs to localStorage", error);
        }
    }, [selectedCardIds]);

    const combinedCards = useMemo((): CombinedCards => {
        const rehydratedCards: CombinedCards = {};
        for (const type in selectedCardIds) {
            const cardType = type as CardType;
            const cardIdArray = selectedCardIds[cardType] || [];
            rehydratedCards[cardType] = cardIdArray.map(cardId => {
                if (cardId) {
                    return allCards.find(card => card.id === cardId) || null;
                }
                return null;
            });
        }
        return rehydratedCards;
    }, [selectedCardIds, allCards]);

    const setAndPersistOutline = useCallback((newOutline: string) => {
        setOutline(newOutline);
        try {
            localStorage.setItem('storyOutline', newOutline);
        } catch (e) {
            console.error("Failed to save outline to localStorage", e);
        }
    }, []);

    const handleSaveConfig = useCallback((newConfig: AIConfig) => {
        setConfig(newConfig);
    }, []);

    const handleSaveUISettings = useCallback((newSettings: UISettings) => {
        setUISettings(newSettings);
    }, []);
    
    const handleStartGeneration = useCallback(() => {
        setIsGenerating(true);
        setCurrentStoryId(null); // It's a new story
        setAndPersistOutline(''); // Clear previous outline before generating
        setView('result');
    }, [setAndPersistOutline]);

    const handleSaveToArchive = useCallback(() => {
        if (!novelInfo.name.trim() || !outline.trim()) {
            alert("无法保存：小说名称和大纲内容不能为空。");
            return;
        }

        // BUG FIX: If synopsis is missing, extract it from the outline for the archive card.
        let synopsisToSave = novelInfo.synopsis.trim();
        if (!synopsisToSave) {
            const trimmedOutline = outline.trim();
            // The first paragraph is the text up to the first double newline.
            const firstParagraph = trimmedOutline.split(/\n\s*\n/)[0];
            // Clean up markdown headings and extra whitespace.
            synopsisToSave = firstParagraph.replace(/^#+\s*/, '').replace(/\s+/g, ' ').trim();
        }
        
        // Create a temporary novelInfo object for saving to not affect the UI state.
        const novelInfoForArchive = {
            ...novelInfo,
            synopsis: synopsisToSave,
        };

        const existingIndex = storyArchive.findIndex(item => item.id === currentStoryId);

        if (existingIndex !== -1) {
            const updatedArchive = [...storyArchive];
            updatedArchive[existingIndex] = {
                ...updatedArchive[existingIndex],
                novelInfo: novelInfoForArchive,
                outline,
                lastModified: Date.now()
            };
            // Sort by last modified date
            updatedArchive.sort((a, b) => b.lastModified - a.lastModified);
            setStoryArchive(updatedArchive);
        } else {
            const newArchiveItem: StoryArchiveItem = {
                id: `story-${Date.now()}`,
                type: 'story',
                novelInfo: novelInfoForArchive,
                outline,
                lastModified: Date.now()
            };
            setStoryArchive(prev => [newArchiveItem, ...prev].sort((a, b) => b.lastModified - a.lastModified));
            setCurrentStoryId(newArchiveItem.id);
        }
    }, [currentStoryId, novelInfo, outline, storyArchive]);

    const handleSaveCharacter = useCallback(() => {
        if (!characterProfile.name.trim()) {
            alert("角色名称不能为空。");
            return;
        }

        const description = [characterProfile.image, characterProfile.emotion, characterProfile.competence]
            .filter(Boolean)
            .join(' | ');

        const novelInfoForArchive = {
            name: characterProfile.name.trim(),
            synopsis: description || '暂无描述',
            wordCount: '',
            channel: '' as const,
            emotion: '',
            characterProfileIds: [],
        };
        
        const existingIndex = currentStoryId ? storyArchive.findIndex(item => item.id === currentStoryId && item.type === 'character') : -1;

        if (existingIndex !== -1) {
            // Update
            const updatedArchive = [...storyArchive];
            updatedArchive[existingIndex] = {
                ...updatedArchive[existingIndex],
                novelInfo: novelInfoForArchive,
                characterProfile: characterProfile,
                lastModified: Date.now()
            };
            updatedArchive.sort((a, b) => b.lastModified - a.lastModified);
            setStoryArchive(updatedArchive);
            alert(`角色 “${characterProfile.name}” 已更新。`);
        } else {
            // Create
            // FIX: Add missing 'outline' property to satisfy the 'StoryArchiveItem' type. Characters do not have an outline, so an empty string is appropriate.
            const newArchiveItem: StoryArchiveItem = {
                id: `character-${Date.now()}`,
                type: 'character',
                novelInfo: novelInfoForArchive,
                characterProfile: characterProfile,
                outline: '',
                lastModified: Date.now()
            };
            setStoryArchive(prev => [newArchiveItem, ...prev].sort((a, b) => b.lastModified - a.lastModified));
            setCurrentStoryId(newArchiveItem.id);
            alert(`角色 “${characterProfile.name}” 已保存至存档。`);
        }
    }, [characterProfile, currentStoryId, storyArchive]);

    const handleLoadStory = useCallback((storyId: string) => {
        const storyToLoad = storyArchive.find(item => item.id === storyId);
        if (storyToLoad) {
            const type = storyToLoad.type || 'story';
            if (type === 'character' && storyToLoad.characterProfile) {
                const completeProfile: CharacterProfile = {
                    ...defaultCharacterProfile,
                    ...storyToLoad.characterProfile,
                    name: storyToLoad.novelInfo.name,
                };
                setCurrentStoryId(storyToLoad.id);
                setCharacterProfile(completeProfile);
                setView('characterShaping');
            } else { // 'story'
                setCurrentStoryId(storyToLoad.id);
                setNovelInfo(storyToLoad.novelInfo);
                setAndPersistOutline(storyToLoad.outline);
                setView('result');
            }
        }
    }, [storyArchive, setAndPersistOutline]);

    const handleDeleteStory = useCallback((storyId: string) => {
        if (window.confirm("您确定要删除此存档吗？此操作无法撤销。")) {
            setStoryArchive(prev => prev.filter(item => item.id !== storyId));
            if (currentStoryId === storyId) {
                setCurrentStoryId(null);
                setNovelInfo({ name: '', wordCount: '', synopsis: '', perspective: '', channel: '', emotion: '无', characterProfileIds: [] });
                setAndPersistOutline('');
            }
        }
    }, [currentStoryId, setAndPersistOutline]);

    // BUG FIX & Refactor: The function is now a plain function (no useCallback) to always capture the latest state.
    // It now performs a deep copy of 'selectedCardIds' to prevent any potential downstream mutations
    // from affecting the saved state, which could be the source of the persistent bug.
    const handleSaveCombination = (name: string) => {
        if (!name.trim()) {
            alert("组合名称不能为空。");
            return;
        }
        // Deep copy to prevent reference issues
        const cardsToSave = JSON.parse(JSON.stringify(selectedCardIds));

        const newCombination: SavedCombination = {
            id: `combo-${Date.now()}`,
            name: name.trim(),
            selectedCardIds: cardsToSave,
        };
        setSavedCombinations(prev => [newCombination, ...prev]);
        alert(`组合 “${name.trim()}” 已保存！`);
    };

    // Refactor: Removed useCallback for simplicity and to match the pattern of other handlers.
    // This ensures it always has the latest `savedCombinations` state from the render scope.
    const handleLoadCombination = (combinationId: string) => {
        const combinationToLoad = savedCombinations.find(c => c.id === combinationId);
        if (combinationToLoad) {
            // A deep copy is also good practice here when loading state.
            const cardsToLoad = JSON.parse(JSON.stringify(combinationToLoad.selectedCardIds));
            setSelectedCardIds(cardsToLoad);
            alert(`已加载组合 “${combinationToLoad.name}”！`);
        }
    };

    // Refactor: Removed useCallback for consistency, although the original was safe due to functional updates.
    const handleDeleteCombination = (combinationId: string) => {
        if (window.confirm("您确定要删除此组合吗？")) {
            setSavedCombinations(prev => prev.filter(c => c.id !== combinationId));
        }
    };


    const handleCardSelect = useCallback((card: Card, index: number) => {
        setSelectedCardIds(prev => {
            const newIds = { ...prev };
            if (!newIds[card.type]) {
                newIds[card.type] = [];
            }
            const typeArray = [...(newIds[card.type] || [])];
            typeArray[index] = card.id;
            newIds[card.type] = typeArray;
            return newIds;
        });
    }, []);

    const handleCreateCard = useCallback((newCardData: Omit<Card, 'id' | 'icon' | 'isCustom'>) => {
        const newCard: Card = {
            ...newCardData,
            id: `custom-${Date.now()}`,
            icon: <SparklesIcon className="w-6 h-6" />,
            isCustom: true,
        };
        setCustomCards(prev => [...prev, newCard]);
    }, []);
    
    const handleUpdateCard = useCallback((updatedCard: Card) => {
        setCustomCards(prev => prev.map(card => card.id === updatedCard.id ? updatedCard : card));
    }, []);

    const handleDeleteCard = useCallback((cardId: string) => {
        setCustomCards(prev => prev.filter(card => card.id !== cardId));
        // Also clear the card if it was selected
        setSelectedCardIds(prev => {
            const newSelection = { ...prev };
            let changed = false;
            for (const key in newSelection) {
                const cardType = key as CardType;
                const idArray = newSelection[cardType];
                if (idArray && idArray.includes(cardId)) {
                    newSelection[cardType] = idArray.map(id => id === cardId ? null : id);
                    changed = true;
                }
            }
            return changed ? newSelection : prev;
        });
    }, []);

    const handleClearCard = useCallback((cardType: CardType, index: number) => {
        setSelectedCardIds(prev => {
            const newIds = { ...prev };
            const typeArray = [...(newIds[cardType] || [])];
            typeArray[index] = null;
            newIds[cardType] = typeArray;
            return newIds;
        });
    }, []);

    const handleAddCardSlot = useCallback((cardType: CardType) => {
        setSelectedCardIds(prev => {
            const currentSlots = prev[cardType] || [];
            if (currentSlots.length < 3) {
                return {
                    ...prev,
                    [cardType]: [...currentSlots, null],
                };
            }
            return prev;
        });
    }, []);

    const handleRemoveCardSlot = useCallback((cardType: CardType, index: number) => {
        setSelectedCardIds(prev => {
            const currentSlots = prev[cardType] || [];
            // Prevent deleting if it's the first slot or the only slot left
            if (currentSlots.length <= 1 || index === 0) {
                return prev;
            }
            const newSlots = [...currentSlots];
            newSlots.splice(index, 1); // Remove the item at the given index
            return {
                ...prev,
                [cardType]: newSlots,
            };
        });
    }, []);


    const handleCreateInspirationCard = useCallback((categoryId: string, newItemData: { title: string; description: string }) => {
        setInspirationCards(prevCards => {
            const newCards = prevCards.map(category => {
                if (category.id === categoryId) {
                    const newItem: InspirationItem = {
                        ...newItemData,
                        id: Date.now(),
                        isCustom: true,
                    };
                    return {
                        ...category,
                        items: [...category.items, newItem],
                    };
                }
                return category;
            });
            return newCards;
        });
    }, []);

    const handleUpdateInspirationCard = useCallback((categoryId: string, updatedItem: InspirationItem) => {
        setInspirationCards(prev => prev.map(category => {
            if (category.id === categoryId) {
                return {
                    ...category,
                    items: category.items.map(item => item.id === updatedItem.id ? updatedItem : item)
                };
            }
            return category;
        }));
    }, []);

    const handleDeleteInspirationCard = useCallback((categoryId: string, itemId: number, itemName: string) => {
        if (!window.confirm(`您确定要删除灵感 “${itemName}” 吗？`)) return;

        setInspirationCards(prev => prev.map(category => {
            if (category.id === categoryId) {
                return {
                    ...category,
                    items: category.items.filter(item => item.id !== itemId)
                };
            }
            return category;
        }));

        // Also unselect it if it's selected
        const cardIdToClear = `inspiration-${categoryId}-${itemId}`;
        setSelectedCardIds(prev => {
            const inspirationSlots = prev[CardTypeEnum.Inspiration] || [];
            if (inspirationSlots.includes(cardIdToClear)) {
                return { 
                    ...prev, 
                    [CardTypeEnum.Inspiration]: inspirationSlots.map(id => id === cardIdToClear ? null : id)
                };
            }
            return prev;
        });
    }, []);
    
    const handleInspirationCardDragStart = useCallback(() => {
        // Use a timeout to ensure the drag event is properly initiated
        // before the view changes, which can sometimes interrupt the drag operation.
        setTimeout(() => setView('writer'), 0);
    }, []);

    const handleInspirationCardClick = useCallback((cardId: string) => {
        const foundCard = allCards.find(card => card.id === cardId);
        if (foundCard && foundCard.type === CardTypeEnum.Inspiration) {
            // Find the first empty inspiration slot and fill it
            setSelectedCardIds(prev => {
                const inspirationSlots = prev[CardTypeEnum.Inspiration] || [null];
                const emptyIndex = inspirationSlots.findIndex(id => id === null);
                const newSlots = [...inspirationSlots];
                if (emptyIndex !== -1) {
                    newSlots[emptyIndex] = foundCard.id;
                } else {
                    // This case should ideally be handled by disabling the button/drag if full
                    newSlots[0] = foundCard.id; // Fallback: replace the first one
                }
                return { ...prev, [CardTypeEnum.Inspiration]: newSlots };
            });
        }
    }, [allCards]);

    const handleClearCharacterForm = useCallback(() => {
        if (window.confirm("您确定要清空所有角色塑造信息吗？此操作无法撤销。")) {
            setCurrentStoryId(null);
            setCharacterProfile(defaultCharacterProfile);
        }
    }, [defaultCharacterProfile]);


    const renderView = () => {
        switch (view) {
            case 'writer':
                return (
                    <WriterView 
                        config={config} 
                        setConfig={setConfig}
                        onStartGeneration={handleStartGeneration}
                        combinedCards={combinedCards}
                        onCardSelect={handleCardSelect}
                        onClearCard={handleClearCard}
                        onAddCardSlot={handleAddCardSlot}
                        onRemoveCardSlot={handleRemoveCardSlot}
                        novelInfo={novelInfo}
                        setNovelInfo={setNovelInfo}
                        allCards={allCards}
                        onCreateCard={handleCreateCard}
                        onUpdateCard={handleUpdateCard}
                        onDeleteCard={handleDeleteCard}
                        uiSettings={uiSettings}
                        savedCombinations={savedCombinations}
                        onSaveCombination={handleSaveCombination}
                        onLoadCombination={handleLoadCombination}
                        onDeleteCombination={handleDeleteCombination}
                        storyArchive={storyArchive}
                    />
                );
            case 'result':
                return <ResultView 
                            outline={outline} 
                            setOutline={setAndPersistOutline} 
                            config={config}
                            setConfig={setConfig}
                            novelInfo={novelInfo}
                            setNovelInfo={setNovelInfo}
                            uiSettings={uiSettings}
                            isGenerating={isGenerating}
                            setIsGenerating={setIsGenerating}
                            combinedCards={combinedCards}
                            allCards={allCards}
                            onSaveToArchive={handleSaveToArchive}
                            assistantHistory={assistantHistory}
                            setAssistantHistory={setAssistantHistory}
                            chatHistory={chatHistory}
                            setChatHistory={setChatHistory}
                            storyArchive={storyArchive}
                        />;
            case 'inspiration':
                return <InspirationView 
                            inspirationCards={inspirationCards} 
                            onCreateCard={handleCreateInspirationCard}
                            onUpdateCard={handleUpdateInspirationCard}
                            onDeleteCard={handleDeleteInspirationCard}
                            onCardDragStart={handleInspirationCardDragStart}
                            onCardClick={handleInspirationCardClick}
                            selectedInspirationCardId={selectedCardIds[CardTypeEnum.Inspiration]?.[0]}
                        />;
            case 'tips':
                return <TipsView 
                            topics={topics}
                            setTopics={setTopics}
                            config={config} 
                            storyArchive={storyArchive}
                        />;
            case 'characterShaping':
                return <CharacterShapingView 
                            profile={characterProfile}
                            setProfile={setCharacterProfile}
                            config={config}
                            onSaveCharacter={handleSaveCharacter}
                            onClearAll={handleClearCharacterForm}
                        />;
            case 'archive':
                return <ArchiveView
                            archive={storyArchive}
                            onLoadStory={handleLoadStory}
                            onDeleteStory={handleDeleteStory}
                        />;
            case 'settings':
                return <SettingsView 
                            currentConfig={config} 
                            onSave={handleSaveConfig}
                            currentUISettings={uiSettings}
                            onSaveUISettings={handleSaveUISettings}
                        />;
            case 'about':
                return <AboutView />;
            default:
                 return (
                    <WriterView 
                        config={config} 
                        setConfig={setConfig}
                        onStartGeneration={handleStartGeneration}
                        combinedCards={combinedCards}
                        onCardSelect={handleCardSelect}
                        onClearCard={handleClearCard}
                        onAddCardSlot={handleAddCardSlot}
                        onRemoveCardSlot={handleRemoveCardSlot}
                        novelInfo={novelInfo}
                        setNovelInfo={setNovelInfo}
                        allCards={allCards}
                        onCreateCard={handleCreateCard}
                        onUpdateCard={handleUpdateCard}
                        onDeleteCard={handleDeleteCard}
                        uiSettings={uiSettings}
                        savedCombinations={savedCombinations}
                        onSaveCombination={handleSaveCombination}
                        onLoadCombination={handleLoadCombination}
                        onDeleteCombination={handleDeleteCombination}
                        storyArchive={storyArchive}
                    />
                );
        }
    }

    return (
        <div className="h-screen flex overflow-hidden bg-slate-50 dark:bg-zinc-900">
            <Sidebar currentView={view} setView={setView} />
            <main className="flex-1 p-6 sm:p-8 lg:p-10 flex flex-col">
                {renderView()}
            </main>
        </div>
    );
};

export default App;