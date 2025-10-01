

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import type { AIConfig, ChatMessage, StoryArchiveItem, Topic } from '../types';
import { AiIcon, ArrowUpIcon, StopIcon, ClipboardDocumentIcon, PencilIcon, ArrowPathIcon, PlusIcon, TrashIcon, UserCircleIcon } from './icons';
import Spinner from './Spinner';
import { generateChatResponse, fetchModels } from '../services/aiService';
import { BRAINSTORM_TOOLS } from '../constants';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

interface TipsViewProps {
    topics: Topic[];
    setTopics: React.Dispatch<React.SetStateAction<Topic[]>>;
    config: AIConfig;
    storyArchive: StoryArchiveItem[];
}

const TipsView: React.FC<TipsViewProps> = ({ topics, setTopics, config, storyArchive }) => {
    const [activeTab, setActiveTab] = useState<'roles' | 'topics'>('roles');
    
    const sortedTopics = useMemo(() => [...topics].sort((a, b) => b.lastModified - a.lastModified), [topics]);
    
    const [activeTopicId, setActiveTopicId] = useState<string | null>(() => sortedTopics[0]?.id || null);
    
    // Shared chat state
    const [chatInput, setChatInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [editingMessage, setEditingMessage] = useState<{ id: string; content: string } | null>(null);
    const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
    
    // Topic renaming state
    const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
    const [tempTopicName, setTempTopicName] = useState('');

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
    const renameInputRef = useRef<HTMLInputElement | null>(null);
    
    useEffect(() => {
        if (topics.length > 0 && !topics.some(t => t.id === activeTopicId)) {
            setActiveTopicId(sortedTopics[0]?.id || null);
        } else if (topics.length === 0) {
            setActiveTopicId(null);
        }
    }, [topics, sortedTopics, activeTopicId]);

    const { currentHistory, setCurrentHistory, activeTopic } = useMemo(() => {
        const topic = topics.find(t => t.id === activeTopicId);
        const history = topic ? topic.history : [];
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
        return { currentHistory: history, setCurrentHistory: setHistory, activeTopic: topic };
    }, [activeTopicId, topics, setTopics]);

    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [currentHistory]);

    // Effect to focus rename input
    useEffect(() => {
        if (editingTopicId && renameInputRef.current) {
            renameInputRef.current.focus();
            renameInputRef.current.select();
        }
    }, [editingTopicId]);

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
        
        let historyForAI = historyToUse.map(msg => ({ ...msg })); // Prevent state mutation

        if (activeTopic?.selectedArchiveId) {
            const selectedArchive = storyArchive.find(item => item.id === activeTopic.selectedArchiveId);
            if (selectedArchive) {
                const outlineContext = `\n\n---\n[大纲上下文]\n请将以下故事大纲作为你回答的背景信息：\n\n${selectedArchive.outline}\n---`;
                
                const systemMsgIndex = historyForAI.findIndex(m => m.role === 'system');
                if (systemMsgIndex !== -1) {
                    // Append context to existing system prompt
                    historyForAI[systemMsgIndex].content += outlineContext;
                } else {
                    // Or prepend a new system message if none exists
                    historyForAI.unshift({
                        id: `sys-ctx-${Date.now()}`,
                        role: 'system',
                        content: `你是一个创意写作助手。${outlineContext}`
                    });
                }
            }
        }
        
        try {
            let accumulatedResponse = "";
            setCurrentHistory(prev => [...prev, { id: `model-streaming-${Date.now()}`, role: 'model', content: '' }]);
            
            const chatConfig = { ...config, model: localModel };
            const stream = generateChatResponse(historyForAI, chatConfig, controller.signal);

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
    }, [setCurrentHistory, config, localModel, activeTopic, storyArchive]);

    const handleChatSubmit = useCallback(async (e: React.SyntheticEvent) => {
        e.preventDefault();
        const message = chatInput.trim();
        if (!message || isLoading || !activeTopicId) return;

        setChatInput('');
        if (chatInputRef.current) chatInputRef.current.style.height = 'auto';
        
        const newUserMessage: ChatMessage = { id: `user-${Date.now()}`, role: 'user', content: message };
        const newHistory = [...currentHistory, newUserMessage];
        setCurrentHistory(newHistory);
        await triggerChatGeneration(newHistory);
    }, [chatInput, isLoading, currentHistory, setCurrentHistory, triggerChatGeneration, activeTopicId]);
    
    const handleSelectRole = (toolId: string) => {
        // Find the base topic for this role (one without a number suffix)
        let topicForRole = topics.find(t => t.toolId === toolId && !/\s\(\d+\)$/.test(t.name));
        
        if (!topicForRole) {
            const tool = BRAINSTORM_TOOLS.find(t => t.id === toolId);
            if (!tool) return;

            const newTopic: Topic = {
                id: `topic-role-${tool.id}-${Date.now()}`,
                name: tool.name,
                toolId: tool.id,
                lastModified: Date.now(),
                history: [
                    { id: `sys-${tool.id}-${Date.now()}`, role: 'system', content: tool.systemPrompt },
                    { id: `model-${tool.id}-${Date.now()}`, role: 'model', content: tool.initialMessage },
                ],
            };
            setTopics(prev => [newTopic, ...prev]);
            topicForRole = newTopic;
        }
        
        setActiveTopicId(topicForRole.id);
        setActiveTab('topics'); // Always switch to topics tab to see the list
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
        // Can't regenerate user message or first message
        if (messageIndex <= 0 || currentHistory[messageIndex].role === 'user') return;
        
        const historyToResend = currentHistory.slice(0, messageIndex);
        
        setCurrentHistory(historyToResend);

        await triggerChatGeneration(historyToResend);
    }, [currentHistory, setCurrentHistory, triggerChatGeneration]);

    const handleDeleteMessage = useCallback((messageIdToDelete: string) => {
        if (window.confirm("您确定要删除此条消息吗？")) {
            setCurrentHistory(prev => prev.filter(msg => msg.id !== messageIdToDelete));
        }
    }, [setCurrentHistory]);
    
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
        const activeToolId = activeTopic?.toolId;

        if (activeToolId) {
            // Create a new topic based on the current active role/tool
            const tool = BRAINSTORM_TOOLS.find(t => t.id === activeToolId);
            if (!tool) return;

            const baseName = tool.name;
            const relatedTopics = topics.filter(t => t.toolId === activeToolId);
            let maxIndex = 0;
            relatedTopics.forEach(topic => {
                if (topic.name.startsWith(baseName)) {
                    const match = topic.name.match(/\((\d+)\)$/);
                    if (match) {
                        const index = parseInt(match[1], 10);
                        if (index > maxIndex) maxIndex = index;
                    }
                }
            });
            const newName = `${baseName} (${maxIndex + 1})`;

            const newTopic: Topic = {
                id: `topic-role-${tool.id}-${Date.now()}`,
                name: newName,
                toolId: tool.id,
                lastModified: Date.now(),
                history: [
                    { id: `sys-new-${tool.id}-${Date.now()}`, role: 'system', content: tool.systemPrompt },
                    { id: `model-new-${tool.id}-${Date.now()}`, role: 'model', content: tool.initialMessage },
                ],
            };
            setTopics(prev => [newTopic, ...prev]);
            setActiveTopicId(newTopic.id);
        } else {
            // Generic new topic with incremental naming
            const baseName = '新话题';
            const genericTopics = topics.filter(t => !t.toolId && (t.name === baseName || t.name.startsWith(baseName + ' (')));
            let maxIndex = 0;
            const baseNameExists = genericTopics.some(t => t.name === baseName);

            genericTopics.forEach(topic => {
                const match = topic.name.match(/\((\d+)\)$/);
                if (match) {
                    const index = parseInt(match[1], 10);
                    if (index > maxIndex) maxIndex = index;
                }
            });

            const newName = !baseNameExists ? baseName : `${baseName} (${maxIndex + 1})`;

            const newTopic: Topic = {
                id: `topic-new-${Date.now()}`,
                name: newName,
                lastModified: Date.now(),
                history: [{ id: `sys-new-${Date.now()}`, role: 'system', content: '这是一个新的对话话题。' }],
            };
            setTopics(prev => [newTopic, ...prev]);
            setActiveTopicId(newTopic.id);
        }
    };


    const handleDeleteTopic = (e: React.MouseEvent, topicId: string) => {
        e.stopPropagation();
        if (window.confirm("您确定要删除这个话题吗？此操作无法撤销。")) {
            const remainingTopics = topics.filter(t => t.id !== topicId);
            if (activeTopicId === topicId) {
                const sortedRemaining = [...remainingTopics].sort((a, b) => b.lastModified - a.lastModified);
                setActiveTopicId(sortedRemaining[0]?.id || null);
            }
            setTopics(remainingTopics);
        }
    };
    
    const handleStartRename = (topic: Topic) => {
        setEditingTopicId(topic.id);
        setTempTopicName(topic.name);
    };

    const handleFinishRename = () => {
        if (!editingTopicId || !tempTopicName.trim()) {
            setEditingTopicId(null);
            return; // Don't save if empty name
        }
        setTopics(prevTopics =>
            prevTopics.map(t =>
                t.id === editingTopicId ? { ...t, name: tempTopicName.trim(), lastModified: Date.now() } : t
            )
        );
        setEditingTopicId(null);
    };

    const handleOutlineSelect = (archiveId: string) => {
        if (!activeTopicId) return;
        setTopics(prevTopics =>
            prevTopics.map(t =>
                t.id === activeTopicId
                    ? { ...t, selectedArchiveId: archiveId || null }
                    : t
            )
        );
    };

    const spinnerSVG = `<svg class="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`;
    const typingIndicator = `<span class="inline-block w-2 h-4 bg-gray-600 dark:bg-zinc-400 animate-pulse ml-1"></span>`;

    return (
        <div className="w-full h-full flex flex-col">
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
                        <div className="flex-grow overflow-y-auto custom-scrollbar">
                             <div className="space-y-1 p-3 pt-0">
                                {BRAINSTORM_TOOLS.map(tool => (
                                    <button
                                        key={tool.id}
                                        onClick={() => handleSelectRole(tool.id)}
                                        className="w-full text-left p-3 rounded-lg border-2 border-transparent hover:bg-slate-100/70 dark:hover:bg-zinc-700/50 transition-colors duration-200"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="p-1 rounded-lg text-gray-500 dark:text-zinc-400">
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
                            <div className="flex-grow overflow-y-auto custom-scrollbar">
                                 <div className="space-y-1 p-2 pt-0">
                                    {sortedTopics.map(topic => (
                                        <button
                                            key={topic.id}
                                            onClick={() => !editingTopicId && setActiveTopicId(topic.id)}
                                            className={`w-full text-left p-3 rounded-lg relative group ${
                                                activeTopicId === topic.id ? 'bg-blue-50 dark:bg-blue-900/30' : 'hover:bg-gray-100 dark:hover:bg-zinc-700/50'
                                            }`}
                                        >
                                            <div className="min-h-[36px]">
                                                {editingTopicId === topic.id ? (
                                                    <input
                                                        ref={renameInputRef}
                                                        type="text"
                                                        value={tempTopicName}
                                                        onChange={(e) => setTempTopicName(e.target.value)}
                                                        onBlur={handleFinishRename}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') { e.preventDefault(); handleFinishRename(); }
                                                            if (e.key === 'Escape') { e.preventDefault(); setEditingTopicId(null); }
                                                        }}
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="w-full text-sm font-medium bg-white dark:bg-zinc-600 border border-blue-500 rounded px-2 py-0.5 focus:outline-none ring-1 ring-blue-500"
                                                    />
                                                ) : (
                                                    <h3
                                                        onDoubleClick={(e) => { e.stopPropagation(); handleStartRename(topic); }}
                                                        className="font-medium text-sm text-gray-800 dark:text-zinc-100 truncate pr-6"
                                                        title="双击重命名"
                                                    >
                                                        {topic.name}
                                                    </h3>
                                                )}
                                                <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1">{new Date(topic.lastModified).toLocaleString()}</p>
                                            </div>
                                            <button
                                                onClick={(e) => handleDeleteTopic(e, topic.id)}
                                                className="absolute top-1/2 -translate-y-1/2 right-2 p-1.5 rounded-full text-gray-400 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/50 dark:hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                                title="删除话题"
                                            >
                                                <TrashIcon className="w-4 h-4" />
                                            </button>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}
                </aside>

                {/* Right Panel: Chat Interface */}
                <main className="flex-1 flex flex-col bg-white rounded-xl border border-gray-200 shadow-sm dark:bg-zinc-800 dark:border-zinc-700 min-h-0">
                    {activeTopicId ? (
                        <>
                             <header className="flex-shrink-0 p-3 border-b border-gray-200 dark:border-zinc-700 flex justify-between items-center">
                                <div className="flex items-center gap-3 px-2">
                                    {activeTopic?.toolId && BRAINSTORM_TOOLS.find(t => t.id === activeTopic.toolId) && (
                                         <div className="p-2 rounded-lg text-blue-600 dark:text-blue-400">
                                            {React.cloneElement(BRAINSTORM_TOOLS.find(t => t.id === activeTopic.toolId)!.icon, { className: "w-6 h-6" })}
                                        </div>
                                    )}
                                    <h2 className="text-xl font-semibold text-gray-800 dark:text-zinc-100">{activeTopic?.name || '对话'}</h2>
                                </div>
                                <div className="flex items-center gap-2">
                                    <label htmlFor="outline-selector" className="text-sm text-gray-500 dark:text-zinc-400 flex-shrink-0">大纲上下文:</label>
                                    <div className="relative">
                                        <select
                                            id="outline-selector"
                                            value={activeTopic?.selectedArchiveId || ''}
                                            onChange={(e) => handleOutlineSelect(e.target.value)}
                                            className="w-48 pl-3 pr-8 py-1 text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-500 focus:border-gray-500 appearance-none transition-all dark:bg-zinc-700 dark:border-zinc-600 dark:text-zinc-100 disabled:opacity-50"
                                            disabled={!activeTopicId || storyArchive.length === 0}
                                            title={storyArchive.length === 0 ? "故事存档中暂无大纲" : "选择一份大纲作为聊天背景"}
                                        >
                                            <option value="">不选择大纲</option>
                                            {storyArchive.map(item => (
                                                <option key={item.id} value={item.id}>{item.novelInfo.name}</option>
                                            ))}
                                        </select>
                                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700 dark:text-zinc-300">
                                            <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                                        </div>
                                    </div>
                                </div>
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
                                        <div key={msg.id} className="flex items-start gap-3">
                                            {isUser ? (
                                                <div className="w-8 h-8 flex-shrink-0 rounded-full bg-gray-200 dark:bg-zinc-600 flex items-center justify-center shadow-sm">
                                                    <UserCircleIcon className="w-6 h-6 text-gray-500 dark:text-zinc-300" />
                                                </div>
                                            ) : (
                                                <div className="w-8 h-8 flex-shrink-0 rounded-full bg-gradient-to-br from-purple-400 to-yellow-300 flex items-center justify-center shadow-sm">
                                                    <AiIcon className="w-5 h-5 text-white" />
                                                </div>
                                            )}
                                            <div className="flex flex-col max-w-[85%] group">
                                                <div className={`px-4 py-2 rounded-2xl ${
                                                    isUser 
                                                        ? 'bg-gray-200 text-gray-800 rounded-bl-md dark:bg-zinc-600 dark:text-zinc-200' 
                                                        : 'bg-gray-100 text-gray-800 rounded-bl-md dark:bg-zinc-700'
                                                }`}>
                                                    <div 
                                                        className="prose-chat dark:prose-invert max-w-none"
                                                        dangerouslySetInnerHTML={{ 
                                                            __html: isLastMessageStreaming && !msg.content 
                                                                ? spinnerSVG
                                                                : DOMPurify.sanitize(marked(msg.content || '') as string) + (isLastMessageStreaming && msg.content ? typingIndicator : '')
                                                        }} 
                                                    />
                                                </div>
                                                {!isLoading && msg.content && msg.content.trim() !== '' && (
                                                    <div className="flex justify-end items-center gap-1 mt-1.5 transition-opacity opacity-0 group-hover:opacity-100">
                                                        {isUser ? (
                                                            <>
                                                                <button onClick={() => setEditingMessage({id: msg.id, content: msg.content})} title="编辑" className="p-1.5 text-gray-400 hover:text-gray-700 dark:text-zinc-500 dark:hover:text-zinc-200 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-600"><PencilIcon className="w-4 h-4"/></button>
                                                                <button onClick={() => handleCopy(msg.content, msg.id)} title="复制" className="p-1.5 text-gray-400 hover:text-gray-700 dark:text-zinc-500 dark:hover:text-zinc-200 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-600">
                                                                    {copiedMessageId === msg.id ? <span className="text-xs px-1">已复制</span> : <ClipboardDocumentIcon className="w-4 h-4" />}
                                                                </button>
                                                                <button onClick={() => handleDeleteMessage(msg.id)} title="删除" className="p-1.5 text-gray-400 hover:text-red-600 dark:text-zinc-500 dark:hover:text-red-400 rounded-full hover:bg-red-100 dark:hover:bg-red-900/40"><TrashIcon className="w-4 h-4"/></button>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <button onClick={() => handleRegenerate(msg.id)} title="重新生成" className="p-1.5 text-gray-400 hover:text-gray-700 dark:text-zinc-500 dark:hover:text-zinc-200 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-600"><ArrowPathIcon className="w-4 h-4"/></button>
                                                                <button onClick={() => setEditingMessage({id: msg.id, content: msg.content})} title="编辑" className="p-1.5 text-gray-400 hover:text-gray-700 dark:text-zinc-500 dark:hover:text-zinc-200 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-600"><PencilIcon className="w-4 h-4"/></button>
                                                                <button onClick={() => handleCopy(msg.content, msg.id)} title="复制" className="p-1.5 text-gray-400 hover:text-gray-700 dark:text-zinc-500 dark:hover:text-zinc-200 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-600">
                                                                    {copiedMessageId === msg.id ? <span className="text-xs px-1">已复制</span> : <ClipboardDocumentIcon className="w-4 h-4" />}
                                                                </button>
                                                                <button onClick={() => handleDeleteMessage(msg.id)} title="删除" className="p-1.5 text-gray-400 hover:text-red-600 dark:text-zinc-500 dark:hover:text-red-400 rounded-full hover:bg-red-100 dark:hover:bg-red-900/40"><TrashIcon className="w-4 h-4"/></button>
                                                            </>
                                                        )}
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
                                    ? '请从左侧的角色列表中选择一个，开始您的头脑风暴之旅。'
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
