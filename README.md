# AI 故事创作 (AI Story Weaver)

AI 故事创作是一款创新的 AI 辅助写作工具，旨在帮助作家突破创作瓶颈、构建引人入胜的故事框架。通过将核心故事元素进行独特的卡牌式组合，并利用可高度自定义的 AI 提示词，本工具能将您零散的灵感火花，转化为一份详实、结构完整的小说大纲。

## 核心功能

-   **直观的卡牌系统 (Intuitive Card System)**:
    通过拖拽或点选【主题】、【类型】、【角色】、【情节】、【叙事手法】和【结局】六大类卡牌，直观地构建故事的核心概念。卡片库持续扩充，现已包含“牺牲”主题与“武侠”类型等经典元素。不确定如何开始？试试【抽卡】功能，让随机组合激发你的无限想象。

-   **灵感激发库 (Inspiration Library)**:
    内置一个包含40个独特世界观设定的灵感库，涵盖奇幻、科幻、都市怪谈等多种类别。您可以随时浏览这些创意，将其作为可选的“灵感卡牌”融入您的故事组合中，为 AI 提供创作氛围和世界观的指引。更棒的是，您可以随时添加并保存自己的灵感，打造个性化的创意宝库。

-   **情境感知 AI 生成 (Context-Aware AI Generation)**:
    AI 不仅会基于您选择的卡牌组合进行创作，还会将您在【小说信息】中输入的名称、预估字数和一句话概要作为上下文，生成与您构思更贴合的专属故事大纲。

-   **高级提示词工程 (Advanced Prompt Engineering)**:
    内置强大的提示词模板管理器。您可以修改默认的“雪花写作法”模板，或创建并保存多个完全自定义的提示词模板，轻松切换不同的 AI 指令，探索多样的故事风格和结构。

-   **广泛的 AI 服务支持 (Broad AI Provider Support)**:
    具备高度灵活性，支持多种主流及自定义 AI 模型服务商，包括 Google Gemini, OpenAI, DeepSeek, OpenRouter, SiliconFlow，以及用于本地部署的 Ollama，让您自由选择最适合的 AI 大脑。

-   **智能模型发现 (Smart Model Discovery)**:
    告别繁琐的模型名称记忆。在 API 设置中，只需点击“测试链接”，系统即可自动获取并以列表形式展示所有可用的模型，供您一键选择。

-   **AI 润色与编辑 (AI Polishing & Editing)**:
    在生成大纲后，您可以在【大纲内容】页面唤出 AI 助理。通过对话式指令（例如：“把第一幕写得更紧张一些”），让 AI 帮你实时修改和完善大纲内容，实现人机协作的无缝编辑体验。

-   **精简的大纲编辑器 (Streamlined Outline Editor)**:
    我们移除了复杂的工具栏，为您提供一个沉浸、无干扰的 Markdown 编辑环境。您可以随时【预览】格式效果，【保存】内容至浏览器，或将最终稿【导出】为标准的 Markdown 文件。

-   **交互式工作空间 (Interactive Workspace)**:
    写作界面采用多面板设计，将小说设定、故事组合与卡片库清晰分离，让创作流程井然有序。丝滑的拖拽体验让卡牌选择一触即达。

## 项目结构

```
.
├── index.html              # 应用的入口 HTML 文件，包含了全局样式和脚本引入。
├── index.tsx               # React 应用的入口文件，负责渲染 App 组件。
├── App.tsx                 # 主应用组件，管理全局状态（如视图、配置、卡牌选择等）。
├── types.ts                # 定义了项目中所有的 TypeScript 类型和接口。
├── constants.tsx           # 存放应用的常量，如默认卡牌数据、卡牌类型等。
├── prompts.ts              # 存放默认的 AI 提示词模板。
├── inspirationConstants.ts # 存放默认的灵感卡牌数据。
├── services/
│   └── aiService.ts        # 封装了所有与 AI 服务交互的逻辑，包括调用不同模型提供商的 API。
├── components/
│   ├── Sidebar.tsx         # 左侧导航栏组件。
│   ├── WriterView.tsx      # “卡牌写作” 视图，核心的创作和卡牌组合界面。
│   ├── ResultView.tsx      # “大纲内容” 视图，包含 Markdown 编辑器和 AI 助理。
│   ├── InspirationView.tsx # “灵感集” 视图，展示和管理灵感卡牌。
│   ├── SettingsView.tsx    # “设置” 视图，用于配置 AI 服务和提示词。
│   ├── CardComponent.tsx   # 单个卡片的 UI 组件。
│   ├── CardSlot.tsx        # 用于放置卡牌的插槽组件。
│   ├── CreateCardModal.tsx # 创建/编辑自定义卡片的模态框。
│   ├── Spinner.tsx         # 加载状态的旋转图标。
│   └── icons.tsx           # 存放所有 SVG 图标组件。
└── README.md               # 项目说明文件。
```

### 文件关联说明

-   `index.html` 是所有内容的载体，它通过 `<script type="module" src="/index.tsx"></script>` 加载整个 React 应用。
-   `index.tsx` 将 `App` 组件挂载到 `index.html` 中的 `<div id="root">` 元素上。
-   `App.tsx` 是应用的核心，它管理着几乎所有的状态（`useState`），并通过 props 将状态和状态更新函数传递给各个子视图 (`WriterView`, `ResultView` 等)。
-   `Sidebar.tsx` 控制 `App.tsx` 中的 `view` 状态，从而实现不同视图之间的切换。
-   每个视图组件 (`*View.tsx`) 负责一个独立页面的功能和布局。
-   `components/` 目录下的其他组件是可复用的 UI 元素，被各个视图所使用。
-   `services/aiService.ts` 被 `WriterView` (用于生成大纲) 和 `ResultView` (用于润色大纲) 调用，以处理与后端 AI 模型的通信。
-   `types.ts`, `constants.ts`, `prompts.ts`, `inspirationConstants.ts` 为整个应用提供了数据结构定义和初始数据。

## 本地开发

您需要在本地环境中安装 [Node.js](https://nodejs.org/) (建议版本 >= 16) 和 npm。

1.  **安装依赖**
    在项目根目录下，运行以下命令来安装项目所需的依赖包：
    ```bash
    npm install
    ```

2.  **启动开发服务器**
    运行以下命令来启动本地开发服务器：
    ```bash
    npm start
    ```
    这通常会启动一个服务在 `http://localhost:3000`。在浏览器中打开该地址即可查看应用。应用支持热重载，您对代码的任何修改都会自动刷新页面。

## 部署

本项目是一个纯前端的静态应用，可以被部署在任何支持静态文件托管的平台上 (如 Vercel, Netlify, GitHub Pages, 或您自己的服务器)。

1.  **构建应用**
    在项目根目录下，运行构建命令：
    ```bash
    npm run build
    ```
    该命令会生成一个 `dist` 文件夹，其中包含了所有经过优化的静态资源文件 (HTML, CSS, JavaScript)。

2.  **部署静态文件**
    将 `dist` 文件夹中的所有内容上传到您的静态托管服务商即可。

    **示例：使用 Vercel 部署**
    -   将您的项目推送到 GitHub/GitLab/Bitbucket 仓库。
    -   在 [Vercel](https://vercel.com/) 上创建一个新项目，并连接到您的代码仓库。
    -   Vercel 会自动识别这是一个前端项目。在项目设置中，确认以下配置：
        -   **Build Command**: `npm run build`
        -   **Output Directory**: `dist`
        -   **Install Command**: `npm install`
    -   点击 "Deploy"，Vercel 将会自动构建并部署您的应用。