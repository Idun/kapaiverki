import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { CharacterProfile, AIConfig, StoryArchiveItem, CharacterRole } from '../types';
import { TrashIcon, SparklesIcon, PreviewIcon, DownloadIcon, UploadIcon, ArchiveBoxIcon } from './icons';
import Spinner from './Spinner';
import { generateCharacterProfile, fetchModels } from '../services/aiService';

interface CharacterShapingViewProps {
    profile: CharacterProfile;
    setProfile: React.Dispatch<React.SetStateAction<CharacterProfile>>;
    config: AIConfig;
    onSaveCharacter: () => void;
    onClearAll: () => void;
}

interface FormFieldProps {
    id: keyof Omit<CharacterProfile, 'name' | 'role'>;
    label: string;
    description: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
    placeholder: string;
    className?: string;
}

const CHARACTER_ROLES: CharacterRole[] = ['男主角', '女主角', '男二', '女二', '配角', '反派', '其他角色'];

const FormField: React.FC<FormFieldProps> = ({ id, label, description, value, onChange, placeholder, className = '' }) => (
    <div className={`mb-8 ${className}`}>
        <label htmlFor={id} className="block text-xl font-semibold text-gray-800 dark:text-zinc-100 mb-2">{label}</label>
        <p className="text-sm text-gray-500 dark:text-zinc-400 mb-3" dangerouslySetInnerHTML={{ __html: description }}></p>
        <textarea
            id={id}
            name={id}
            rows={5}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-400 dark:bg-zinc-700 dark:border-zinc-600 dark:text-white custom-scrollbar transition"
        />
    </div>
);

const CharacterPreviewModal: React.FC<{ 
    profile: CharacterProfile; 
    onClose: () => void;
    onSave: (newProfile: CharacterProfile) => void;
}> = ({ profile, onClose, onSave }) => {
    const [editingKey, setEditingKey] = useState<keyof CharacterProfile | null>(null);
    const [internalProfile, setInternalProfile] = useState<CharacterProfile>(profile);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (!editingKey) {
            setInternalProfile(profile);
        }
    }, [profile, editingKey]);
    
    useEffect(() => {
        if (editingKey && textareaRef.current) {
            textareaRef.current.focus();
            textareaRef.current.setSelectionRange(textareaRef.current.value.length, textareaRef.current.value.length);
        }
    }, [editingKey]);

    const handleSave = () => {
        onSave(internalProfile);
        setEditingKey(null);
    };

    const handleCancel = () => {
        setInternalProfile(profile); // Revert changes
        setEditingKey(null);
    };
    
    const handleFieldChange = (key: keyof CharacterProfile, value: string) => {
        setInternalProfile(prev => ({ ...prev, [key]: value }));
    };

    const labels: Record<keyof CharacterProfile, string> = {
        role: '角色定位',
        name: '角色名称',
        image: '形象',
        selfAwareness: '自我意识',
        reactionLogic: '合理反应',
        stakes: '利害关系',
        emotion: '核心情绪',
        likability: '好感度',
        competence: '能力',
        proactivity: '主动性',
        power: '限制'
    };
    
    const profileKeysInOrder: Array<keyof CharacterProfile> = [
        'role', 'name', 'image', 'selfAwareness', 'reactionLogic', 'stakes', 
        'emotion', 'likability', 'competence', 'proactivity', 'power'
    ];
    
    const hasContent = profileKeysInOrder.some(key => profile[key] && String(profile[key]).trim() !== '');

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4 transition-opacity duration-300 animate-fade-in"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
        >
            <div 
                className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col transform transition-all duration-300 scale-95 opacity-0 animate-fade-in-scale dark:bg-zinc-800"
                onClick={e => e.stopPropagation()}
            >
                <header className="flex-shrink-0 flex justify-between items-center p-4 border-b border-gray-200 dark:border-zinc-700">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-zinc-100">角色预览</h2>
                    <button 
                        onClick={onClose} 
                        className="p-2 text-2xl leading-none text-gray-400 hover:text-gray-700 dark:hover:text-zinc-200 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-700"
                        aria-label="关闭预览"
                    >
                        &times;
                    </button>
                </header>
                <div className="p-6 overflow-y-auto custom-scrollbar">
                    {hasContent ? (
                        <div className="space-y-6">
                            {profileKeysInOrder.map(key => {
                                const value = profile[key];
                                if (!value || String(value).trim() === '') return null;
                                return (
                                    <div key={key}>
                                        <h3 className="font-semibold text-lg text-gray-700 dark:text-zinc-200 mb-2 pb-1 border-b border-gray-200 dark:border-zinc-600">
                                            {labels[key]}
                                        </h3>
                                        {editingKey === key ? (
                                            <div>
                                                <textarea
                                                    ref={textareaRef}
                                                    value={internalProfile[key]}
                                                    onChange={(e) => handleFieldChange(key, e.target.value)}
                                                    className="w-full px-3 py-2 border border-purple-400 rounded-md bg-purple-50 dark:bg-zinc-700/50 dark:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 custom-scrollbar"
                                                    rows={Math.max(5, (String(internalProfile[key]).split('\n').length || 1) + 2)}
                                                />
                                                <div className="mt-2 flex justify-end gap-2">
                                                    <button onClick={handleCancel} className="text-sm px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 dark:bg-zinc-600 dark:hover:bg-zinc-500">取消</button>
                                                    <button onClick={handleSave} className="text-sm px-3 py-1 rounded bg-purple-600 hover:bg-purple-700 text-white">保存</button>
                                                </div>
                                            </div>
                                        ) : (
                                            <p 
                                                onDoubleClick={() => setEditingKey(key)} 
                                                className="text-gray-600 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed cursor-pointer rounded-md p-2 -m-2 hover:bg-gray-100 dark:hover:bg-zinc-700/50"
                                                title="双击编辑"
                                            >
                                                {value}
                                            </p>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <p className="text-center text-gray-500 dark:text-zinc-400 py-10">角色资料为空，请先填写内容。</p>
                    )}
                </div>
            </div>
             <style>{`
                @keyframes fade-in {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                .animate-fade-in {
                    animation: fade-in 0.2s ease-out forwards;
                }
                @keyframes fade-in-scale {
                    from { transform: scale(0.95); opacity: 0; }
                    to { transform: scale(1); opacity: 1; }
                }
                .animate-fade-in-scale {
                    animation: fade-in-scale 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }
            `}</style>
        </div>
    );
};


const CharacterShapingView: React.FC<CharacterShapingViewProps> = ({ profile, setProfile, config, onSaveCharacter, onClearAll }) => {
    const [isAiGenerating, setIsAiGenerating] = useState(false);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [localModel, setLocalModel] = useState<string>('');
    const [isModelSelectOpen, setIsModelSelectOpen] = useState(false);
    const [modelList, setModelList] = useState<string[]>([]);
    const [isModelListLoading, setIsModelListLoading] = useState(false);
    const [modelSearch, setModelSearch] = useState('');
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle');
    const modelSelectRef = useRef<HTMLDivElement>(null);
    const importFileRef = useRef<HTMLInputElement>(null);


     useEffect(() => {
        const loadModels = async () => {
            if (!config.provider) return;

            setIsModelListLoading(true);
            try {
                const models = await fetchModels(config);
                setModelList(models);
                if (models.length > 0) {
                    // Prioritize assistantModel, then main model, then first in list
                    const preferredModel = (config.assistantModel && models.includes(config.assistantModel))
                        ? config.assistantModel
                        : (config.model && models.includes(config.model))
                            ? config.model
                            : models[0];
                    setLocalModel(preferredModel);
                }
            } catch (error) {
                console.error("Failed to fetch models for character shaping:", error);
                setModelList([]);
            } finally {
                setIsModelListLoading(false);
            }
        };

        loadModels();
    }, [config.provider, config.endpoint, config.model, config.assistantModel]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (modelSelectRef.current && !modelSelectRef.current.contains(event.target as Node)) {
                setIsModelSelectOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredModels = useMemo(() => {
        if (!modelSearch) return modelList;
        return modelList.filter(m => m.toLowerCase().includes(modelSearch.toLowerCase()));
    }, [modelList, modelSearch]);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const { id, value } = e.target;
        setProfile(prev => ({ ...prev, [id]: value }));
    };

    const handleSaveCharacter = () => {
        onSaveCharacter();
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
    };

    const handleAiGenerateDetails = async () => {
        setIsAiGenerating(true);
        try {
            const generationConfig = { ...config, model: localModel };
            const result = await generateCharacterProfile(profile, generationConfig);
            setProfile(prev => ({ ...prev, ...result }));
        } catch (error) {
            alert(error instanceof Error ? error.message : 'AI 生成失败，请检查您的网络和AI设置。');
        } finally {
            setIsAiGenerating(false);
        }
    };

    const handleExport = () => {
        const characterName = profile.name || 'character';
        const fileName = prompt("请输入要导出的文件名：", characterName);
        if (!fileName || !fileName.trim()) {
            return;
        }

        try {
            const jsonString = JSON.stringify(profile, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${fileName.trim()}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Failed to export character profile:", error);
            alert("导出角色文件失败！");
        }
    };

    const handleImportClick = () => {
        importFileRef.current?.click();
    };

    const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const content = event.target?.result as string;
                const parsedData = JSON.parse(content);

                const profileKeys: Array<keyof CharacterProfile> = ['role', 'name', 'image', 'selfAwareness', 'reactionLogic', 'stakes', 'emotion', 'likability', 'competence', 'proactivity', 'power'];
                const hasAtLeastOneKey = profileKeys.some(key => key in parsedData);
                
                if (typeof parsedData === 'object' && parsedData !== null && hasAtLeastOneKey) {
                    const defaultProfile: CharacterProfile = {
                        role: '其他角色', name: '', image: '', selfAwareness: '', reactionLogic: '', stakes: '', emotion: '',
                        likability: '', competence: '', proactivity: '', power: ''
                    };
                    setProfile({ ...defaultProfile, ...parsedData });
                    alert('角色资料导入成功！');
                } else {
                    throw new Error('JSON 文件格式不正确或不包含有效的角色资料。');
                }
            } catch (error) {
                alert(`导入失败: ${error instanceof Error ? error.message : '无法读取文件。'}`);
            }
        };
        reader.onerror = () => {
            alert('读取文件失败。');
        };
        reader.readAsText(file);
        
        e.target.value = '';
    };

    return (
        <div className="w-full max-w-4xl mx-auto h-full flex flex-col">
            <header className="mb-8 flex-shrink-0 flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800 dark:text-zinc-100">角色塑造</h1>
                    <p className="mt-2 text-gray-600 dark:text-zinc-300">
                        运用专业的角色构建工具，从零开始雕琢一个有血有肉、令人印象深刻的角色。
                    </p>
                </div>
                <div className="flex items-center gap-2">
                     <button
                        onClick={() => setIsPreviewOpen(true)}
                        className="flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 transition-colors dark:bg-zinc-700 dark:text-zinc-200 dark:border-zinc-600 dark:hover:bg-zinc-600"
                        title="预览当前角色塑造情况"
                    >
                        <PreviewIcon className="w-4 h-4" />
                        <span className="whitespace-nowrap">预览</span>
                    </button>
                    <button
                        onClick={handleExport}
                        className="flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 transition-colors dark:bg-zinc-700 dark:text-zinc-200 dark:border-zinc-600 dark:hover:bg-zinc-600"
                        title="将角色资料导出为 JSON 文件"
                    >
                        <DownloadIcon className="w-4 h-4" />
                        <span className="whitespace-nowrap">导出</span>
                    </button>
                    <button
                        onClick={handleImportClick}
                        className="flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 transition-colors dark:bg-zinc-700 dark:text-zinc-200 dark:border-zinc-600 dark:hover:bg-zinc-600"
                        title="从 JSON 文件导入角色资料"
                    >
                        <UploadIcon className="w-4 h-4" />
                        <span className="whitespace-nowrap">导入</span>
                    </button>
                     <button
                        onClick={handleSaveCharacter}
                        disabled={saveStatus === 'saved'}
                        className={`flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg shadow-sm transition-all ${
                            saveStatus === 'saved'
                                ? 'bg-green-600 text-white cursor-default'
                                : 'bg-gray-800 text-white hover:bg-gray-900 dark:bg-slate-100 dark:text-gray-800 dark:hover:bg-slate-200'
                        }`}
                        title="将当前角色保存到故事存档"
                    >
                        {saveStatus === 'saved' ? (
                           <span className="whitespace-nowrap">✓ 已保存</span>
                        ) : (
                            <>
                                <ArchiveBoxIcon className="w-4 h-4" />
                                <span className="whitespace-nowrap">保存</span>
                            </>
                        )}
                    </button>
                    <button
                        onClick={onClearAll}
                        className="flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 transition-colors dark:bg-zinc-700 dark:text-zinc-200 dark:border-zinc-600 dark:hover:bg-zinc-600"
                        title="清空所有字段"
                    >
                        <TrashIcon className="w-4 h-4" />
                        <span className="whitespace-nowrap">清空</span>
                    </button>
                </div>
            </header>
            <div className="flex-grow overflow-y-auto custom-scrollbar -mr-6 pr-6">
                <div className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm dark:bg-zinc-800/50 dark:border-zinc-700">
                    <form>
                        <div className="mb-8">
                            <label htmlFor="character-name" className="block text-xl font-semibold text-gray-800 dark:text-zinc-100 mb-2">角色名称</label>
                            <p className="text-sm text-gray-500 dark:text-zinc-400 mb-3">为你的角色起一个独一无二的名字，并选择其在故事中的定位。</p>
                            <div className="flex items-center gap-4">
                                <div className="relative">
                                    <select
                                        id="character-role"
                                        name="role"
                                        value={profile.role || '其他角色'}
                                        onChange={(e) => setProfile(prev => ({...prev, role: e.target.value as CharacterRole}))}
                                        className="w-32 px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white dark:bg-zinc-700 dark:border-zinc-600 dark:text-white transition appearance-none"
                                    >
                                        {CHARACTER_ROLES.map(role => (
                                            <option key={role} value={role}>{role}</option>
                                        ))}
                                    </select>
                                     <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500 dark:text-zinc-400">
                                        <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                                    </div>
                                </div>
                                <input
                                    id="character-name"
                                    name="name"
                                    type="text"
                                    value={profile.name}
                                    onChange={(e) => setProfile(prev => ({...prev, name: e.target.value}))}
                                    placeholder="例如：林惊羽、艾莉亚·史塔克..."
                                    className="flex-grow px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-400 dark:bg-zinc-700 dark:border-zinc-600 dark:text-white transition"
                                />
                            </div>
                        </div>

                        <div>
                            <FormField
                                id="image"
                                label="第一阶段：形象"
                                description="为角色设计一个鲜明的第一印象。关键在于<b>打破常规</b>，赋予角色一个与众不同的特质、习惯或背景，让他/她从一开始就充满吸引力。"
                                value={profile.image}
                                onChange={handleChange}
                                placeholder="例如：一个身手不凡的电脑黑客，却有严重的社交恐惧症；一位坚持素食主义的吸血鬼；一个梦想成为摇滚明星的古代书生..."
                            />
                            <div className="flex items-center justify-start -mt-6 gap-2">
                                <button
                                    type="button"
                                    onClick={handleAiGenerateDetails}
                                    disabled={isAiGenerating}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-70 disabled:cursor-not-allowed dark:bg-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-500"
                                    title="AI将根据所有已填写的信息，自动完善整个角色资料"
                                >
                                    {isAiGenerating ? <Spinner /> : <SparklesIcon className="w-4 h-4 text-purple-400" />}
                                    <span>AI 生成</span>
                                </button>
                                <div ref={modelSelectRef} className="relative w-40">
                                    <button
                                        type="button"
                                        onClick={() => setIsModelSelectOpen(!isModelSelectOpen)}
                                        disabled={isModelListLoading}
                                        className="w-full flex items-center justify-between pl-3 pr-2 py-1.5 text-xs bg-white border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-gray-500 focus:border-gray-500 disabled:opacity-60 disabled:bg-gray-100 transition-all dark:bg-zinc-700 dark:border-zinc-600 dark:text-zinc-100 dark:disabled:bg-zinc-600"
                                        aria-haspopup="listbox"
                                        aria-expanded={isModelSelectOpen}
                                        aria-label="选择模型"
                                    >
                                        <span className="truncate">{isModelListLoading ? '加载中...' : localModel || '选择模型'}</span>
                                        <svg className="fill-current h-4 w-4 opacity-50" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
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
                                                                setLocalModel(modelName);
                                                                setIsModelSelectOpen(false);
                                                                setModelSearch('');
                                                            }}
                                                            className={`px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-zinc-600 ${localModel === modelName ? 'font-semibold text-blue-600 dark:text-blue-400' : ''}`}
                                                            role="option"
                                                            aria-selected={localModel === modelName}
                                                        >
                                                            {modelName}
                                                        </li>
                                                    ))
                                                ) : (
                                                    <li className="px-3 py-2 text-gray-500 dark:text-zinc-400">{isModelListLoading ? '加载中...' : '无匹配模型'}</li>
                                                )}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        
                        <div className="mt-12">
                            <h2 className="text-2xl font-bold text-gray-800 dark:text-zinc-100 mb-4 pb-2 border-b-2 border-purple-200 dark:border-purple-800">第二阶段：逻辑</h2>
                            <p className="text-gray-600 dark:text-zinc-300 leading-relaxed mb-6">形象只是外壳，逻辑才是骨架。在这里，你需要为角色的独特之处建立内在的行为准则，让读者相信——<b>他/她就是会这么做</b>。</p>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 md:gap-x-8">
                                <FormField
                                    id="selfAwareness"
                                    label="自我意识"
                                    description="角色的核心行为模式。把他/她丢进任何一个情境中，你都能立刻预判其反应吗？这是成熟角色的标志。"
                                    value={profile.selfAwareness}
                                    onChange={handleChange}
                                    placeholder="例如：遇到无法解释的超自然现象，一个坚定的无神论者科学家会试图用物理学解构它，而一个虔诚的信徒则会将其视为神迹。"
                                />
                                <FormField
                                    id="reactionLogic"
                                    label="合理反应"
                                    description="行为必须符合性格。一个角色的每个选择都应植根于其经历。反复检查：这个反应是否夸张或平淡？是否与之前的情节矛盾？"
                                    value={profile.reactionLogic}
                                    onChange={handleChange}
                                    placeholder="例如：一位身经百战、冷酷无情的将军，在战场上为何会为一个敌方的小兵求情？这个“反常”行为的背后，是否隐藏着一段不为人知的往事？"
                                />
                            </div>
                            <FormField
                                id="stakes"
                                label="利害关系"
                                description="角色并非孤立存在。他们之间的关系——无论是合作、竞争、爱慕还是仇恨——都是驱动情节的核心动力。"
                                value={profile.stakes}
                                onChange={handleChange}
                                placeholder="例如：两位挚友因信仰不同而分道扬镳，最终兵戎相见；一个侦探发现自己追查的凶手竟是自己的恩人；为了拯救爱人，主角必须与昔日的盟友为敌。"
                            />
                        </div>

                        <div className="mt-12">
                             <FormField
                                id="emotion"
                                label="第三阶段：核心情绪"
                                description="如果说逻辑是骨架，情绪就是驱动角色的血液。为你的角色注入一种强烈、甚至是偏执的核心情绪，这将成为他/她所有行动的最终解释。"
                                value={profile.emotion}
                                onChange={handleChange}
                                placeholder="例如：对复仇的执念，可以为此牺牲一切；对某个目标的病态追求，不惜众叛亲离；源于童年阴影的极度自卑，或是一种想要证明自己的狂热渴望。"
                            />
                        </div>

                        <div className="mt-12">
                            <h2 className="text-2xl font-bold text-gray-800 dark:text-zinc-100 mb-4 pb-2 border-b-2 border-green-200 dark:border-green-800">角色调节器</h2>
                             <p className="text-gray-600 dark:text-zinc-300 leading-relaxed mb-6">这是一个宏观视角下的角色平衡工具。通过调整以下四个维度，你可以快速定位角色的类型，并发现潜在的塑造空间或缺陷。</p>

                            <div className="grid grid-cols-1 md:grid-cols-2 md:gap-x-8 items-start">
                                <FormField
                                    id="likability"
                                    label="好感度"
                                    description="如何让读者与角色产生共鸣？赋予其令人钦佩的品质（勇敢、诚实），设计一个能引发同情的背景或行为（“救猫咪”理论）。"
                                    value={profile.likability}
                                    onChange={handleChange}
                                    placeholder="例如：一个愤世嫉俗的侦探，却会为街边的孤儿买一个热面包；角色背负着家族的血海深仇；他/她身边总有一群愿为其两肋插刀的朋友。"
                                />
                                 <FormField
                                    id="competence"
                                    label="能力"
                                    description="角色的核心技能是什么？一个有趣的角色不应是全能的，适当的“无能”领域反而能创造更多戏剧性。"
                                    value={profile.competence}
                                    onChange={handleChange}
                                    placeholder="例如：卓越的战略家，善于言辞；能操控影子。能力受限的场景：在一个完全没有光的地方，他的影子能力将毫无用处。"
                                />
                                <FormField
                                    id="proactivity"
                                    label="主动性"
                                    description="角色是推动情节，还是被情节推动？一个主动的角色拥有明确目标，能让读者迅速投入。对于被动角色，需要不断提高风险来迫使他行动。"
                                    value={profile.proactivity}
                                    onChange={handleChange}
                                    placeholder="例如：一个只想过平凡生活的农夫，在家园被毁后，为了复仇和保护幸存者，不得不拿起武器。外部压力迫使他采取主动。"
                                />
                                <FormField
                                    id="power"
                                    label="限制"
                                    description="角色的弱点比超能力更有趣。一个角色的“不能做什么”比“能做什么”更能塑造其形象。记住：<b>限制 > 能力</b>。"
                                    value={profile.power}
                                    onChange={handleChange}
                                    placeholder="例如：一个能预知未来的先知，却无法改变自己看到的悲剧；一个拥有不死之身的角色，却渴望体验真正的死亡；一个能操控时间的刺客，但每次使用能力都会加速自己的衰老。"
                                />
                            </div>
                        </div>
                    </form>
                </div>
            </div>
            {isPreviewOpen && <CharacterPreviewModal profile={profile} onClose={() => setIsPreviewOpen(false)} onSave={setProfile} />}
             <input
                type="file"
                ref={importFileRef}
                onChange={handleFileImport}
                accept="application/json"
                className="hidden"
            />
        </div>
    );
};

export default CharacterShapingView;