

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import EasyMDE from 'easymde';
import type { AIConfig, NovelInfo, UISettings, CombinedCards, ChatMessage } from '../types';
import { polishOutline, fetchModels, generateOutline, generateChatResponse } from '../services/aiService';
import { DownloadIcon, PreviewIcon, AiIcon, UploadIcon, StopIcon, DocumentPlusIcon, PhotoIcon, TrashIcon, PlusIcon, ArrowUpIcon } from './icons';
import Spinner from './Spinner';

interface ResultViewProps {
    outline: string;
    setOutline: (outline: string) => void;
    config: AIConfig;
    setConfig: React.Dispatch<React.SetStateAction<AIConfig>>;
    novelInfo: NovelInfo;
    setNovelInfo: React.Dispatch<React.SetStateAction<NovelInfo>>;
    uiSettings: UISettings;
    isGenerating: boolean;
    setIsGenerating: React.Dispatch<React.SetStateAction<boolean>>;
    combinedCards: CombinedCards;
    onSaveToArchive: () => void;
}

const ResultView: React.FC<ResultViewProps> = ({ outline, setOutline, config, setConfig, novelInfo, setNovelInfo, uiSettings, isGenerating, setIsGenerating, combinedCards, onSaveToArchive }) => {
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const easyMdeInstance = useRef<EasyMDE | null>(null);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle');
    const chatContainerRef = useRef<HTMLDivElement | null>(null);
    const importFileInputRef = useRef<HTMLInputElement | null>(null);
    const [isEditingName, setIsEditingName] = useState(false);
    const nameInputRef = useRef<HTMLInputElement>(null);
    const chatInputRef = useRef<HTMLTextAreaElement | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);
    const imageUploadInputRef = useRef<HTMLInputElement | null>(null);
    const textUploadInputRef = useRef<HTMLInputElement | null>(null);
    const [isUploadMenuOpen, setIsUploadMenuOpen] = useState(false);
    const uploadMenuRef = useRef<HTMLDivElement>(null);

    // Chat states
    const [chatMode, setChatMode] = useState<'assistant' | 'chat'>('assistant');
    const [assistantHistory, setAssistantHistory] = useState<ChatMessage[]>([]);
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
    const [chatInput, setChatInput] = useState('');
    const [isChatLoading, setIsChatLoading] = useState(false);
    const [attachment, setAttachment] = useState<{ type: 'image' | 'text'; data: string; name: string } | null>(null);

    // Get current chat history and setter based on mode
    const currentChatHistory = useMemo(() => chatMode === 'assistant' ? assistantHistory : chatHistory, [chatMode, assistantHistory, chatHistory]);
    const setCurrentChatHistory = useMemo(() => chatMode === 'assistant' ? setAssistantHistory : setChatHistory, [chatMode]);
    
    // Model Dropdown states
    const [isModelSelectOpen, setIsModelSelectOpen] = useState(false);
    const [modelList, setModelList] = useState<string[]>([]);
    const [isModelListLoading, setIsModelListLoading] = useState(false);
    const [modelSearch, setModelSearch] = useState('');
    const modelSelectRef = useRef<HTMLDivElement>(null);


    useEffect(() => {
        if (isEditingName && nameInputRef.current) {
            nameInputRef.current.focus();
            nameInputRef.current.select();
        }
    }, [isEditingName]);

    useEffect(() => {
        let mde: EasyMDE | null = null;
        if (textareaRef.current) {
            mde = new EasyMDE({
                element: textareaRef.current,
                initialValue: outline,
                spellChecker: false,
                placeholder: "您生成的故事大纲将显示在这里，您可以自由编辑...",
                toolbar: false, // Remove the default toolbar
                minHeight: '100px',
            });
            easyMdeInstance.current = mde;

            mde.codemirror.on('change', () => {
                // This might be null if component unmounts quickly
                if (easyMdeInstance.current) {
                    setOutline(easyMdeInstance.current.value());
                    if (saveStatus === 'saved') {
                        setSaveStatus('idle');
                    }
                }
            });
        }

        // Cleanup on unmount
        return () => {
            easyMdeInstance.current?.toTextArea();
            easyMdeInstance.current = null;
            mde = null;
        };
    }, []); // Run only once on mount

    // Effect to handle external updates to the outline prop (e.g., new generation or import)
    useEffect(() => {
        const mde = easyMdeInstance.current;
        if (mde && mde.value() !== outline) {
            mde.value(outline);
        }
    }, [outline]);

    // Effect to apply UI settings to the editor
    useEffect(() => {
        const mde = easyMdeInstance.current;
        const codemirrorEl = mde?.codemirror.getWrapperElement();
        if (codemirrorEl) {
            codemirrorEl.style.fontSize = `${uiSettings.editorFontSize}px`;
            codemirrorEl.style.fontFamily = uiSettings.editorFontFamily;
        }
    }, [uiSettings]);
    
    // Auto-scroll chat history
    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [currentChatHistory]);

    // Effect to fetch models for the assistant
    useEffect(() => {
        const loadModels = async () => {
            if (!config.provider) return;
            if (config.provider === 'gemini') {
                setModelList(['gemini-2.5-flash']);
                if (config.assistantModel !== 'gemini-2.5-flash') {
                     setConfig(prev => ({ ...prev, assistantModel: 'gemini-2.5-flash' }));
                }
                return;
            }

            setIsModelListLoading(true);
            try {
                const models = await fetchModels(config);
                setModelList(models);
            } catch (error) {
                console.error("Failed to fetch models for assistant:", error);
                setModelList([]);
            } finally {
                setIsModelListLoading(false);
            }
        };

        loadModels();
    }, [config.provider, config.apiKey, config.endpoint, setConfig]);

    // Effect to handle clicking outside dropdowns
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (modelSelectRef.current && !modelSelectRef.current.contains(event.target as Node)) {
                setIsModelSelectOpen(false);
            }
            if (uploadMenuRef.current && !uploadMenuRef.current.contains(event.target as Node)) {
                setIsUploadMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);
    
    // Effect to handle initial streaming generation
    useEffect(() => {
        if (!isGenerating) return;

        let active = true;
        const generate = async () => {
            try {
                let accumulatedOutline = "";
                // Initial empty set to clear previous content
                setOutline("");
                const stream = generateOutline(combinedCards, config, novelInfo);
                for await (const chunk of stream) {
                    if (!active) break;
                    accumulatedOutline += chunk;
                    setOutline(accumulatedOutline); // This updates editor via other effect
                }
            } catch (err) {
                alert(err instanceof Error ? err.message : '发生未知错误。');
            } finally {
                if (active) {
                    setIsGenerating(false);
                }
            }
        };

        generate();

        return () => {
            active = false;
        };
    }, [isGenerating, combinedCards, config, novelInfo, setOutline, setIsGenerating]);


    const handleSave = () => {
        onSaveToArchive();
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
    };

    const handleTogglePreview = () => {
        if (easyMdeInstance.current) {
            EasyMDE.togglePreview(easyMdeInstance.current);
        }
    };

    const handleExport = () => {
        try {
            const currentContent = easyMdeInstance.current?.value() || outline;
            const blob = new Blob([currentContent], { type: 'text/markdown;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            const downloadName = novelInfo.name ? `${novelInfo.name}.md` : 'story-outline.md';
            link.href = url;
            link.download = downloadName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Failed to export file:", error);
            alert("导出文件失败！");
        }
    };

     const handleImportClick = () => {
        importFileInputRef.current?.click();
    };

    const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // BUG FIX: Automatically set novel name from filename if it's empty
        if (!novelInfo.name.trim()) {
            const fileNameWithoutExtension = file.name.replace(/\.(md|txt)$/i, '');
            setNovelInfo(prev => ({ ...prev, name: fileNameWithoutExtension }));
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target?.result as string;
            setOutline(content);
        };
        reader.onerror = () => {
            alert('读取文件失败。');
        };
        reader.readAsText(file);
        
        e.target.value = ''; // Reset file input to allow importing the same file again
    };
    
    const handleInterrupt = () => {
        abortControllerRef.current?.abort();
    };

    const handleChatSubmit = useCallback(async (e: React.SyntheticEvent) => {
        e.preventDefault();
        const message = chatInput.trim();
        if (!message && !attachment || isChatLoading) return;

        setChatInput('');
        setAttachment(null);
        if (chatInputRef.current) {
            chatInputRef.current.style.height = 'auto'; // Reset height
        }

        const controller = new AbortController();
        abortControllerRef.current = controller;

        let userMessageContent = message;
        let userMessageImage: string | undefined = undefined;
    
        if (attachment) {
            if (attachment.type === 'image') {
                userMessageImage = attachment.data;
            } else if (attachment.type === 'text') {
                const fileContext = `--- Attached File: ${attachment.name} ---\n${attachment.data}`;
                userMessageContent = message ? `${message}\n\n${fileContext}` : fileContext;
            }
        }
        
        const newUserMessage: ChatMessage = { 
            role: 'user', 
            content: userMessageContent.trim(),
            image: userMessageImage,
        };

        const newHistory = [...currentChatHistory, newUserMessage];
        setCurrentChatHistory(newHistory);
        setIsChatLoading(true);

        try {
            const assistantConfig = { ...config, model: config.assistantModel || config.model };

            if (chatMode === 'assistant') {
                const currentOutline = easyMdeInstance.current?.value() || outline;
                let finalOutline = "";
                const stream = polishOutline(currentOutline, message, assistantConfig, controller.signal);
                for await (const chunk of stream) {
                    finalOutline += chunk;
                    if (easyMdeInstance.current) {
                        easyMdeInstance.current.value(finalOutline);
                    }
                }
                setOutline(finalOutline);
                if (!controller.signal.aborted) {
                    setCurrentChatHistory(prev => [...prev, { role: 'model', content: '好的，我已经根据你的要求更新了大纲。' }]);
                }
            } else { // chatMode === 'chat'
                let accumulatedResponse = "";
                // Add a placeholder for the model's response
                setCurrentChatHistory(prev => [...prev, { role: 'model', content: '' }]);

                const stream = generateChatResponse(newHistory, assistantConfig, controller.signal);

                for await (const chunk of stream) {
                    accumulatedResponse += chunk;
                    // Update the last message (the placeholder) in real time
                    setCurrentChatHistory(prev => {
                        const nextHistory = [...prev];
                        nextHistory[nextHistory.length - 1].content = accumulatedResponse;
                        return nextHistory;
                    });
                }
            }
        } catch (err) {
            if (err instanceof DOMException && err.name === 'AbortError') {
                console.log("Stream interrupted by user.");
                 if (chatMode === 'assistant') {
                     setCurrentChatHistory(prev => [...prev, { role: 'system', content: '操作已由用户中断。' }]);
                } else { // chat mode
                     setCurrentChatHistory(prev => {
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
                }
            } else {
                const errorMessage = err instanceof Error ? err.message : '发生未知错误。';
                alert(errorMessage);
                setCurrentChatHistory(prev => [...prev, { role: 'system', content: `抱歉，操作失败: ${errorMessage}` }]);
            }
        } finally {
            setIsChatLoading(false);
            abortControllerRef.current = null;
        }
    }, [chatInput, isChatLoading, outline, config, setOutline, chatMode, currentChatHistory, setCurrentChatHistory, attachment]);

    const handleChatInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setChatInput(e.target.value);
        const textarea = e.target;
        textarea.style.height = 'auto'; // Reset height to recalculate
        const maxHeight = 200; // Max height in pixels
        textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
    };
    
    const handleImageFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Simple validation for image types
        if (!file.type.startsWith('image/')) {
            alert('请选择一个图片文件 (例如: JPG, PNG, GIF)。');
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const base64String = (event.target?.result as string).split(',')[1];
            setAttachment({ type: 'image', data: base64String, name: file.name });
        };
        reader.readAsDataURL(file);
        e.target.value = ''; // Reset input
    };

    const handleTextFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const textContent = event.target?.result as string;
            setAttachment({ type: 'text', data: textContent, name: file.name });
        };
        reader.readAsText(file);
        e.target.value = ''; // Reset input
    };
    
    const filteredModels = useMemo(() => {
        if (!modelSearch) return modelList;
        return modelList.filter(m => m.toLowerCase().includes(modelSearch.toLowerCase()));
    }, [modelList, modelSearch]);


    return (
        <div className="w-full h-full flex flex-row gap-6">
            {/* Left Panel: Outline Info */}
            <aside className="w-56 flex-shrink-0 h-full flex flex-col bg-white rounded-xl border border-gray-200 shadow-sm dark:bg-zinc-800 dark:border-zinc-700">
                 <header className="p-4 border-b border-gray-200 dark:border-zinc-600">
                    <h2 className="font-semibold text-gray-800 dark:text-zinc-100">大纲信息</h2>
                </header>
                <div className="p-4">
                    <label className="block text-sm font-medium text-gray-600 dark:text-zinc-300 mb-1">大纲名称</label>
                    {isEditingName ? (
                        <input
                            ref={nameInputRef}
                            type="text"
                            value={novelInfo.name}
                            onChange={(e) => setNovelInfo({ ...novelInfo, name: e.target.value })}
                            onBlur={() => setIsEditingName(false)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    setIsEditingName(false);
                                }
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-500 focus:border-gray-500 dark:bg-zinc-700 dark:border-zinc-600 dark:text-white"
                            placeholder="为你的大纲命名"
                        />
                    ) : (
                        <div
                            onDoubleClick={() => setIsEditingName(true)}
                            className="w-full px-3 py-2 border border-transparent rounded-md cursor-pointer hover:bg-gray-100 dark:hover:bg-zinc-700"
                            title="双击以编辑"
                        >
                            <p className="text-gray-800 dark:text-zinc-100 truncate">{novelInfo.name || '未命名大纲'}</p>
                        </div>
                    )}
                </div>
            </aside>

            {/* Middle Panel: Editor */}
            <div className="flex-grow h-full flex flex-col min-w-0">
                <header className="flex-shrink-0 flex justify-end items-center mb-4 space-x-2">
                    <input type="file" ref={importFileInputRef} onChange={handleFileImport} accept=".md,.txt" style={{ display: 'none' }} />
                    <button
                        onClick={handleTogglePreview}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 transition-colors dark:bg-zinc-700 dark:text-zinc-200 dark:border-zinc-600 dark:hover:bg-zinc-600"
                        title="切换预览 (Ctrl-P)"
                    >
                        <PreviewIcon className="w-4 h-4" />
                        <span>预览</span>
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saveStatus !== 'idle'}
                        className={`px-4 py-2 text-sm font-semibold rounded-md transition-all w-24 ${
                            saveStatus === 'saved'
                                ? 'bg-green-600 text-white cursor-default'
                                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 disabled:opacity-50 dark:bg-zinc-700 dark:text-zinc-200 dark:border-zinc-600 dark:hover:bg-zinc-600'
                        }`}
                    >
                        {saveStatus === 'saved' ? '✓ 已保存' : '保存'}
                    </button>
                    <button
                        onClick={handleImportClick}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 transition-colors dark:bg-zinc-700 dark:text-zinc-200 dark:border-zinc-600 dark:hover:bg-zinc-600"
                        title="从本地导入 Markdown 文件"
                    >
                        <UploadIcon className="w-4 h-4" />
                        <span>导入</span>
                    </button>
                    <button
                        onClick={handleExport}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-gray-800 rounded-md shadow-sm hover:bg-gray-900 transition-colors dark:bg-slate-100 dark:text-gray-800 dark:hover:bg-slate-200"
                        title="导出为 Markdown"
                    >
                        <DownloadIcon className="w-4 h-4" />
                        <span>导出</span>
                    </button>
                </header>
                
                <div className="flex-grow relative editor-container">
                    <textarea ref={textareaRef} style={{ display: 'none' }} />
                </div>
            </div>

             {/* Right Panel: Chat Assistant */}
            <aside className="w-96 flex-shrink-0 h-full flex flex-col bg-white rounded-xl border border-gray-200 shadow-sm dark:bg-zinc-800 dark:border-zinc-700">
                <div ref={chatContainerRef} className="flex-grow p-4 space-y-4 overflow-y-auto custom-scrollbar">
                   {currentChatHistory.map((msg, index) => {
                        if (msg.role === 'system') {
                            return (
                                <div key={index} className="text-center w-full my-2">
                                    <p className="text-xs text-gray-500 bg-slate-100 rounded-full px-3 py-1 inline-block dark:bg-zinc-700 dark:text-zinc-400">{msg.content}</p>
                                </div>
                            );
                        }
                        
                        const isUser = msg.role === 'user';
                        const isLastMessageStreaming = isChatLoading && index === currentChatHistory.length - 1 && !isUser;

                        return (
                            <div key={index} className={`flex items-end gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}>
                                {!isUser && (
                                    <div className="w-8 h-8 flex-shrink-0 rounded-full bg-gradient-to-br from-purple-400 to-yellow-300 flex items-center justify-center shadow-sm">
                                        <AiIcon className="w-5 h-5 text-white" />
                                    </div>
                                )}
                                <div className={`max-w-[85%] px-4 py-3 rounded-2xl ${
                                    isUser 
                                        ? 'bg-blue-600 text-white rounded-br-md' 
                                        : 'bg-gray-100 text-gray-800 rounded-bl-md dark:bg-zinc-700 dark:text-zinc-200'
                                }`}>
                                    {msg.image && (
                                        <img 
                                            src={`data:image/jpeg;base64,${msg.image}`} 
                                            alt="Uploaded content" 
                                            className="rounded-lg mb-2 max-w-full h-auto"
                                        />
                                    )}
                                    <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">
                                        {msg.content}
                                        {isLastMessageStreaming && <span className="inline-block w-2 h-4 bg-gray-600 dark:bg-zinc-400 animate-pulse ml-1" />}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                     {isChatLoading && chatMode === 'assistant' && (
                        <div className="flex justify-start">
                             <div className="max-w-[85%] px-4 py-2 rounded-xl bg-gray-100 text-gray-800 flex items-center gap-2 dark:bg-zinc-700 dark:text-zinc-200">
                                <Spinner />
                                <span className="text-sm">正在思考...</span>
                             </div>
                        </div>
                    )}
                </div>
                <div className="flex-shrink-0 p-4 border-t border-gray-200 dark:border-zinc-600">
                    <div className="flex items-center gap-1 rounded-lg bg-gray-100 dark:bg-zinc-700/60 p-1 mb-3">
                         <button
                            onClick={() => setChatMode('assistant')}
                            className={`w-full py-1 rounded-md text-sm font-medium transition-all duration-200 ${
                                chatMode === 'assistant' 
                                ? 'bg-white text-gray-800 shadow-sm dark:bg-zinc-600 dark:text-zinc-100' 
                                : 'text-gray-600 hover:bg-white/50 dark:text-zinc-400 dark:hover:bg-zinc-900/20'
                            }`}
                        >
                            AI 修改
                        </button>
                        <button
                            onClick={() => setChatMode('chat')}
                            className={`w-full py-1 rounded-md text-sm font-medium transition-all duration-200 ${
                                chatMode === 'chat' 
                                ? 'bg-white text-gray-800 shadow-sm dark:bg-zinc-600 dark:text-zinc-100' 
                                : 'text-gray-600 hover:bg-white/50 dark:text-zinc-400 dark:hover:bg-zinc-900/20'
                            }`}
                        >
                            AI 聊天
                        </button>
                    </div>

                    <form onSubmit={handleChatSubmit} className="group relative flex flex-col w-full rounded-xl shadow-md border-2 border-transparent bg-clip-padding focus-within:border-purple-400 transition-all duration-300"
                        style={{
                            backgroundImage: `linear-gradient(var(--ai-input-bg, #fff), var(--ai-input-bg, #fff)), linear-gradient(120deg, #a855f7, #fde047)`,
                            backgroundOrigin: 'border-box'
                        }}
                    >
                        {attachment && (
                            <div className="p-2 mx-2 mt-2 border-b border-gray-200 dark:border-zinc-700">
                                {attachment.type === 'image' && (
                                    <div className="relative inline-block bg-gray-100 dark:bg-zinc-700 p-1.5 rounded-lg">
                                        <img src={`data:image/jpeg;base64,${attachment.data}`} alt="Preview" className="h-20 w-auto rounded" />
                                        <button
                                            type="button"
                                            onClick={() => setAttachment(null)}
                                            className="absolute -top-2 -right-2 w-5 h-5 bg-gray-700 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-500 transition-colors z-10"
                                            aria-label="Remove image"
                                        >
                                            &times;
                                        </button>
                                    </div>
                                )}
                                {attachment.type === 'text' && (
                                    <div className="flex items-center justify-between bg-gray-100 dark:bg-zinc-700/50 p-2 rounded-lg">
                                        <div className="flex items-center gap-2 overflow-hidden">
                                            <DocumentPlusIcon className="w-5 h-5 text-gray-500 dark:text-zinc-400 flex-shrink-0" />
                                            <span className="text-sm text-gray-700 dark:text-zinc-200 truncate" title={attachment.name}>{attachment.name}</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setAttachment(null)}
                                            className="p-1 rounded-full text-gray-500 hover:text-red-600 hover:bg-gray-200 dark:text-zinc-400 dark:hover:text-red-500 dark:hover:bg-zinc-600 flex-shrink-0"
                                            aria-label="Remove text file"
                                        >
                                            <TrashIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                        <div className="relative flex-grow">
                            <div className="absolute bottom-3 left-3 flex items-center gap-1 z-10">
                                <div ref={modelSelectRef} className="relative">
                                    <button
                                        type="button"
                                        onClick={() => setIsModelSelectOpen(prev => !prev)}
                                        className="p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:text-zinc-500 dark:hover:text-zinc-300 dark:hover:bg-zinc-700 transition-colors"
                                        aria-label="选择AI模型"
                                        title="选择AI模型"
                                    >
                                        <AiIcon className="w-5 h-5" />
                                    </button>
                                    {isModelSelectOpen && (
                                        <div className="absolute bottom-full mb-2 w-56 bg-white dark:bg-zinc-700 rounded-lg shadow-lg border border-gray-200 dark:border-zinc-600 z-10">
                                            <div className="p-2">
                                                <input
                                                    type="text"
                                                    value={modelSearch}
                                                    onChange={e => setModelSearch(e.target.value)}
                                                    placeholder="搜索模型..."
                                                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-500 focus:border-gray-500 dark:bg-zinc-600 dark:border-zinc-500 dark:text-white"
                                                />
                                            </div>
                                            <div className="p-2 text-xs text-gray-500 dark:text-zinc-400 border-t border-gray-100 dark:border-zinc-600">模型 ({config.assistantModel || config.model})</div>
                                            <ul className="max-h-48 overflow-y-auto text-sm custom-scrollbar">
                                                {isModelListLoading ? (
                                                    <li className="px-3 py-2 text-gray-500 dark:text-zinc-400">加载中...</li>
                                                ) : filteredModels.length > 0 ? (
                                                    filteredModels.map(modelName => (
                                                        <li
                                                            key={modelName}
                                                            onClick={() => {
                                                                setConfig(prev => ({ ...prev, assistantModel: modelName }));
                                                                setIsModelSelectOpen(false);
                                                                setModelSearch('');
                                                            }}
                                                            className="px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-zinc-600"
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
                                disabled={isChatLoading}
                                placeholder={chatMode === 'assistant' ? "有什么可以帮您修改大纲？" : "随便问点什么..."}
                                className="w-full pl-12 pr-24 py-3 text-base rounded-b-xl focus:outline-none custom-scrollbar resize-none bg-transparent placeholder:text-gray-400 transition-all duration-300 dark:text-white dark:placeholder:text-zinc-500 min-h-[56px]"
                            />
                            <div className="absolute bottom-3 right-3 flex items-center gap-1 z-10">
                                <div ref={uploadMenuRef} className="relative">
                                    <button
                                        type="button"
                                        onClick={() => setIsUploadMenuOpen(prev => !prev)}
                                        className="p-2 rounded-full transition-colors text-gray-500 hover:text-gray-800 hover:bg-gray-100 disabled:text-gray-300 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-700"
                                        aria-label="上传文件"
                                        title="上传文件"
                                        aria-haspopup="true"
                                        aria-expanded={isUploadMenuOpen}
                                        disabled={isChatLoading || !!attachment}
                                    >
                                        <PlusIcon className="w-5 h-5" />
                                    </button>
                                    {isUploadMenuOpen && (
                                        <div className="absolute bottom-full right-0 mb-2 w-48 bg-white dark:bg-zinc-800 rounded-xl shadow-lg border border-gray-200 dark:border-zinc-700 z-20 overflow-hidden">
                                            <ul className="text-sm text-gray-700 dark:text-zinc-200">
                                                <li>
                                                    <button
                                                        type="button"
                                                        onClick={() => { imageUploadInputRef.current?.click(); setIsUploadMenuOpen(false); }}
                                                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors text-left"
                                                    >
                                                        <PhotoIcon className="w-5 h-5 text-gray-500 dark:text-zinc-400" />
                                                        <span>上传图片</span>
                                                    </button>
                                                </li>
                                                <li>
                                                    <button
                                                        type="button"
                                                        onClick={() => { textUploadInputRef.current?.click(); setIsUploadMenuOpen(false); }}
                                                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors text-left"
                                                    >
                                                        <DocumentPlusIcon className="w-5 h-5 text-gray-500 dark:text-zinc-400" />
                                                        <span>上传文本</span>
                                                    </button>
                                                </li>
                                            </ul>
                                        </div>
                                    )}
                                </div>
                                <button
                                    type={isChatLoading ? "button" : "submit"}
                                    onClick={isChatLoading ? handleInterrupt : undefined}
                                    disabled={!isChatLoading && !chatInput.trim() && !attachment}
                                    className={`p-2 rounded-full transition-colors ${
                                        isChatLoading
                                            ? 'text-gray-600 bg-gray-100 hover:bg-red-100 hover:text-red-600 dark:text-zinc-300 dark:bg-zinc-700 dark:hover:bg-red-900/50 dark:hover:text-red-500'
                                            : 'text-white bg-gray-800 hover:bg-gray-900 disabled:bg-transparent disabled:text-gray-400 dark:bg-slate-100 dark:text-gray-800 dark:hover:bg-slate-200 dark:disabled:text-zinc-600 dark:disabled:cursor-not-allowed'
                                    }`}
                                    aria-label={isChatLoading ? "中断" : "发送"}
                                >
                                    {isChatLoading ? <StopIcon className="w-5 h-5" /> : <ArrowUpIcon className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>
                    </form>
                    <input type="file" ref={textUploadInputRef} onChange={handleTextFileSelected} accept=".txt,.md" className="hidden" />
                    <input type="file" ref={imageUploadInputRef} onChange={handleImageFileSelected} accept="image/*" className="hidden" />
                </div>
            </aside>
        </div>
    );
};

export default ResultView;