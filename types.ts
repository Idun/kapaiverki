

import type { ReactElement, SVGProps } from 'react';

export enum CardType {
  Theme = 'Theme',
  Genre = 'Genre',
  Character = 'Character',
  Plot = 'Plot',
  Structure = 'Structure',
  Technique = 'Technique',
  Ending = 'Ending',
  Inspiration = 'Inspiration',
}

export interface Card {
  id: string;
  type: CardType;
  name: string;
  description: string;
  tooltipText: string;
  // FIX: Use ReactElement instead of JSX.Element to avoid namespace error
  // FIX: Specify props for ReactElement to allow cloning with className.
  icon: ReactElement<SVGProps<SVGSVGElement>>;
  isCustom?: boolean;
}

export type CombinedCards = {
  [key in CardType]?: Card | null;
};

export type AIProvider = 'gemini' | 'openai' | 'deepseek' | 'openrouter' | 'siliconflow' | 'ollama' | 'custom';

export interface NovelInfo {
  name: string;
  wordCount: string;
  synopsis: string;
  perspective?: string;
}

export interface PromptTemplate {
  id: string;
  name:string;
  content: string;
}

export interface AIConfig {
    provider: AIProvider;
    apiKey: string;
    endpoint: string;
    model: string;
    assistantModel?: string;
    prompts: PromptTemplate[];
    activePromptId: string;
    temperature: number;
    maxTokens: number;
    topP: number;
    frequencyPenalty: number;
    presencePenalty: number;
    streaming?: boolean;
}

export interface InspirationItem {
    id: number;
    title: string;
    description: string;
    isCustom?: boolean;
}

export interface InspirationCategory {
    id: string;
    title: string;
    items: InspirationItem[];
}

export interface UISettings {
  theme: 'light' | 'dark';
  editorFontFamily: 'sans-serif' | 'serif' | 'monospace';
  editorFontSize: number;
}

export interface ChatMessage {
    role: 'user' | 'model' | 'system';
    content: string;
    image?: string; // base64 encoded image data
};

export interface StoryArchiveItem {
  id: string;
  novelInfo: NovelInfo;
  outline: string;
  lastModified: number;
}
