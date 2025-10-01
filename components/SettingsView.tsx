





import React, { useState, useEffect } from 'react';
import type { AIConfig, AIProvider, PromptTemplate, UISettings } from '../types';
import { fetchModels } from '../services/aiService';

interface SettingsViewProps {
    currentConfig: AIConfig;
    onSave: (config: AIConfig) => void;
    currentUISettings: UISettings;
    onSaveUISettings: (settings: UISettings) => void;
}

const PROVIDER_DEFAULTS: Record<AIProvider, { endpoint: string; modelPlaceholder: string; }> = {
    gemini: { endpoint: '', modelPlaceholder: '' },
    openai: { endpoint: 'https://api.openai.com', modelPlaceholder: 'gpt-4o, gpt-3.5-turbo' },
    deepseek: { endpoint: 'https://api.deepseek.com', modelPlaceholder: 'deepseek-chat' },
    openrouter: { endpoint: 'https://openrouter.ai/api/v1', modelPlaceholder: 'meta-llama/llama-3-8b-instruct' },
    siliconflow: { endpoint: 'https://api.siliconflow.cn', modelPlaceholder: 'Qwen/Qwen2-7B-Instruct' },
    modelscope: { endpoint: 'https://api-inference.modelscope.cn', modelPlaceholder: 'qwen-plus, qwen-turbo' },
    ollama: { endpoint: 'http://localhost:11443', modelPlaceholder: 'llama3, qwen2' },
    custom: { endpoint: '', modelPlaceholder: '输入您的模型名称' },
};

// Moved outside the main component to prevent re-creation on re-renders, which causes focus loss.
const InputField: React.FC<{ label: string; id: string; children: React.ReactNode, description?: string }> = ({ label, id, children, description }) => (
    <div>
        <label htmlFor={id} className="block text-sm font-medium text-gray-600 mb-1 dark:text-zinc-300">{label}</label>
        {description && <p className="text-xs text-gray-500 mb-2 dark:text-zinc-400">{description}</p>}
        {children}
    </div>
);

// Moved outside the main component to prevent re-creation on re-renders.
const NavItem: React.FC<{
    tab: 'ai' | 'prompt' | 'other';
    label: string;
    isActive: boolean;
    onClick: () => void;
}> = ({ tab, label, isActive, onClick }) => {
    return (
         <button
            onClick={onClick}
            className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive ? 'bg-slate-200 text-gray-800 dark:bg-zinc-600 dark:text-zinc-100' : 'text-gray-600 hover:bg-slate-200/70 dark:text-zinc-300 dark:hover:bg-zinc-700/60'
            }`}
        >
            {label}
        </button>
    );
};

const ParameterSlider: React.FC<{
    label: string;
    description: string;
    value: number;
    onChange: (value: number) => void;
    min: number;
    max: number;
    step: number;
}> = ({ label, description, value, onChange, min, max, step }) => {
    const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onChange(parseFloat(e.target.value));
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const numValue = e.target.value === '' ? min : parseFloat(e.target.value);
        if (!isNaN(numValue)) {
            onChange(Math.max(min, Math.min(max, numValue)));
        }
    };
    
    return (
        <div>
            <div className="flex justify-between items-center">
                <label className="block text-sm font-medium text-gray-700 dark:text-zinc-200">{label}</label>
                <input
                    type="number"
                    value={value}
                    onBlur={handleInputChange} // Use onBlur to avoid issues while typing decimals
                    onChange={(e) => onChange(e.target.value as any)} // Allow temporary invalid states while typing
                    min={min}
                    max={max}
                    step={step}
                    className="w-24 px-2 py-1 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-500 focus:border-gray-500 dark:bg-zinc-700 dark:border-zinc-600 dark:text-white"
                />
            </div>
            <input
                type="range"
                value={value}
                onChange={handleSliderChange}
                min={min}
                max={max}
                step={step}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer mt-2 dark:bg-zinc-600"
            />
             <p className="text-xs text-gray-500 mt-1 dark:text-zinc-400">{description}</p>
        </div>
    );
};

const SettingsView: React.FC<SettingsViewProps> = ({ currentConfig, onSave, currentUISettings, onSaveUISettings }) => {
    const [config, setConfig] = useState<AIConfig>(currentConfig);
    const [uiSettings, setUISettings] = useState<UISettings>(currentUISettings);
    const [testResult, setTestResult] = useState<{ status: 'idle' | 'success' | 'error', message: string }>({ status: 'idle', message: '' });
    const [isTesting, setIsTesting] = useState<boolean>(false);
    const [modelList, setModelList] = useState<string[]>([]);
    const [activeTab, setActiveTab] = useState<'ai' | 'prompt' | 'other'>('ai');
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle');
    const [showModelParams, setShowModelParams] = useState(true);

    const activePrompt = config.prompts.find(p => p.id === config.activePromptId);

    useEffect(() => {
        // Sync local state if the prop from parent changes, e.g., after saving.
        setConfig(currentConfig);
    }, [currentConfig]);

    useEffect(() => {
        // Sync local state if the prop from parent changes
        setUISettings(currentUISettings);
    }, [currentUISettings]);


    const handleSave = () => {
        // Filter out any empty-named templates before saving
        const cleanedConfig = {
            ...config,
            prompts: config.prompts.filter(p => p.name.trim() !== '')
        };
        onSave(cleanedConfig);
        onSaveUISettings(uiSettings);
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
    };
    
    const handleTest = async () => {
        setIsTesting(true);
        setTestResult({ status: 'idle', message: '测试中...' });
        setModelList([]);

        try {
            if (config.provider === 'gemini') {
                if(!process.env.API_KEY || process.env.API_KEY.length < 30) throw new Error("无效的 Gemini API 密钥格式。请检查您的环境变量。");
                setTestResult({ status: 'success', message: '链接成功! Gemini 模型是固定的。' });
                setIsTesting(false);
                return;
            }

            const models = await fetchModels(config);
            
            if (models.length === 0) {
                setTestResult({ status: 'success', message: "成功连接，但未找到可用模型。" });
            } else {
                setModelList(models);
                if (!models.includes(config.model)) {
                    setConfig(prev => ({ ...prev, model: models[0] }));
                }
                setTestResult({ status: 'success', message: '链接成功! 已加载模型列表。' });
            }
        } catch (error) {
            setTestResult({ status: 'error', message: `测试失败: ${error instanceof Error ? error.message : '未知错误'}` });
        } finally {
            setIsTesting(false);
        }
    };

    const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newProvider = e.target.value as AIProvider;
        const defaults = PROVIDER_DEFAULTS[newProvider];
        
        setConfig(prev => ({
            ...prev,
            provider: newProvider,
            model: newProvider === 'gemini' ? 'gemini-2.5-flash' : '',
            assistantModel: newProvider === 'gemini' ? 'gemini-2.5-flash' : prev.assistantModel,
            endpoint: defaults.endpoint,
            apiKey: newProvider === 'ollama' || newProvider === 'gemini' ? '' : prev.apiKey,
        }));
        setTestResult({ status: 'idle', message: '' });
        setModelList([]);
    };

    const handleActivePromptChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
       setConfig(prev => ({ ...prev, activePromptId: e.target.value }));
    };

    const handlePromptFieldChange = (field: 'name' | 'content', value: string) => {
        setConfig(prev => ({
            ...prev,
            prompts: prev.prompts.map(p =>
                p.id === prev.activePromptId ? { ...p, [field]: value } : p
            )
        }));
    };

    const handleCreateNewPrompt = () => {
        const newPrompt: PromptTemplate = {
            id: `custom-${Date.now()}`,
            name: '未命名模板',
            content: '',
        };

        setConfig(prev => ({
            ...prev,
            prompts: [...prev.prompts, newPrompt],
            activePromptId: newPrompt.id,
        }));
    };

    const handleDeletePrompt = () => {
        const promptToDeleteId = config.activePromptId;
        const promptToDelete = config.prompts.find(p => p.id === promptToDeleteId);

        if (!promptToDelete || promptToDelete.id.startsWith('default-')) {
            alert("不能删除默认的提示词模板。");
            return;
        }
    
        if (window.confirm(`您确定要删除模板 “${promptToDelete.name}” 吗？此操作将在点击“保存设置”后生效。`)) {
            setConfig(prev => {
                const updatedPrompts = prev.prompts.filter(p => p.id !== promptToDeleteId);
                return {
                    ...prev,
                    prompts: updatedPrompts,
                    activePromptId: 'default-snowflake', // Always switch back to default
                };
            });
        }
    };

    return (
        <div className="w-full max-w-5xl mx-auto h-full flex flex-col">
            <header className="mb-8 flex-shrink-0">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-zinc-100">设置</h1>
            </header>
            <div className="flex flex-col md:flex-row gap-8 lg:gap-12 flex-grow min-h-0">
                <aside className="w-full md:w-48 flex-shrink-0">
                    <nav className="space-y-1">
                        <NavItem
                            tab="ai"
                            label="AI 模型设置"
                            isActive={activeTab === 'ai'}
                            onClick={() => setActiveTab('ai')}
                        />
                        <NavItem
                            tab="prompt"
                            label="提示词"
                            isActive={activeTab === 'prompt'}
                            onClick={() => setActiveTab('prompt')}
                        />
                        <NavItem
                            tab="other"
                            label="其他"
                            isActive={activeTab === 'other'}
                            onClick={() => setActiveTab('other')}
                        />
                    </nav>
                </aside>
                <main className="flex-1 min-w-0 overflow-y-auto custom-scrollbar -mr-4 pr-4">
                    <div className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm dark:bg-zinc-800 dark:border-zinc-700">
                        {activeTab === 'ai' && (
                             <div className="space-y-6">
                                <InputField label="模型提供商" id="provider">
                                    <select
                                        id="provider"
                                        value={config.provider}
                                        onChange={handleProviderChange}
                                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-500 focus:border-gray-500 dark:bg-zinc-700 dark:border-zinc-600 dark:text-white"
                                    >
                                        <option value="gemini">Google Gemini</option>
                                        <option value="openai">OpenAI</option>
                                        <option value="deepseek">DeepSeek</option>
                                        <option value="openrouter">OpenRouter</option>
                                        <option value="siliconflow">SiliconFlow</option>
                                        <option value="modelscope">ModelScope 魔搭</option>
                                        <option value="ollama">Ollama (本地)</option>
                                        <option value="custom">自定义 (OpenAI 兼容)</option>
                                    </select>
                                </InputField>
                                
                                {/*// FIX: Hide API key field for Gemini as per guidelines.*/}
                                {config.provider !== 'ollama' && config.provider !== 'gemini' && (
                                    <InputField label="API 密钥" id="apiKey">
                                        <input
                                            id="apiKey"
                                            type="password"
                                            value={config.apiKey}
                                            onChange={(e) => setConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-500 focus:border-gray-500 dark:bg-zinc-700 dark:border-zinc-600 dark:text-white"
                                            placeholder="输入您的 API 密钥"
                                        />
                                    </InputField>
                                )}
                                
                                {config.provider !== 'gemini' && (
                                    <>
                                        <InputField label="Endpoint URL" id="endpoint">
                                            <input
                                                id="endpoint"
                                                type="text"
                                                value={config.endpoint}
                                                onChange={(e) => setConfig(prev => ({ ...prev, endpoint: e.target.value }))}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-500 focus:border-gray-500 dark:bg-zinc-700 dark:border-zinc-600 dark:text-white"
                                                placeholder="服务地址将根据提供商自动填充"
                                            />
                                        </InputField>
                                        <InputField label="模型名称" id="model">
                                        {modelList.length > 0 ? (
                                                <select
                                                    id="model"
                                                    value={config.model}
                                                    onChange={(e) => setConfig(prev => ({ ...prev, model: e.target.value }))}
                                                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-500 focus:border-gray-500 dark:bg-zinc-700 dark:border-zinc-600 dark:text-white"
                                                >
                                                    {modelList.map(modelName => (
                                                        <option key={modelName} value={modelName}>
                                                            {modelName}
                                                        </option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <input
                                                    id="model"
                                                    type="text"
                                                    value={config.model}
                                                    onChange={(e) => setConfig(prev => ({ ...prev, model: e.target.value }))}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-500 focus:border-gray-500 dark:bg-zinc-700 dark:border-zinc-600 dark:text-white"
                                                    placeholder={PROVIDER_DEFAULTS[config.provider]?.modelPlaceholder || "点击“测试链接”以加载模型"}
                                                    disabled={isTesting}
                                                />
                                            )}
                                        </InputField>
                                    </>
                                )}
                                
                                <div className="pt-4 flex items-center gap-4">
                                    <button
                                        onClick={handleTest}
                                        disabled={isTesting}
                                        className="bg-gray-200 text-gray-700 font-semibold py-2 px-4 rounded-lg shadow-sm transition-colors hover:bg-gray-300 disabled:opacity-50 disabled:cursor-wait dark:bg-zinc-600 dark:text-zinc-100 dark:hover:bg-zinc-500"
                                    >
                                        {isTesting ? '测试中...' : '测试链接'}
                                    </button>
                                    {testResult.message && (
                                        <p className={`text-sm ${testResult.status === 'success' ? 'text-green-600 dark:text-green-400' : testResult.status === 'error' ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-zinc-300'}`}>
                                            {testResult.message}
                                        </p>
                                    )}
                                </div>
                                <InputField label="流式输出" id="streaming" description="逐步显示 AI 的响应，而不是等待全部完成后再显示。可能会加快感知速度。">
                                    <div className="flex items-center">
                                        <label htmlFor="streaming-toggle" className="flex items-center cursor-pointer">
                                            <div className="relative">
                                                <input
                                                    type="checkbox"
                                                    id="streaming-toggle"
                                                    className="sr-only"
                                                    checked={config.streaming || false}
                                                    onChange={(e) => setConfig(prev => ({ ...prev, streaming: e.target.checked }))}
                                                />
                                                <div className={`block w-10 h-6 rounded-full transition-all ${config.streaming ? 'bg-blue-500' : 'bg-gray-200 dark:bg-zinc-600'}`}></div>
                                                <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${config.streaming ? 'translate-x-4' : ''}`}></div>
                                            </div>
                                            <div className="ml-3 text-gray-700 dark:text-zinc-300 text-sm">
                                                {config.streaming ? '已开启' : '已关闭'}
                                            </div>
                                        </label>
                                    </div>
                                </InputField>


                                <div className="pt-6 mt-2 border-t border-gray-200/80 dark:border-zinc-600/80">
                                    <button
                                        className="w-full flex justify-between items-center text-left py-2"
                                        onClick={() => setShowModelParams(prev => !prev)}
                                        aria-expanded={showModelParams}
                                    >
                                        <h2 className="text-xl font-semibold text-gray-800 dark:text-zinc-100">模型参数设置</h2>
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${showModelParams ? 'rotate-180' : ''}`}>
                                          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                                        </svg>
                                    </button>
                                    {showModelParams && (
                                        <div className="mt-4 space-y-6 animate-fade-in">
                                            <ParameterSlider
                                                label="Temperature (创造性)"
                                                description="控制输出的随机性，0为最保守，2为最创造性"
                                                value={config.temperature}
                                                onChange={(v) => setConfig(prev => ({ ...prev, temperature: v }))}
                                                min={0} max={2} step={0.1}
                                            />
                                            <ParameterSlider
                                                label="Max Tokens (最大输出长度)"
                                                description="限制模型单次生成的最大字符数"
                                                value={config.maxTokens}
                                                onChange={(v) => setConfig(prev => ({ ...prev, maxTokens: v }))}
                                                min={1} max={16384} step={1}
                                            />
                                            <ParameterSlider
                                                label="Top P (核采样)"
                                                description="控制词汇选择的多样性，建议与temperature二选一调节"
                                                value={config.topP}
                                                onChange={(v) => setConfig(prev => ({ ...prev, topP: v }))}
                                                min={0} max={1} step={0.05}
                                            />
                                            <ParameterSlider
                                                label="Frequency Penalty (频率惩罚)"
                                                description="减少重复内容的出现，0为不惩罚，2为最大惩罚"
                                                value={config.frequencyPenalty}
                                                onChange={(v) => setConfig(prev => ({ ...prev, frequencyPenalty: v }))}
                                                min={-2} max={2} step={0.1}
                                            />
                                            <ParameterSlider
                                                label="Presence Penalty (存在惩罚)"
                                                description="鼓励谈论新话题，0为不惩罚，2为最大惩罚"
                                                value={config.presencePenalty}
                                                onChange={(v) => setConfig(prev => ({ ...prev, presencePenalty: v }))}
                                                min={-2} max={2} step={0.1}
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                         {activeTab === 'prompt' && (
                            <div className="space-y-6">
                                <div>
                                    <div className="flex justify-between items-center mb-1">
                                      <label htmlFor="prompt-template" className="block text-sm font-medium text-gray-600 dark:text-zinc-300">提示词模板</label>
                                       <button onClick={handleCreateNewPrompt} className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors dark:text-zinc-300 dark:hover:text-white">+ 新建模板</button>
                                    </div>
                                    <p className="text-xs text-gray-500 mb-2 dark:text-zinc-400">选择或创建一个模板，用于定义 AI 生成故事大纲时遵循的核心指令。</p>
                                    <select
                                        id="prompt-template"
                                        value={activePrompt?.id || ''}
                                        onChange={handleActivePromptChange}
                                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-500 focus:border-gray-500 dark:bg-zinc-700 dark:border-zinc-600 dark:text-white"
                                    >
                                        {config.prompts.map(p => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                    </select>
                                </div>
                                {activePrompt && (
                                    <div className="space-y-4 pt-6 border-t border-gray-200/80 dark:border-zinc-600/80">
                                         <InputField label="模板名称" id="prompt-name">
                                            <div className="flex items-center gap-2">
                                                <input
                                                    id="prompt-name"
                                                    type="text"
                                                    value={activePrompt.name}
                                                    onChange={(e) => handlePromptFieldChange('name', e.target.value)}
                                                    disabled={activePrompt.id.startsWith('default-')}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-500 focus:border-gray-500 disabled:bg-gray-100 disabled:cursor-not-allowed dark:bg-zinc-700 dark:border-zinc-600 dark:text-white dark:disabled:bg-zinc-800"
                                                    placeholder="为你的模板命名"
                                                />
                                                {!activePrompt.id.startsWith('default-') && (
                                                    <button 
                                                        onClick={handleDeletePrompt}
                                                        className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-100 rounded-md transition-colors flex-shrink-0 dark:text-zinc-400 dark:hover:text-red-500 dark:hover:bg-red-900/50"
                                                        aria-label="删除模板"
                                                        title="删除此模板"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.134-2.033-2.134H8.71c-1.123 0-2.033.954-2.033 2.134v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                                                        </svg>
                                                    </button>
                                                )}
                                            </div>
                                        </InputField>
                                        <InputField 
                                            label="模板内容" 
                                            id="prompt-content"
                                        >
                                            <textarea
                                                id="prompt-content"
                                                rows={16}
                                                value={activePrompt.content}
                                                onChange={(e) => handlePromptFieldChange('content', e.target.value)}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-500 focus:border-gray-500 font-mono text-sm leading-relaxed custom-scrollbar dark:bg-zinc-700 dark:border-zinc-600 dark:text-zinc-200"
                                                placeholder="输入你的提示词..."
                                            />
                                        </InputField>
                                    </div>
                                )}
                            </div>
                        )}
                        {activeTab === 'other' && (
                            <div className="space-y-6">
                                <h2 className="text-xl font-semibold text-gray-800 dark:text-zinc-100">界面与编辑器设置</h2>
                                <InputField label="主题切换" id="theme-switcher">
                                    <div className="flex gap-2 rounded-lg bg-gray-100 dark:bg-zinc-700 p-1">
                                        <button
                                            onClick={() => setUISettings(s => ({ ...s, theme: 'light' }))}
                                            className={`w-full py-1.5 rounded-md text-sm font-medium transition-colors ${
                                                uiSettings.theme === 'light' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-600 dark:text-zinc-300'
                                            }`}
                                        >
                                            明亮
                                        </button>
                                        <button
                                            onClick={() => setUISettings(s => ({ ...s, theme: 'dark' }))}
                                            className={`w-full py-1.5 rounded-md text-sm font-medium transition-colors ${
                                                uiSettings.theme === 'dark' ? 'bg-zinc-900 text-white shadow-sm' : 'text-gray-600 dark:text-zinc-300'
                                            }`}
                                        >
                                            黑暗
                                        </button>
                                    </div>
                                </InputField>
                                <InputField label="卡片样式切换" id="card-style-switcher">
                                    <div className="flex gap-2 rounded-lg bg-gray-100 dark:bg-zinc-700 p-1">
                                        <button
                                            onClick={() => setUISettings(s => ({ ...s, cardStyle: 'grid' }))}
                                            className={`w-full py-1.5 rounded-md text-sm font-medium transition-colors ${
                                                uiSettings.cardStyle === 'grid' ? 'bg-white text-gray-800 shadow-sm dark:bg-zinc-900 dark:text-white' : 'text-gray-600 dark:text-zinc-300'
                                            }`}
                                        >
                                            网格
                                        </button>
                                        <button
                                            onClick={() => setUISettings(s => ({ ...s, cardStyle: 'carousel' }))}
                                            className={`w-full py-1.5 rounded-md text-sm font-medium transition-colors ${
                                                uiSettings.cardStyle === 'carousel' ? 'bg-white text-gray-800 shadow-sm dark:bg-zinc-900 dark:text-white' : 'text-gray-600 dark:text-zinc-300'
                                            }`}
                                        >
                                            轮播
                                        </button>
                                    </div>
                                </InputField>
                                <InputField label="编辑器字体" id="editor-font-family">
                                    <select
                                        id="editor-font-family"
                                        value={uiSettings.editorFontFamily}
                                        onChange={(e) => setUISettings(s => ({...s, editorFontFamily: e.target.value as UISettings['editorFontFamily']}))}
                                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-500 focus:border-gray-500 dark:bg-zinc-700 dark:border-zinc-600 dark:text-white"
                                    >
                                        <option value="sans-serif">无衬线 (默认)</option>
                                        <option value="serif">衬线体</option>
                                        <option value="monospace">等宽字体</option>
                                    </select>
                                </InputField>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300">编辑器字号</label>
                                    <div className="flex items-center gap-4 mt-2">
                                        <input
                                            type="range"
                                            value={uiSettings.editorFontSize}
                                            onChange={(e) => setUISettings(s => ({...s, editorFontSize: parseInt(e.target.value, 10)}))}
                                            min={12} max={24} step={1}
                                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-zinc-600"
                                        />
                                        <span className="font-mono text-sm text-gray-600 dark:text-zinc-400 w-12 text-center">{uiSettings.editorFontSize}px</span>
                                    </div>
                                </div>
                            </div>
                        )}
                         <div className="pt-6 mt-6 border-t border-gray-200 dark:border-zinc-700 flex justify-end">
                             <button
                                onClick={handleSave}
                                disabled={saveStatus === 'saved'}
                                className={`font-semibold py-2 px-6 rounded-lg shadow-sm transition-all w-32 text-center ${
                                    saveStatus === 'saved'
                                        ? 'bg-green-600 text-white cursor-default'
                                        : 'bg-gray-800 text-white hover:bg-gray-900 dark:bg-slate-100 dark:text-gray-800 dark:hover:bg-slate-200'
                                }`}
                            >
                                {saveStatus === 'saved' ? '✓ 已保存' : '保存设置'}
                            </button>
                        </div>
                    </div>
                </main>
            </div>
            <style>{`
                @keyframes fade-in {
                    from { opacity: 0; transform: translateY(-10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in {
                    animation: fade-in 0.3s ease-out forwards;
                }
            `}</style>
        </div>
    );
};

export default SettingsView;