import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import EasyMDE from 'easymde';
// FIX: Use a default import for `codemirror` to correctly load its namespace and types like `Position`. This is the standard approach for modules using `export =` with `esModuleInterop`.
// FIX: Use a namespace import to correctly resolve types from the 'codemirror' module.
import * as CodeMirror from 'codemirror';
import type { AIConfig, NovelInfo, UISettings, CombinedCards, ChatMessage, Card, CardType, StoryArchiveItem, CharacterProfile } from '../types';
import { CARD_TYPE_NAMES } from '../constants';
import { polishOutline, fetchModels, generateOutline, generateChatResponse, editText } from '../services/aiService';
import { DownloadIcon, PreviewIcon, AiIcon, UploadIcon, StopIcon, DocumentPlusIcon, PhotoIcon, TrashIcon, PlusIcon, ArrowUpIcon, AtSymbolIcon, ChevronDownIcon, SparklesIcon } from './icons';
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
    allCards: Card[];
    onSaveToArchive: () => void;
    assistantHistory: ChatMessage[];
    setAssistantHistory: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
    chatHistory: ChatMessage[];
    setChatHistory: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
    chatInput: string;
    setChatInput: React.Dispatch<React.SetStateAction<string>>;
    storyArchive: StoryArchiveItem[];
}

const MAX_ATTACHMENTS = 5;

const ResultView: React.FC<ResultViewProps> = ({ 
    outline, 
    setOutline, 
    config, 
    setConfig, 
    novelInfo, 
    setNovelInfo, 
    uiSettings, 
    isGenerating, 
    setIsGenerating, 
    combinedCards,
    allCards,
    onSaveToArchive,
    assistantHistory,
    setAssistantHistory,
    chatHistory,
    setChatHistory,
    chatInput,
    setChatInput,
    storyArchive
}) => {
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const easyMdeInstance = useRef<EasyMDE | null>(null);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle');
    const chatContainerRef = useRef<HTMLDivElement | null>(null);
    const importFileInputRef = useRef<HTMLInputElement | null>(null);
    const [isEditingName, setIsEditingName] = useState(false);
    const nameInputRef = useRef<HTMLInputElement | null>(null);
    const chatInputRef = useRef<HTMLTextAreaElement | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);
    const imageUploadInputRef = useRef<HTMLInputElement | null>(null);
    const textUploadInputRef = useRef<HTMLInputElement | null>(null);
    const [isUploadMenuOpen, setIsUploadMenuOpen] = useState(false);
    const uploadMenuRef = useRef<HTMLDivElement>(null);
    const [isMentionMenuOpen, setIsMentionMenuOpen] = useState(false);
    const [mentionSearch, setMentionSearch] = useState('');
    const mentionMenuRef = useRef<HTMLDivElement | null>(null);
    const [expandedMentionCategories, setExpandedMentionCategories] = useState<string[]>([]);

    // Selection Popup State
    const [selectionPopup, setSelectionPopup] = useState<{ visible: boolean; x: number; y: number; }>({ visible: false, x: 0, y: 0 });
    const selectionPopupRef = useRef<HTMLDivElement>(null);
    const [isAiEditing, setIsAiEditing] = useState(false);
    const [aiEditInstruction, setAiEditInstruction] = useState('');
    const selectionInfoRef = useRef<{ content: string; startLine: number; from: CodeMirror.Position; to: CodeMirror.Position } | null>(null);
    const [isAiEditMentionOpen, setIsAiEditMentionOpen] = useState(false);
    const aiEditMentionMenuRef = useRef<HTMLDivElement | null>(null);
    const [aiEditMentionSearch, setAiEditMentionSearch] = useState('');
    const [expandedAiEditMentionCategories, setExpandedAiEditMentionCategories] = useState<string[]>([]);


    // Chat states
    const [chatMode, setChatMode] = useState<'assistant' | 'chat'>('assistant');
    const [chatReferences, setChatReferences] = useState<string[]>([]);
    const [isChatLoading, setIsChatLoading] = useState(false);
    const [attachments, setAttachments] = useState<Array<{ type: 'image' | 'text'; data: string; name: string }>>([]);

    // Get current chat history and setter based on mode
    const currentChatHistory = useMemo(() => chatMode === 'assistant' ? assistantHistory : chatHistory, [chatMode, assistantHistory, chatHistory]);
    const setCurrentChatHistory = useMemo(() => chatMode === 'assistant' ? setAssistantHistory : setChatHistory, [chatMode, setAssistantHistory, setChatHistory]);
    
    // Model Dropdown states
    const [isModelSelectOpen, setIsModelSelectOpen] = useState(false);
    const [modelList, setModelList] = useState<string[]>([]);
    const [isModelListLoading, setIsModelListLoading] = useState(false);
    const [modelSearch, setModelSearch] = useState('');
    const modelSelectRef = useRef<HTMLDivElement | null>(null);
    
    // Refs to hold the latest state for event handlers, preventing stale closures.
    const isAiEditingRef = useRef(isAiEditing);
    useEffect(() => { isAiEditingRef.current = isAiEditing }, [isAiEditing]);

    const processMentions = useCallback((text: string): string => {
        let processedText = text;
        const sortedCards = [...allCards].sort((a, b) => b.name.length - a.name.length);

        for (const card of sortedCards) {
            const mention = `@${card.name}`;
            const regex = new RegExp(mention, 'g');
            if (processedText.includes(mention)) {
                const replacement = `[卡片: ${card.name} (${card.description})]`;
                processedText = processedText.replace(regex, replacement);
            }
        }
        return processedText;
    }, [allCards]);

    const handleAddToChat = useCallback(() => {
        if (!selectionInfoRef.current) return;
        const { startLine } = selectionInfoRef.current;
        const referenceText = `[大纲段落 ${startLine}]`;
        setChatReferences(prev => [...prev, referenceText]);
        setSelectionPopup({ visible: false, x: 0, y: 0 });
        setIsAiEditing(false);
        chatInputRef.current?.focus();
    }, []); // Empty dependencies ensure this function is stable

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
                toolbar: false,
                minHeight: '100px',
                lineNumbers: true,
            });
            easyMdeInstance.current = mde;
            const cm = mde.codemirror;

            cm.on('change', () => {
                if (easyMdeInstance.current) {
                    setOutline(easyMdeInstance.current.value());
                    if (saveStatus === 'saved') {
                        setSaveStatus('idle');
                    }
                }
            });

            cm.on('cursorActivity', (instance) => {
                const selection = instance.getDoc().getSelection();
                if (selection && selection.length > 0) {
                     if (isAiEditingRef.current) return;
                    const from = instance.getDoc().getCursor('start');
                    const coords = instance.cursorCoords(true, 'local');
                    selectionInfoRef.current = {
                        content: selection,
                        startLine: from.line + 1,
                        from: from,
                        to: instance.getDoc().getCursor('end'),
                    };
                    setSelectionPopup({
                        visible: true,
                        x: coords.left,
                        y: coords.top - 55,
                    });
                } else {
                    // Unconditionally hide popup and reset AI edit state when selection is lost inside the editor.
                    setSelectionPopup({ visible: false, x: 0, y: 0 });
                    setIsAiEditing(false);
                    setAiEditInstruction('');
                    selectionInfoRef.current = null;
                }
            });
            
            cm.on('blur', (instance, event: FocusEvent) => {
                const popupEl = selectionPopupRef.current;
                // Hide popup if focus moves outside the editor to an element NOT within the popup itself.
                if (event.relatedTarget && popupEl?.contains(event.relatedTarget as Node)) {
                    return; // Focus moved into the popup, so don't hide it.
                }
                setSelectionPopup({ visible: false, x: 0, y: 0 });
                setIsAiEditing(false);
                setAiEditInstruction('');
            });


            const wrapper = cm.getWrapperElement();
            const handleKeyDown = (e: KeyboardEvent) => {
                if (e.ctrlKey && e.key.toLowerCase() === 'i' && selectionInfoRef.current) {
                    e.preventDefault();
                    setIsAiEditing(true);
                }
                if (e.ctrlKey && e.key.toLowerCase() === 'u' && selectionInfoRef.current) {
                    e.preventDefault();
                    handleAddToChat();
                }
            };
            wrapper.addEventListener('keydown', handleKeyDown);

            return () => {
                wrapper.removeEventListener('keydown', handleKeyDown);
                easyMdeInstance.current?.toTextArea();
                easyMdeInstance.current = null;
                mde = null;
            };
        }
    }, [handleAddToChat]); // This useEffect initializes EasyMDE.

    useEffect(() => {
        const mde = easyMdeInstance.current;
        if (mde && mde.value() !== outline) {
            const scrollInfo = mde.codemirror.getScrollInfo();
            mde.value(outline); 
            const cm = mde.codemirror;
            const lastLine = cm.lineCount() - 1;
            cm.setCursor({ line: lastLine, ch: cm.getLine(lastLine).length });
            cm.scrollTo(scrollInfo.left, scrollInfo.top);
        }
    }, [outline]);

    useEffect(() => {
        const mde = easyMdeInstance.current;
        const codemirrorEl = mde?.codemirror.getWrapperElement();
        if (codemirrorEl) {
            codemirrorEl.style.fontSize = `${uiSettings.editorFontSize}px`;
            codemirrorEl.style.fontFamily = uiSettings.editorFontFamily;
        }
    }, [uiSettings]);
    
    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [currentChatHistory]);

    useEffect(() => {
        const loadModels = async () => {
            if (!config.provider) return;

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
    }, [config.provider, config.endpoint]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (modelSelectRef.current && !modelSelectRef.current.contains(event.target as Node)) {
                setIsModelSelectOpen(false);
            }
            if (uploadMenuRef.current && !uploadMenuRef.current.contains(event.target as Node)) {
                setIsUploadMenuOpen(false);
            }
            if (mentionMenuRef.current && !mentionMenuRef.current.contains(event.target as Node)) {
                setIsMentionMenuOpen(false);
            }
             if (aiEditMentionMenuRef.current && !aiEditMentionMenuRef.current.contains(event.target as Node)) {
                setIsAiEditMentionOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);
    
    useEffect(() => {
        if (!isGenerating) return;

        let active = true;
        const generate = async () => {
            try {
                 // Find character profiles
                const selectedCharacters = novelInfo.characterProfileIds
                    ? storyArchive.filter(item => novelInfo.characterProfileIds!.includes(item.id))
                    : [];
                const characterProfiles = selectedCharacters.map(item => item.characterProfile).filter((p): p is CharacterProfile => !!p);

                let accumulatedOutline = "";
                setOutline("");
                const stream = generateOutline(combinedCards, config, novelInfo, characterProfiles.length > 0 ? characterProfiles : null);
                for await (const chunk of stream) {
                    if (!active) break;
                    accumulatedOutline += chunk;
                    setOutline(accumulatedOutline);
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
    }, [isGenerating, combinedCards, config, novelInfo, setOutline, setIsGenerating, storyArchive]);

    const groupedAndFilteredCards = useMemo(() => {
        const searchTarget = isAiEditMentionOpen ? aiEditMentionSearch : mentionSearch;
        const filtered = allCards.filter(card => 
            card.name.toLowerCase().includes(searchTarget.toLowerCase()) || 
            CARD_TYPE_NAMES[card.type].toLowerCase().includes(searchTarget.toLowerCase())
        );

        return filtered.reduce((acc, card) => {
            if (!acc[card.type]) {
                acc[card.type] = [];
            }
            acc[card.type].push(card);
            return acc;
        }, {} as Record<CardType, Card[]>);

    }, [allCards, mentionSearch, aiEditMentionSearch, isAiEditMentionOpen]);
    
    const useMentionMenuAutoExpand = (search: string, setExpandedCategories: React.Dispatch<React.SetStateAction<string[]>>) => {
        useEffect(() => {
            if (search) {
                const categories = Object.keys(groupedAndFilteredCards);
                setExpandedCategories(categories);
            }
        }, [search, groupedAndFilteredCards, setExpandedCategories]);
    };
    
    useMentionMenuAutoExpand(mentionSearch, setExpandedMentionCategories);
    useMentionMenuAutoExpand(aiEditMentionSearch, setExpandedAiEditMentionCategories);


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
        
        e.target.value = '';
    };
    
    const handleInterrupt = () => {
        abortControllerRef.current?.abort();
    };

    const handleClearHistory = () => {
        if (window.confirm(`您确定要清空“${chatMode === 'assistant' ? 'AI 修改' : 'AI 聊天'}”的对话记录吗？此操作无法撤销。`)) {
            setCurrentChatHistory([]);
        }
    };
    
    const handleRemoveReference = (indexToRemove: number) => {
        setChatReferences(prev => prev.filter((_, index) => index !== indexToRemove));
    };


    const handleChatSubmit = useCallback(async (e: React.SyntheticEvent) => {
        e.preventDefault();
        const message = chatInput.trim();
        const referencesText = chatReferences.join(' ');
        const rawMessage = `${referencesText} ${message}`.trim();
        
        if ((!rawMessage && attachments.length === 0) || isChatLoading) return;
        
        // The raw message with @mentions is for the UI.
        const messageForHistory = rawMessage;

        // The processed message with expanded card details is for the AI.
        const messageForAI = processMentions(rawMessage);

        setChatInput('');
        setChatReferences([]);
        setAttachments([]);
        if (chatInputRef.current) {
            chatInputRef.current.style.height = 'auto';
        }

        const controller = new AbortController();
        abortControllerRef.current = controller;

        let finalMessageForHistory = messageForHistory;
        const userMessageImages: string[] = [];
        const textAttachmentsContent: string[] = [];

        attachments.forEach(att => {
            if (att.type === 'image') {
                userMessageImages.push(att.data);
            } else if (att.type === 'text') {
                textAttachmentsContent.push(`--- Attached File: ${att.name} ---\n${att.data}`);
            }
        });
        
        // Append text attachments to the AI message, but not the UI message
        const finalMessageForAI = (messageForAI + '\n\n' + textAttachmentsContent.join('\n\n')).trim();

        if (textAttachmentsContent.length > 0) {
            finalMessageForHistory = (finalMessageForHistory + `\n\n[附带 ${textAttachmentsContent.length} 个文本文件]`).trim();
        }

        const newUserMessage: ChatMessage = { 
            id: `user-${Date.now()}`,
            role: 'user', 
            content: finalMessageForHistory,
            images: userMessageImages.length > 0 ? userMessageImages : undefined,
        };

        const newHistory = [...currentChatHistory, newUserMessage];
        setCurrentChatHistory(newHistory);
        setIsChatLoading(true);

        try {
            const assistantConfig = { ...config, model: config.assistantModel || config.model };

            if (chatMode === 'assistant') {
                const currentOutline = easyMdeInstance.current?.value() || outline;
                let finalOutline = "";
                const stream = polishOutline(currentOutline, finalMessageForAI, assistantConfig, controller.signal);
                for await (const chunk of stream) {
                    if (controller.signal.aborted) break;
                    finalOutline += chunk;
                    setOutline(finalOutline);
                }
                if (!controller.signal.aborted) {
                    setCurrentChatHistory(prev => [...prev, { id: `model-${Date.now()}`, role: 'model', content: '好的，我已经根据你的要求更新了大纲。' }]);
                }
            } else {
                let accumulatedResponse = "";
                setCurrentChatHistory(prev => [...prev, { id: `model-streaming-${Date.now()}`, role: 'model', content: '' }]);
                
                // Create a temporary history for the AI that includes the full system prompt and expanded content
                const historyForAI = newHistory.map(msg => 
                    msg.id === newUserMessage.id ? { ...msg, content: finalMessageForAI } : msg
                );

                const stream = generateChatResponse(historyForAI, assistantConfig, controller.signal);

                for await (const chunk of stream) {
                    accumulatedResponse += chunk;
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
                     setCurrentChatHistory(prev => [...prev, { id: `system-${Date.now()}`, role: 'system', content: '操作已由用户中断。' }]);
                } else {
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
                setCurrentChatHistory(prev => [...prev, { id: `system-error-${Date.now()}`, role: 'system', content: `抱歉，操作失败: ${errorMessage}` }]);
            }
        } finally {
            setIsChatLoading(false);
            abortControllerRef.current = null;
        }
    }, [chatInput, isChatLoading, outline, config, setOutline, chatMode, currentChatHistory, setCurrentChatHistory, attachments, chatReferences, setChatInput, processMentions]);

    const handleChatInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setChatInput(e.target.value);
        const textarea = e.target;
        textarea.style.height = 'auto';
        const maxHeight = 200;
        textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
        if (attachments.length >= MAX_ATTACHMENTS || isChatLoading) return;

        const items = Array.from(e.clipboardData.items);
        for (const item of items) {
            if ((item as DataTransferItem).kind === 'file' && (item as DataTransferItem).type.includes('image')) {
                const file = (item as DataTransferItem).getAsFile();
                if (file) {
                    e.preventDefault();
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        const base64String = (event.target?.result as string).split(',')[1];
                        setAttachments(prev => [...prev, { type: 'image', data: base64String, name: file.name || 'pasted-image.png' }]);
                    };
                    reader.readAsDataURL(file);
                    return;
                }
            }
        }
    };
    
    const handleImageFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;

        if (attachments.length + files.length > MAX_ATTACHMENTS) {
            alert(`最多只能添加 ${MAX_ATTACHMENTS} 个附件。您尝试添加 ${files.length} 个，但只能再添加 ${MAX_ATTACHMENTS - attachments.length} 个。`);
            e.target.value = '';
            return;
        }

        for (const file of Array.from(files)) {
            const typedFile = file as File;
            if (!typedFile.type.startsWith('image/')) {
                alert(`文件 "${typedFile.name}" 不是图片，已跳过。`);
                continue;
            }

            const reader = new FileReader();
            reader.onload = (event) => {
                const base64String = (event.target?.result as string).split(',')[1];
                setAttachments(prev => [...prev, { type: 'image', data: base64String, name: typedFile.name }]);
            };
            reader.readAsDataURL(typedFile);
        }
        e.target.value = '';
    };

    const handleTextFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;

        if (attachments.length + files.length > MAX_ATTACHMENTS) {
            alert(`最多只能添加 ${MAX_ATTACHMENTS} 个附件。您尝试添加 ${files.length} 个，但只能再添加 ${MAX_ATTACHMENTS - attachments.length} 个。`);
            e.target.value = '';
            return;
        }

        for (const file of Array.from(files)) {
            const typedFile = file as File;
            const reader = new FileReader();
            reader.onload = (event) => {
                const textContent = event.target?.result as string;
                setAttachments(prev => [...prev, { type: 'text', data: textContent, name: typedFile.name }]);
            };
            reader.readAsText(typedFile);
        }
        e.target.value = '';
    };
    
    const filteredModels = useMemo(() => {
        if (!modelSearch) return modelList;
        return modelList.filter(m => m.toLowerCase().includes(modelSearch.toLowerCase()));
    }, [modelList, modelSearch]);

    const toggleMentionCategory = (categoryType: string) => {
        setExpandedMentionCategories(prev =>
            prev.includes(categoryType)
                ? prev.filter(t => t !== categoryType)
                : [...prev, categoryType]
        );
    };

    const toggleAiEditMentionCategory = (categoryType: string) => {
        setExpandedAiEditMentionCategories(prev =>
            prev.includes(categoryType)
                ? prev.filter(t => t !== categoryType)
                : [...prev, categoryType]
        );
    };

    
    const handleAiEditRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!aiEditInstruction.trim() || !selectionInfoRef.current) return;
    
        const { content, from, to } = selectionInfoRef.current;
        const cm = easyMdeInstance.current?.codemirror;
        if (!cm) return;

        const processedInstruction = processMentions(aiEditInstruction);
    
        setSelectionPopup({ visible: false, x: 0, y: 0 });
        setIsAiEditing(false);
    
        const controller = new AbortController();
        abortControllerRef.current = controller;
        
        const placeholder = "✍️ AI 正在修改...";
        cm.getDoc().replaceRange(placeholder, from, to);
        const placeholderEndPos = { line: from.line, ch: from.ch + placeholder.length };
        
        try {
            const editConfig = { ...config, model: config.assistantModel || config.model };
            const stream = editText(content, processedInstruction, editConfig, controller.signal);
            
            let fullResponse = "";
            for await (const chunk of stream) {
                if (controller.signal.aborted) throw new DOMException('Aborted by user', 'AbortError');
                fullResponse += chunk;
            }
    
            cm.getDoc().replaceRange(fullResponse, from, placeholderEndPos);
    
        } catch (err) {
            cm.getDoc().replaceRange(content, from, placeholderEndPos);
            alert(err instanceof Error ? err.message : 'AI 编辑失败。');
        } finally {
            setAiEditInstruction('');
            setAiEditMentionSearch('');
            abortControllerRef.current = null;
            selectionInfoRef.current = null;
            cm.focus();
        }
    };

    const renderSelectionPopup = () => {
        if (!selectionPopup.visible) return null;
    
        return (
            <div 
                ref={selectionPopupRef}
                className="selection-popup"
                style={{ top: selectionPopup.y, left: selectionPopup.x }}
                onMouseDown={(e) => e.stopPropagation()}
            >
                {isAiEditing ? (
                     <form onSubmit={handleAiEditRequest} className="selection-popup-ai-input">
                        <textarea
                            value={aiEditInstruction}
                            onChange={(e) => setAiEditInstruction(e.target.value)}
                            placeholder="输入修改指令 (Ctrl+Enter 发送)..."
                            className="selection-popup-textarea custom-scrollbar"
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === 'Escape') {
                                    e.preventDefault();
                                    setIsAiEditing(false);
                                    setAiEditInstruction('');
                                }
                                if (e.key === 'Enter' && e.ctrlKey) {
                                    e.preventDefault();
                                    handleAiEditRequest(e);
                                }
                            }}
                        />
                        <div className="selection-popup-toolbar">
                             <div className="selection-popup-toolbar-left">
                                <div className="relative">
                                    <button
                                        type="button"
                                        onClick={() => setIsAiEditMentionOpen(p => !p)}
                                        className="selection-popup-icon-btn"
                                        title="提及卡片"
                                    >
                                        <AtSymbolIcon className="w-4 h-4" />
                                    </button>
                                     {isAiEditMentionOpen && (
                                        <div ref={aiEditMentionMenuRef} className="absolute bottom-full right-0 mb-2 w-72 bg-white dark:bg-zinc-800 rounded-xl shadow-lg border border-gray-200 dark:border-zinc-700 z-20 flex flex-col">
                                            <div className="p-2 border-b border-gray-200 dark:border-zinc-700">
                                                <input
                                                    type="text"
                                                    value={aiEditMentionSearch}
                                                    onChange={e => setAiEditMentionSearch(e.target.value)}
                                                    placeholder="搜索卡片..."
                                                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-500 focus:border-gray-500 dark:bg-zinc-700 dark:border-zinc-600 dark:text-white"
                                                    autoFocus
                                                />
                                            </div>
                                            <ul className="max-h-60 overflow-y-auto custom-scrollbar p-2">
                                                {Object.keys(groupedAndFilteredCards).length > 0 ? (
                                                    Object.entries(groupedAndFilteredCards).map(([type, cards]) => {
                                                        const isExpanded = expandedAiEditMentionCategories.includes(type);
                                                        return (
                                                             <li key={type}>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => toggleAiEditMentionCategory(type)}
                                                                    className="w-full flex justify-between items-center px-2 py-2 text-sm font-semibold text-gray-600 dark:text-zinc-300 rounded-md hover:bg-gray-100 dark:hover:bg-zinc-700"
                                                                >
                                                                    <span>{CARD_TYPE_NAMES[type as CardType]}</span>
                                                                    <ChevronDownIcon className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                                                </button>
                                                                {isExpanded && (
                                                                    <ul className="pl-2 pt-1 pb-2">
                                                                        {(cards as Card[]).map(card => (
                                                                            <li key={card.id}>
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => {
                                                                                        setAiEditInstruction(prev => prev + `@${card.name} `);
                                                                                        setIsAiEditMentionOpen(false);
                                                                                        setAiEditMentionSearch('');
                                                                                    }}
                                                                                    className="w-full text-left flex items-center gap-3 px-2 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors"
                                                                                >
                                                                                    {React.cloneElement(card.icon, { className: "w-4 h-4 text-gray-500 dark:text-zinc-400 flex-shrink-0" })}
                                                                                    <span className="text-sm text-gray-800 dark:text-zinc-200 truncate">{card.name}</span>
                                                                                </button>
                                                                            </li>
                                                                        ))}
                                                                    </ul>
                                                                )}
                                                            </li>
                                                        )
                                                    })
                                                ) : (
                                                    <li className="p-4 text-sm text-gray-500 dark:text-zinc-400 text-center">未找到卡片。</li>
                                                )}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <button type="submit" className="selection-popup-icon-btn selection-popup-send-btn" title="发送 (Ctrl+Enter)" disabled={!aiEditInstruction.trim()}>
                                <ArrowUpIcon className="w-4 h-4" />
                            </button>
                        </div>
                    </form>
                ) : (
                    <div className="selection-popup-buttons">
                        <button className="selection-popup-btn" onClick={() => setIsAiEditing(true)}>
                            <SparklesIcon className="w-4 h-4 text-purple-400" />
                            编辑 <span className="text-xs text-gray-400">Ctrl+I</span>
                        </button>
                        <div className="selection-popup-divider"></div>
                        <button className="selection-popup-btn" onClick={handleAddToChat}>
                            添加到对话 <span className="text-xs text-gray-400">Ctrl+U</span>
                        </button>
                    </div>
                )}
            </div>
        );
    };


    return (
        <div className="w-full h-full flex flex-row gap-2">
            {/* Left Panel: Outline Info */}
            <aside className="w-56 flex-shrink-0 h-full flex flex-col bg-white rounded-xl border border-gray-200 shadow-sm dark:bg-zinc-800 dark:border-zinc-700 min-h-0">
                 <header className="p-4 border-b border-gray-200 dark:border-zinc-600 flex-shrink-0">
                    <h2 className="font-semibold text-gray-800 dark:text-zinc-100">大纲信息</h2>
                </header>
                <div className="flex-grow overflow-y-auto custom-scrollbar">
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
                </div>
            </aside>

            {/* Middle Panel: Editor */}
            <div className="flex-grow h-full flex flex-col min-w-0 min-h-0">
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
                
                <div className="flex-grow relative editor-container min-h-0">
                    {isGenerating && !outline && (
                        <div className="absolute inset-0 bg-white/70 dark:bg-zinc-800/70 flex flex-col items-center justify-center z-10 rounded-xl backdrop-blur-sm" aria-live="polite">
                            <div className="text-purple-500 w-12 h-12">
                                <svg className="animate-spin h-full w-full" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            </div>
                            <p className="mt-4 text-lg text-gray-700 dark:text-zinc-200 font-semibold">AI 正在努力创作中，请稍候...</p>
                            <p className="mt-2 text-sm text-gray-500 dark:text-zinc-400">大纲内容将在此处逐步显示</p>
                        </div>
                    )}
                    {renderSelectionPopup()}
                    <textarea ref={textareaRef} style={{ display: 'none' }} />
                </div>
            </div>

             {/* Right Panel: Chat Assistant */}
            <aside className="w-96 flex-shrink-0 h-full flex flex-col bg-white rounded-xl border border-gray-200 shadow-sm dark:bg-zinc-800 dark:border-zinc-700 min-h-0">
                <header className="flex-shrink-0 p-3 border-b border-gray-200 dark:border-zinc-600 flex justify-between items-center">
                    <div className="flex items-center gap-1 rounded-lg bg-gray-100 dark:bg-zinc-700/60 p-1">
                        <button
                            onClick={() => setChatMode('assistant')}
                            className={`w-20 py-1 rounded-md text-sm font-medium transition-all duration-200 ${
                                chatMode === 'assistant' 
                                ? 'bg-white text-gray-800 shadow-sm dark:bg-zinc-600 dark:text-zinc-100' 
                                : 'text-gray-600 hover:bg-white/50 dark:text-zinc-400 dark:hover:bg-zinc-900/20'
                            }`}
                        >
                            AI 修改
                        </button>
                        <button
                            onClick={() => setChatMode('chat')}
                            className={`w-20 py-1 rounded-md text-sm font-medium transition-all duration-200 ${
                                chatMode === 'chat' 
                                ? 'bg-white text-gray-800 shadow-sm dark:bg-zinc-600 dark:text-zinc-100' 
                                : 'text-gray-600 hover:bg-white/50 dark:text-zinc-400 dark:hover:bg-zinc-900/20'
                            }`}
                        >
                            AI 聊天
                        </button>
                    </div>
                    <button
                        onClick={handleClearHistory}
                        className="p-2 text-gray-400 hover:text-red-600 rounded-full hover:bg-red-100/60 transition-colors dark:text-zinc-500 dark:hover:text-red-500 dark:hover:bg-red-900/40"
                        title="清空当前对话记录"
                    >
                        <TrashIcon className="w-4 h-4" />
                    </button>
                </header>
                <div ref={chatContainerRef} className="flex-grow p-4 space-y-4 overflow-y-auto custom-scrollbar">
                   {currentChatHistory.map((msg, index) => {
                        if (msg.role === 'system') {
                            return (
                                <div key={msg.id} className="text-center w-full my-2">
                                    <p className="text-xs text-gray-500 bg-slate-100 rounded-full px-3 py-1 inline-block dark:bg-zinc-700 dark:text-zinc-400">{msg.content}</p>
                                </div>
                            );
                        }
                        
                        const isUser = msg.role === 'user';
                        const isLastMessageStreaming = isChatLoading && index === currentChatHistory.length - 1 && !isUser;

                        return (
                            <div key={msg.id} className={`flex items-end gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}>
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
                                    {msg.images && msg.images.length > 0 && (
                                        <div className="flex flex-wrap gap-2 mb-2">
                                            {msg.images.map((imgData, imgIndex) => (
                                                <img
                                                    key={imgIndex}
                                                    src={`data:image/jpeg;base64,${imgData}`}
                                                    alt={`Uploaded content ${imgIndex + 1}`}
                                                    className="rounded-lg max-w-full h-auto max-h-48 object-contain bg-gray-200 dark:bg-zinc-600"
                                                />
                                            ))}
                                        </div>
                                    )}
                                    <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">
                                        {isLastMessageStreaming && !msg.content ? <Spinner /> : msg.content}
                                        {isLastMessageStreaming && msg.content ? <span className="inline-block w-2 h-4 bg-gray-600 dark:bg-zinc-400 animate-pulse ml-1" /> : null}
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
                    <form onSubmit={handleChatSubmit} className="group relative flex flex-col w-full rounded-xl shadow-md border-2 border-transparent bg-clip-padding focus-within:border-purple-400 transition-all duration-300"
                        style={{
                            backgroundImage: `linear-gradient(var(--ai-input-bg, #fff), var(--ai-input-bg, #fff)), linear-gradient(120deg, #a855f7, #fde047)`,
                            backgroundOrigin: 'border-box'
                        }}
                    >
                        {(attachments.length > 0 || chatReferences.length > 0) && (
                             <div className="px-3 pt-2 border-b border-gray-200 dark:border-zinc-700">
                                <div className="flex items-start flex-wrap gap-2 pb-2">
                                    {chatReferences.map((ref, index) => (
                                        <div key={`ref-${index}`} className="chat-reference-pill">
                                            <button type="button" onClick={() => handleRemoveReference(index)} className="chat-reference-pill-btn" aria-label={`删除引用 ${ref}`}>
                                                &times;
                                            </button>
                                            <span>{ref}</span>
                                        </div>
                                    ))}
                                    {attachments.map((att, index) => (
                                        <div key={`att-${index}`} className="relative flex-shrink-0 bg-gray-100 dark:bg-zinc-700 p-1.5 rounded-lg">
                                            {att.type === 'image' ? (
                                                <img src={`data:image/jpeg;base64,${att.data}`} alt="Preview" className="h-16 w-auto rounded" />
                                            ) : (
                                                <div className="h-16 w-20 flex flex-col items-center justify-center text-center p-1">
                                                    <DocumentPlusIcon className="w-6 h-6 text-gray-500 dark:text-zinc-400" />
                                                    <span className="text-xs text-gray-600 dark:text-zinc-300 mt-1 truncate w-full" title={att.name}>{att.name}</span>
                                                </div>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => setAttachments(prev => prev.filter((_, i) => i !== index))}
                                                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-gray-700 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-500 transition-colors z-10"
                                                aria-label={`Remove ${att.name}`}
                                            >
                                                &times;
                                            </button>
                                        </div>
                                    ))}
                                    {attachments.length >= MAX_ATTACHMENTS && (
                                        <div className="text-xs text-red-500 pl-2 flex-shrink-0 self-center">达到最大数量</div>
                                    )}
                                </div>
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
                                onPaste={handlePaste}
                                disabled={isChatLoading}
                                placeholder={chatMode === 'assistant' ? "有什么可以帮您修改大纲？" : "粘贴图片或输入文字..."}
                                className="w-full pl-12 pr-36 py-3 text-base rounded-b-xl focus:outline-none custom-scrollbar resize-none bg-transparent placeholder:text-gray-400 transition-all duration-300 dark:text-white dark:placeholder:text-zinc-500 min-h-[56px] break-all break-words"
                            />
                            <div className="absolute bottom-3 right-3 flex items-center gap-1 z-10">
                                <div ref={mentionMenuRef} className="relative">
                                    <button
                                        type="button"
                                        onClick={() => setIsMentionMenuOpen(prev => !prev)}
                                        className="p-2 rounded-full transition-colors text-gray-500 hover:text-gray-800 hover:bg-gray-100 disabled:text-gray-300 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-700"
                                        aria-label="提及卡片"
                                        title="提及卡片"
                                        aria-haspopup="true"
                                        aria-expanded={isMentionMenuOpen}
                                        disabled={isChatLoading}
                                    >
                                        <AtSymbolIcon className="w-5 h-5" />
                                    </button>
                                     {isMentionMenuOpen && (
                                        <div className="absolute bottom-full right-0 mb-2 w-80 bg-white dark:bg-zinc-800 rounded-xl shadow-lg border border-gray-200 dark:border-zinc-700 z-20 flex flex-col">
                                            <div className="p-2 border-b border-gray-200 dark:border-zinc-700">
                                                <input
                                                    type="text"
                                                    value={mentionSearch}
                                                    onChange={e => setMentionSearch(e.target.value)}
                                                    placeholder="搜索卡片..."
                                                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-500 focus:border-gray-500 dark:bg-zinc-700 dark:border-zinc-600 dark:text-white"
                                                    autoFocus
                                                />
                                            </div>
                                            <ul className="max-h-80 overflow-y-auto custom-scrollbar p-2">
                                                {Object.keys(groupedAndFilteredCards).length > 0 ? (
                                                    Object.entries(groupedAndFilteredCards).map(([type, cards]) => {
                                                        const isExpanded = expandedMentionCategories.includes(type);
                                                        return (
                                                            <li key={type}>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => toggleMentionCategory(type)}
                                                                    className="w-full flex justify-between items-center px-2 py-2 text-sm font-semibold text-gray-600 dark:text-zinc-300 rounded-md hover:bg-gray-100 dark:hover:bg-zinc-700"
                                                                >
                                                                    <span>{CARD_TYPE_NAMES[type as CardType]}</span>
                                                                    <ChevronDownIcon className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                                                </button>
                                                                {isExpanded && (
                                                                    <ul className="pl-2 pt-1 pb-2">
                                                                        {(cards as Card[]).map(card => (
                                                                            <li key={card.id}>
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => {
                                                                                        setChatInput(prev => prev + `@${card.name} `);
                                                                                        setIsMentionMenuOpen(false);
                                                                                        setMentionSearch('');
                                                                                        chatInputRef.current?.focus();
                                                                                    }}
                                                                                    className="w-full text-left flex items-center gap-3 px-2 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors"
                                                                                >
                                                                                    {React.cloneElement(card.icon, { className: "w-4 h-4 text-gray-500 dark:text-zinc-400 flex-shrink-0" })}
                                                                                    <span className="text-sm text-gray-800 dark:text-zinc-200 truncate">{card.name}</span>
                                                                                </button>
                                                                            </li>
                                                                        ))}
                                                                    </ul>
                                                                )}
                                                            </li>
                                                        );
                                                    })
                                                ) : (
                                                    <li className="p-4 text-sm text-gray-500 dark:text-zinc-400 text-center">未找到卡片。</li>
                                                )}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                                <div ref={uploadMenuRef} className="relative">
                                    <button
                                        type="button"
                                        onClick={() => setIsUploadMenuOpen(prev => !prev)}
                                        className="p-2 rounded-full transition-colors text-gray-500 hover:text-gray-800 hover:bg-gray-100 disabled:text-gray-300 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-700"
                                        aria-label="上传文件"
                                        title="上传文件"
                                        aria-haspopup="true"
                                        aria-expanded={isUploadMenuOpen}
                                        disabled={isChatLoading || attachments.length >= MAX_ATTACHMENTS}
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
                                    disabled={!isChatLoading && !chatInput.trim() && attachments.length === 0 && chatReferences.length === 0}
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
                    <input type="file" ref={textUploadInputRef} onChange={handleTextFileSelected} accept=".txt,.md" className="hidden" multiple />
                    <input type="file" ref={imageUploadInputRef} onChange={handleImageFileSelected} accept="image/*" className="hidden" multiple />
                </div>
            </aside>
        </div>
    );
};

export default ResultView;