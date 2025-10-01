
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import type { AIConfig, ChatMessage, StoryArchiveItem, Topic } from '../types';
import { UserCircleIcon, ArrowsRightLeftIcon, GlobeAltIcon, AiIcon, ArrowUpIcon, StopIcon, ClipboardDocumentIcon, PencilIcon, ArrowPathIcon, FireIcon, Bars3BottomLeftIcon, PlusIcon } from './icons';
import Spinner from './Spinner';
import { generateChatResponse, fetchModels } from '../services/aiService';

interface TipsViewProps {
    histories: { [key: string]: ChatMessage[] };
    setHistories: React.Dispatch<React.SetStateAction<{ [key: string]: ChatMessage[] }>>;
    topics: Topic[];
    setTopics: React.Dispatch<React.SetStateAction<Topic[]>>;
    config: AIConfig;
    storyArchive: StoryArchiveItem[];
}

const BRAINSTORM_TOOLS = [
    {
        id: 'character',
        name: '角色深潜',
        description: '深入挖掘角色的动机、矛盾与背景故事。',
        icon: <UserCircleIcon className="w-6 h-6" />,
        systemPrompt: '你是一位经验丰富的小说编辑，擅长通过提问来帮助作者深化角色。你的回答应该简洁、具有启发性，并始终以开放式问题结尾，引导用户思考。',
        initialMessage: '你好！让我们来深入探索你的角色吧。请先告诉我这个角色的基本设定，比如他/她的名字、职业和最大的愿望是什么？',
    },
    {
        id: 'plot',
        name: '情节风暴',
        description: '生成颠覆性场景，打破思维定式。',
        icon: <ArrowsRightLeftIcon className="w-6 h-6" />,
        systemPrompt: "你是一个充满奇思妙想的创意引擎。你的任务是针对用户遇到的情节瓶颈，生成多个颠覆性的 'What If...?' (如果...会怎样?) 场景。每个场景都要简短、有力，并能激发新的故事可能性。",
        initialMessage: "情节卡壳了？没关系，我们来一场头脑风暴！告诉我你现在卡住的情节是什么，比如：‘主角需要进入一座守卫森严的城堡，但不知道怎么进去。’ 我会为你提供一些意想不到的思路。",
    },
    {
        id: 'world',
        name: '世界构建',
        description: '为故事世界增添独特的规则、文化与细节。',
        icon: <GlobeAltIcon className="w-6 h-6" />,
        systemPrompt: '你是一位世界构建大师，知识渊博，想象力丰富。你会帮助用户为他们的故事世界添加独特而可信的细节。你的回答应该具体、富有画面感，并能引申出更多相关的设定。',
        initialMessage: '让我们一起构建一个令人难忘的世界吧！请先描述一下你的世界的基本样貌。它是奇幻王国，是赛博朋克都市，还是别的什么？告诉我它的核心特点，我们可以从那里开始。',
    },
    {
        id: 'worse',
        name: '还能更糟吗',
        description: '基于当前困境，生成五个让情况更糟的可能性。',
        icon: <FireIcon className="w-6 h-6" />,
        systemPrompt: '### 角色：创意写作助手情节设计专家\n### 背景：我的故事目前进展到以下内容\n### 任务：\n基于“还能更糟吗？“的原则，请帮我头脑风暴，想出五种能让当前情况变得更加糟糕、更具戏剧性或更出乎意料的可能性。\n请从不同角度思考，例如：\n* **外部冲突加剧：**（比如：出现新的敌人、环境突变、时间限制等）\n* **内部冲突激化：**（比如：主角的旧伤复发、道德困境加深、队友背叛等）\n* **引入新麻烦：**（比如：节外生枝的新问题、无辜者被卷入、之前的言被揭穿等）\n* **失去关键物品/信息/优势：**\n### 转出要求：\n请以列表形式给出具体的“更糟糕“情况，并简要说明它为什么更糟。\n### 重要：\n    -   可以添加一些自然的语言瑕疵，比如口语化表达或轻微的语法不规范，避免过于完美。\n    -   不要有AI味儿的表达，要像人类作家一样自然、口语化。\n    -   保持专业性，但可以融入你作为小说作家的个人风格。\n    -   请记住，你的目标是将用户给的原文细化，扩写成一段富有画面感、层次感和情感深度的文字，但不需要展示你的思考过程。\n    -   请直接用简体中文输出内容，不需要任何额外的解释或说明。\n    -   朱雀v3检测置信度＜20%。',
        initialMessage: '故事卡住了？别怕，有时候让事情变得更糟，反而能找到出路。把你的主角现在面临的困境告诉我，我们一起看看还能怎么火上浇油！',
    },
    {
        id: 'deduction',
        name: '逻辑推演',
        description: '根据一个关键事件，推演其可能引发的多个后果。',
        icon: <Bars3BottomLeftIcon className="w-6 h-6" />,
        systemPrompt: '### 角色：故事逻辑推演助手/因果链分析师\n### 核心事件/原因（石子）：\n我的故事中发生了这个关键事件\n### 任务：\n基于“涟漪法”的因果逻辑，请帮我推演这个事件可能引发的[数字，例如5—7个]个直接或间接的**后果（涟漪）**。\n请从不同层面思考可能的后果，例如：\n* **对主角的直接影响：**（行动、情绪、处境的变化）\n* **对其他角色的影响：**（他们的反应、立场变化、与主角关系的变化）\n* **对故事情节的推动：**（新的冲突点、新的目标、新的谜团）\n* **对故事世界/环境的影响：**（社会奥论、规则改变、物理环境变化等）\n### 输出要求：\n请以列表形式给出可能的后果，并简要说这个后果是如何从核心事件逻辑推导出来的。最好能标注出哪些是比较直接的后果，哪些是间接的、更深远的后果。\n### 重要：\n    -   可以添加一些自然的语言瑕疵，比如口语化表达或轻微的语法不规范，避免过于完美。\n    -   不要有AI味儿的表达，要像人类作家一样自然、口语化。\n    -   保持专业性，但可以融入你作为小说作家的个人风格。\n    -   请记住，你的目标是故事结构架构师，将用户给的原文细化，扩写成一段富有画面感、层次感和情感深度的文字，但不需要展示你的思考过程。\n    -   请直接用简体中文输出内容，不需要任何额外的解释或说明。\n    -   朱雀v3检测置信度＜20%。',
        initialMessage: '一个好故事就像多米诺骨牌，一件事会引发另一件。告诉我你故事里的那颗‘石子’——那个关键的事件或原因，我们一起来看看它会激起怎样的涟漪。',
    },
];

const TipsView: React.FC<TipsViewProps> = ({ histories, setHistories, topics, setTopics, config, storyArchive }) => {
    const [activeTab, setActiveTab] = useState<'roles' | 'topics'>('roles');
    
    // State for 'roles' tab
    const [selectedToolId, setSelectedToolId] = useState<string | null>(null);
    const [selectedOutlineId, setSelectedOutlineId] = useState<string>('');
    
    // State for 'topics' tab
    const [activeTopicId, setActiveTopicId] = useState<string | null>(null);

    // Shared chat state
    const [chatInput, setChatInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [editingMessage, setEditingMessage] = useState<{ id: string; content: string } | null>(null);
    const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
    
    // Model selector states
    const [localModel, setLocalModel] = useState<string>(config.assistantModel || config.model);
    const [isModelSelectOpen, setIsModelSelectOpen] = useState(false);
    const [modelList, setModelList] = useState<string[]>([]);
    const [isModelListLoading, setIsModelListLoading] = useState(false);
    const [modelSearch, setModelSearch] = useState('');

    const abortControllerRef = useRef<AbortController | null>(null);
    const chatContainerRef = useRef<HTMLDivElement | null>(null);
    const chatInputRef = useRef<HTMLTextAreaElement | null>(null);
    const modelSelectRef = useRef<HTMLDivElement | null>(null);
    
    const { currentHistory, setCurrentHistory } = useMemo(() => {
        if (activeTab === 'roles') {
            const history = histories[selectedToolId || ''] || [];
            const setHistory = (updater: React.SetStateAction<ChatMessage[]>) => {
                if (!selectedToolId) return;
                setHistories(prev => ({
                    ...prev,
                    [selectedToolId]: typeof updater === 'function' ? updater(prev[selectedToolId] || []) : updater,
                }));
            };
            return { currentHistory: history, setCurrentHistory: setHistory };
        } else { // activeTab === 'topics'
            const activeTopic = topics.find(t => t.id === activeTopicId);
            const history = activeTopic ? activeTopic.history : [];
            const setHistory = (updater: React.SetStateAction<ChatMessage[]>) => {
                 if (!activeTopicId) return;
                 setTopics(prevTopics => prevTopics.map(t => {
                     if (t.id === activeTopicId) {
                         const newHistory = typeof updater === 'function' ? updater(t.history) : updater;
                         return { ...t, history: newHistory, lastModified: Date.now() };
                     }
                     return t;
                 }));
            };
            return { currentHistory: history, setCurrentHistory: setHistory };
        }
    }, [activeTab, selectedToolId, histories, setHistories, activeTopicId, topics, setTopics]);

    const handleSelectTool = (toolId: string) => {
        setSelectedToolId(toolId);
        setSelectedOutlineId(''); // Reset context when switching tool
    };

     useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [currentHistory]);

    // Initialize history for a newly selected tool
    useEffect(() => {
        if (activeTab === 'roles' && selectedToolId && (!histories[selectedToolId] || histories[selectedToolId].length === 0)) {
            const tool = BRAINSTORM_TOOLS.find(t => t.id === selectedToolId);
            if (tool) {
                const newHistory: ChatMessage[] = [
                    { id: `sys-${tool.id}-${Date.now()}`, role: 'system', content: tool.systemPrompt },
                    { id: `model-${tool.id}-${Date.now()}`, role: 'model', content: tool.initialMessage },
                ];
                setCurrentHistory(newHistory);
            }
        }
    }, [activeTab, selectedToolId, histories, setCurrentHistory]);


    // Effect to fetch models for the chat
    useEffect(() => {
        const loadModels = async () => {
            if (!config.provider) return;
            if (config.provider === 'gemini') {
                setModelList(['gemini-2.5-flash']);
                setLocalModel('gemini-2.5-flash');
                return;
            }

            setIsModelListLoading(true);
            try {
                const models = await fetchModels(config);
                setModelList(models);
                if (models.length > 0) {
                    const preferredModel = (config.assistantModel && models.includes(config.assistantModel))
                        ? config.assistantModel
                        : (config.model && models.includes(config.model))
                            ? config.model
                            : models[0];
                    setLocalModel(preferredModel);
                }
            } catch (error) {
                console.error("Failed to fetch models for tips view:", error);
                setModelList([]);
            } finally {
                setIsModelListLoading(false);
            }
        };

        loadModels();
    }, [config.provider, config.apiKey, config.endpoint, config.model, config.assistantModel]);
    
    // Effect to handle clicking outside the model selector dropdown
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (modelSelectRef.current && !modelSelectRef.current.contains(event.target as Node)) {
                setIsModelSelectOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);


    const triggerChatGeneration = useCallback(async (historyToUse: ChatMessage[]) => {
        setIsLoading(true);
        const controller = new AbortController();
        abortControllerRef.current = controller;
        
        try {
            let accumulatedResponse = "";
            setCurrentHistory(prev => [...prev, { id: `model-streaming-${Date.now()}`, role: 'model', content: '' }]);
            
            const chatConfig = { ...config, model: localModel };
            const stream = generateChatResponse(historyToUse, chatConfig, controller.signal);

            for await (const chunk of stream) {
                accumulatedResponse += chunk;
                setCurrentHistory(prev => {
                    const nextHistory = [...prev];
                    const lastMessage = nextHistory[nextHistory.length - 1];
                    if (lastMessage && lastMessage.role === 'model') {
                        lastMessage.content = accumulatedResponse;
                    }
                    return nextHistory;
                });
            }
        } catch (err) {
            if (err instanceof DOMException && err.name === 'AbortError') {
                 setCurrentHistory(prev => {
                    const newHistory = [...prev];
                    const lastMessage = newHistory[newHistory.length - 1];
                    if (lastMessage && lastMessage.role === 'model') {
                        if (lastMessage.content.trim() === '') {
                            lastMessage.content = '（已取消）';
                        } else {
                            lastMessage.content += '\n（已中断）';
                        }
                    }
                    return newHistory;
                });
            } else {
                const errorMessage = err instanceof Error ? err.message : '发生未知错误。';
                alert(errorMessage);
                setCurrentHistory(prev => [...prev, { id: `sys-err-${Date.now()}`, role: 'system', content: `抱歉，操作失败: ${errorMessage}` }]);
            }
        } finally {
            setIsLoading(false);
            abortControllerRef.current = null;
        }
    }, [setCurrentHistory, config, localModel]);


    const handleChatSubmit = useCallback(async (e: React.SyntheticEvent) => {
        e.preventDefault();
        const message = chatInput.trim();
        if (!message || isLoading) return;

        setChatInput('');
        if (chatInputRef.current) chatInputRef.current.style.height = 'auto';
        
        const newUserMessage: ChatMessage = { id: `user-${Date.now()}`, role: 'user', content: message };
        const newHistory = [...currentHistory, newUserMessage];
        setCurrentHistory(newHistory);
        await triggerChatGeneration(newHistory);
    }, [chatInput, isLoading, currentHistory, setCurrentHistory, triggerChatGeneration]);
    
    const handleOutlineChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newOutlineId = e.target.value;
        setSelectedOutlineId(newOutlineId);

        if (selectedToolId) {
            const tool = BRAINSTORM_TOOLS.find(t => t.id === selectedToolId);
            if (!tool) return;

            const selectedStory = storyArchive.find(s => s.id === newOutlineId);
            let systemPrompt = tool.systemPrompt;
            let initialMessage = tool.initialMessage;

            if (selectedStory) {
                const outlineSnippet = selectedStory.outline.length > 1500 ? selectedStory.outline.substring(0, 1500) + '...' : selectedStory.outline;
                systemPrompt += `\n\n我们正在围绕以下故事大纲进行讨论：\n标题：${selectedStory.novelInfo.name}\n---\n${outlineSnippet}\n---`;
                initialMessage = `好的，我们来聊聊大纲《${selectedStory.novelInfo.name}》。你想从哪里开始呢？`;
            }

            const newHistory: ChatMessage[] = [
                { id: `sys-${tool.id}-${Date.now()}`, role: 'system', content: systemPrompt },
                { id: `model-${tool.id}-${Date.now()}`, role: 'model', content: initialMessage },
            ];
            setCurrentHistory(newHistory);
        }
    };
    
    const handleCopy = (content: string, messageId: string) => {
        navigator.clipboard.writeText(content).then(() => {
            setCopiedMessageId(messageId);
            setTimeout(() => setCopiedMessageId(null), 2000);
        });
    };
    
    const handleEditSave = () => {
        if (!editingMessage) return;
        setCurrentHistory(prev => prev.map(msg => msg.id === editingMessage.id ? { ...msg, content: editingMessage.content } : msg));
        setEditingMessage(null);
    };

    const handleRegenerate = useCallback(async (messageIdToRegen: string) => {
        const messageIndex = currentHistory.findIndex(msg => msg.id === messageIdToRegen);
        // Can't regenerate user message or first message (system prompt)
        if (messageIndex <= 0 || currentHistory[messageIndex].role === 'user') return;
        
        // History up to the message before the one we're regenerating
        const historyToResend = currentHistory.slice(0, messageIndex);
        
        // Set the history to this truncated version
        setCurrentHistory(historyToResend);

        // Trigger generation with this history
        await triggerChatGeneration(historyToResend);
    }, [currentHistory, setCurrentHistory, triggerChatGeneration]);

    
    const handleChatInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setChatInput(e.target.value);
        const textarea = e.target;
        textarea.style.height = 'auto';
        const maxHeight = 120; // Max height in pixels
        textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
    };
    
    const handleInterrupt = () => {
        abortControllerRef.current?.abort();
    };

    const filteredModels = useMemo(() => {
        if (!modelSearch) return modelList;
        return modelList.filter(m => m.toLowerCase().includes(modelSearch.toLowerCase()));
    }, [modelList, modelSearch]);

    const handleNewTopic = () => {
        const newTopic: Topic = {
            id: `topic-${Date.now()}`,
            name: '默认话题',
            lastModified: Date.now(),
            history: [{ id: `sys-new-${Date.now()}`, role: 'system', content: '这是一个新的对话话题。' }],
        };
        setTopics(prev => [newTopic, ...prev].sort((a, b) => b.lastModified - a.lastModified));
        setActiveTopicId(newTopic.id);
    };

    const handleDeleteTopic = (e: React.MouseEvent, topicId: string) => {
        e.stopPropagation();
        if (window.confirm("您确定要删除这个话题吗？此操作无法撤销。")) {
            setTopics(prev => prev.filter(t => t.id !== topicId));
            if (activeTopicId === topicId) {
                setActiveTopicId(null);
            }
        }
    };

    const sortedTopics = useMemo(() => [...topics].sort((a, b) => b.lastModified - a.lastModified), [topics]);
    const activeTopic = topics.find(t => t.id === activeTopicId);

    return (
        <div className="w-full h-full flex flex-col">
            <header className="flex-shrink-0 mb-6">
                 <div>
                    <h1 className="text-3xl font-bold text-gray-800 dark:text-zinc-100">AI 头脑风暴</h1>
                    <p className="mt-2 text-gray-600 dark:text-zinc-300">
                        遇到瓶颈了吗？选择一个工具，让 AI 扮演您的专属创意伙伴，通过对话帮您解决创作难题。
                    </p>
                </div>
            </header>
            <div className="flex-grow flex gap-4 min-h-0">
                {/* Left Panel */}
                <aside className="w-72 flex-shrink-0 bg-white rounded-xl border border-gray-200 shadow-sm dark:bg-zinc-800 dark:border-zinc-700 flex flex-col">
                    <div className="p-2 flex-shrink-0">
                        <div className="flex items-center gap-1 rounded-lg bg-gray-100 dark:bg-zinc-900/60 p-1">
                            <button
                                onClick={() => setActiveTab('roles')}
                                className={`w-full py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${
                                    activeTab === 'roles' 
                                    ? 'bg-white text-gray-800 shadow-sm dark:bg-zinc-700 dark:text-zinc-100' 
                                    : 'text-gray-600 hover:bg-white/50 dark:text-zinc-400 dark:hover:bg-zinc-700/50'
                                }`}
                            >
                                角色
                            </button>
                            <button
                                onClick={() => setActiveTab('topics')}
                                className={`w-full py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${
                                    activeTab === 'topics' 
                                    ? 'bg-white text-gray-800 shadow-sm dark:bg-zinc-700 dark:text-zinc-100' 
                                    : 'text-gray-600 hover:bg-white/50 dark:text-zinc-400 dark:hover:bg-zinc-700/50'
                                }`}
                            >
                                话题
                            </button>
                        </div>
                    </div>
                    
                    {activeTab === 'roles' ? (
                        <div className="flex-grow overflow-y-auto custom-scrollbar px-3 pb-3">
                            <div className="space-y-1">
                                {BRAINSTORM_TOOLS.map(tool => (
                                    <button
                                        key={tool.id}
                                        onClick={() => handleSelectTool(tool.id)}
                                        className={`w-full text-left p-3 rounded-lg border-2 transition-all duration-200 ${
                                            selectedToolId === tool.id 
                                            ? 'bg-blue-50 border-blue-500 dark:bg-blue-900/30 dark:border-blue-500' 
                                            : 'bg-transparent border-transparent hover:bg-slate-100/70 dark:hover:bg-zinc-700/50'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`p-1 rounded-lg ${selectedToolId === tool.id ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-zinc-400'}`}>
                                                {tool.icon}
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-gray-800 dark:text-zinc-100 text-sm">{tool.name}</h3>
                                                <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1">{tool.description}</p>
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="p-3 border-t border-gray-100 dark:border-zinc-700/50">
                                <button
                                    onClick={handleNewTopic}
                                    className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600"
                                >
                                    <PlusIcon className="w-4 h-4" />
                                    <span>新建话题</span>
                                </button>
                            </div>
                            <div className="flex-grow overflow-y-auto custom-scrollbar p-2">
                                <div className="space-y-1">
                                    {sortedTopics.map(topic => (
                                        <button
                                            key={topic.id}
                                            onClick={() => setActiveTopicId(topic.id)}
                                            className={`w-full text-left p-3 rounded-lg relative group ${
                                                activeTopicId === topic.id ? 'bg-blue-50 dark:bg-blue-900/30' : 'hover:bg-gray-100 dark:hover:bg-zinc-700/50'
                                            }`}
                                        >
                                            <h3 className="font-medium text-sm text-gray-800 dark:text-zinc-100 truncate pr-6">{topic.name}</h3>
                                            <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1">{new Date(topic.lastModified).toLocaleString()}</p>
                                            <div
                                                onClick={(e) => handleDeleteTopic(e, topic.id)}
                                                className="absolute top-1/2 -translate-y-1/2 right-2 p-1.5 rounded-full text-gray-400 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/50 dark:hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                                title="删除话题"
                                            >
                                                &times;
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}
                </aside>

                {/* Right Panel: Chat Interface */}
                <main className="flex-1 flex flex-col bg-white rounded-xl border border-gray-200 shadow-sm dark:bg-zinc-800 dark:border-zinc-700 min-h-0">
                    {((activeTab === 'roles' && selectedToolId) || (activeTab === 'topics' && activeTopicId)) ? (
                        <>
                             <header className="flex-shrink-0 p-3 border-b border-gray-200 dark:border-zinc-700 flex justify-between items-center">
                                {activeTab === 'roles' && BRAINSTORM_TOOLS.find(t => t.id === selectedToolId) ? (
                                    <>
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 rounded-lg text-blue-600 dark:text-blue-400">
                                                {BRAINSTORM_TOOLS.find(t => t.id === selectedToolId)?.icon}
                                            </div>
                                            <h2 className="text-xl font-semibold text-gray-800 dark:text-zinc-100">{BRAINSTORM_TOOLS.find(t => t.id === selectedToolId)?.name}</h2>
                                        </div>
                                        <div className="relative">
                                            <select
                                                value={selectedOutlineId}
                                                onChange={handleOutlineChange}
                                                className="max-w-xs pl-3 pr-8 py-1.5 text-sm bg-white border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-gray-500 focus:border-gray-500 appearance-none transition-all dark:bg-zinc-700 dark:border-zinc-600 dark:text-zinc-100"
                                            >
                                                <option value="">选择大纲 (可选)</option>
                                                {storyArchive.map(story => (
                                                    <option key={story.id} value={story.id}>
                                                        {story.novelInfo.name}
                                                    </option>
                                                ))}
                                            </select>
                                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700 dark:text-zinc-300">
                                                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <h2 className="text-xl font-semibold text-gray-800 dark:text-zinc-100 px-4">{activeTopic?.name || '新话题'}</h2>
                                )}
                            </header>
                            <div ref={chatContainerRef} className="flex-grow p-4 space-y-4 overflow-y-auto custom-scrollbar">
                                {currentHistory.map((msg, index) => {
                                    if (msg.role === 'system') return null;
                                    
                                    const isUser = msg.role === 'user';
                                    const isLastMessageStreaming = isLoading && index === currentHistory.length - 1 && !isUser;

                                    if (editingMessage && editingMessage.id === msg.id) {
                                        return (
                                            <div key={msg.id} className="p-2">
                                                <textarea
                                                    value={editingMessage.content}
                                                    onChange={(e) => setEditingMessage({ ...editingMessage, content: e.target.value })}
                                                    className="w-full p-2 border border-blue-400 rounded-md bg-blue-50 dark:bg-zinc-600"
                                                    rows={5}
                                                />
                                                <div className="mt-2 flex justify-end gap-2">
                                                    <button onClick={() => setEditingMessage(null)} className="text-sm px-3 py-1 rounded bg-gray-200 dark:bg-zinc-500">取消</button>
                                                    <button onClick={handleEditSave} className="text-sm px-3 py-1 rounded bg-blue-600 text-white">保存</button>
                                                </div>
                                            </div>
                                        );
                                    }

                                    return (
                                        <div key={msg.id} className={`flex items-start gap-2.5 group ${isUser ? 'justify-end' : 'justify-start'}`}>
                                            {!isUser && (
                                                <div className="w-8 h-8 flex-shrink-0 rounded-full bg-gradient-to-br from-purple-400 to-yellow-300 flex items-center justify-center shadow-sm">
                                                    <AiIcon className="w-5 h-5 text-white" />
                                                </div>
                                            )}
                                             <div className={`flex items-center gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                                                <div className={`max-w-[85%] px-4 py-3 rounded-2xl ${
                                                    isUser 
                                                        ? 'bg-blue-600 text-white rounded-br-md' 
                                                        : 'bg-gray-100 text-gray-800 rounded-bl-md dark:bg-zinc-700 dark:text-zinc-200'
                                                }`} style={{ opacity: 1 }}>
                                                    <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">
                                                        {isLastMessageStreaming && !msg.content ? <Spinner /> : msg.content}
                                                        {isLastMessageStreaming && msg.content ? <span className="inline-block w-2 h-4 bg-gray-600 dark:bg-zinc-400 animate-pulse ml-1" /> : null}
                                                    </p>
                                                </div>
                                                 {!isLoading && (
                                                    <div className={`flex-shrink-0 self-center flex gap-1 transition-opacity ${isUser ? 'pr-1' : 'pl-1'} opacity-0 group-hover:opacity-100`}>
                                                        <button onClick={() => handleCopy(msg.content, msg.id)} title="复制" className="p-1.5 text-gray-400 hover:text-gray-700 dark:text-zinc-500 dark:hover:text-zinc-200 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-700">
                                                            {copiedMessageId === msg.id ? <span className="text-xs">已复制</span> : <ClipboardDocumentIcon className="w-4 h-4" />}
                                                        </button>
                                                        <button onClick={() => setEditingMessage({id: msg.id, content: msg.content})} title="编辑" className="p-1.5 text-gray-400 hover:text-gray-700 dark:text-zinc-500 dark:hover:text-zinc-200 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-700"><PencilIcon className="w-4 h-4"/></button>
                                                        {!isUser && <button onClick={() => handleRegenerate(msg.id)} title="重新生成" className="p-1.5 text-gray-400 hover:text-gray-700 dark:text-zinc-500 dark:hover:text-zinc-200 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-700"><ArrowPathIcon className="w-4 h-4"/></button>}
                                                    </div>
                                                )}
                                             </div>
                                        </div>
                                    );
                                })}
                                {isLoading && currentHistory.length > 0 && currentHistory[currentHistory.length - 1].role === 'user' && (
                                    <div className="flex justify-start">
                                        <div className="max-w-[85%] px-4 py-2 rounded-xl bg-gray-100 text-gray-800 flex items-center gap-2 dark:bg-zinc-700 dark:text-zinc-200">
                                            <Spinner />
                                            <span className="text-sm">正在思考...</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="flex-shrink-0 p-4 border-t border-gray-200 dark:border-zinc-700">
                                <form onSubmit={handleChatSubmit} className="relative">
                                     <div ref={modelSelectRef} className="absolute bottom-2.5 left-3 z-10">
                                        <button
                                            type="button"
                                            onClick={() => setIsModelSelectOpen(prev => !prev)}
                                            className="p-2 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:text-zinc-500 dark:hover:text-zinc-300 dark:hover:bg-zinc-600 transition-colors"
                                            aria-label="选择AI模型"
                                            title="选择AI模型"
                                            aria-haspopup="true"
                                            aria-expanded={isModelSelectOpen}
                                        >
                                            <AiIcon className="w-5 h-5" />
                                        </button>
                                        {isModelSelectOpen && (
                                            <div className="absolute bottom-full mb-2 w-56 bg-white dark:bg-zinc-800 rounded-lg shadow-lg border border-gray-200 dark:border-zinc-700 z-20">
                                                <div className="p-2">
                                                    <input
                                                        type="text"
                                                        value={modelSearch}
                                                        onChange={e => setModelSearch(e.target.value)}
                                                        placeholder="搜索模型..."
                                                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-500 focus:border-gray-500 dark:bg-zinc-700 dark:border-zinc-600 dark:text-white"
                                                    />
                                                </div>
                                                <div className="p-2 text-xs text-gray-500 dark:text-zinc-400 border-t border-gray-100 dark:border-zinc-700/60">
                                                    当前模型: <span className="font-semibold text-gray-700 dark:text-zinc-200">{localModel}</span>
                                                </div>
                                                <ul className="max-h-48 overflow-y-auto text-sm custom-scrollbar">
                                                    {isModelListLoading ? (
                                                        <li className="px-3 py-2 text-gray-500 dark:text-zinc-400">加载中...</li>
                                                    ) : filteredModels.length > 0 ? (
                                                        filteredModels.map(modelName => (
                                                            <li
                                                                key={modelName}
                                                                onClick={() => {
                                                                    setLocalModel(modelName);
                                                                    setIsModelSelectOpen(false);
                                                                    setModelSearch('');
                                                                }}
                                                                className={`px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-zinc-700 ${localModel === modelName ? 'font-semibold text-blue-600 dark:text-blue-400' : ''}`}
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
                                    <textarea
                                        ref={chatInputRef}
                                        value={chatInput}
                                        onChange={handleChatInputChange}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                handleChatSubmit(e);
                                            }
                                        }}
                                        disabled={isLoading}
                                        placeholder="输入您的想法..."
                                        className="w-full pl-12 pr-16 py-4 text-lg rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 custom-scrollbar resize-none bg-white dark:bg-zinc-700 dark:border-zinc-600 dark:text-white dark:placeholder:text-zinc-400 min-h-[64px]"
                                    />
                                    <button
                                        type={isLoading ? "button" : "submit"}
                                        onClick={isLoading ? handleInterrupt : undefined}
                                        disabled={!isLoading && !chatInput.trim()}
                                        className="absolute bottom-2.5 right-3 p-2 rounded-full transition-colors text-white bg-gray-800 hover:bg-gray-900 disabled:bg-gray-300 dark:bg-slate-100 dark:text-gray-800 dark:hover:bg-slate-200 dark:disabled:bg-zinc-600 dark:disabled:text-zinc-400"
                                        aria-label={isLoading ? "中断" : "发送"}
                                    >
                                        {isLoading ? <StopIcon className="w-5 h-5" /> : <ArrowUpIcon className="w-5 h-5" />}
                                    </button>
                                </form>
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 dark:text-zinc-400 p-8">
                            <AiIcon className="w-16 h-16 mb-4 text-gray-300 dark:text-zinc-600" />
                            <h2 className="text-xl font-semibold text-gray-700 dark:text-zinc-200">准备好激发创意了吗？</h2>
                            <p className="mt-2 max-w-sm">
                                {activeTab === 'roles'
                                    ? '请从左侧的工具箱中选择一个头脑风暴工具，开始与 AI 创意伙伴的对话吧。'
                                    : '请从左侧新建或选择一个话题，开始您的对话。'
                                }
                            </p>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};

export default TipsView;
