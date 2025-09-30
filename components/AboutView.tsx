
import React from 'react';

const AboutView: React.FC = () => {
    return (
        <div className="w-full max-w-3xl mx-auto">
            <header className="mb-8">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-zinc-100">关于</h1>
            </header>
            <div className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm dark:bg-zinc-800 dark:border-zinc-700">
                <div className="space-y-4 text-gray-700 dark:text-zinc-300">
                    <h2 className="text-xl font-semibold text-gray-800 dark:text-zinc-100">关于 AI 故事创作</h2>
                    <p className="text-sm leading-relaxed">
                        AI 故事创作是一款创新的 AI 辅助写作工具，旨在帮助作家突破创作瓶颈、构建引人入胜的故事框架。通过将核心故事元素进行独特的卡牌式组合，并利用可高度自定义的 AI 提示词，本工具能将您零散的灵感火花，转化为一份详实、结构完整的小说大纲。
                    </p>
                    <div className="pt-2">
                        <h3 className="font-semibold mb-2">核心功能包括:</h3>
                        <ul className="list-disc list-inside space-y-1 text-sm">
                            <li>直观的卡牌系统与灵感激发库</li>
                            <li>情境感知 AI 生成与高级提示词工程</li>
                            <li>广泛的 AI 服务支持与智能模型发现</li>
                            <li>AI 润色与编辑功能</li>
                            <li>精简的大纲编辑器与交互式工作空间</li>
                        </ul>
                    </div>
                    <div className="pt-4 text-center">
                        <p className="text-xs text-gray-500 dark:text-zinc-400">版本: 1.1.0</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AboutView;
