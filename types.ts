

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
  [key in CardType]?: (Card | null)[];
};

export type AIProvider = 'gemini' | 'openai' | 'deepseek' | 'openrouter' | 'siliconflow' | 'ollama' | 'custom' | 'modelscope';

export interface NovelInfo {
  name: string;
  wordCount: string;
  synopsis: string;
  perspective?: string;
  channel?: 'male' | 'female' | '';
  emotion?: string;
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
  cardStyle: 'grid' | 'carousel';
}

export interface ChatMessage {
    id: string;
    role: 'user' | 'model' | 'system';
    content: string;
    images?: string[]; // array of base64 encoded image data
};

export interface StoryArchiveItem {
  id: string;
  novelInfo: NovelInfo;
  outline: string;
  lastModified: number;
}

export interface SavedCombination {
  id: string;
  name: string;
  selectedCardIds: {[key in CardType]?: (string | null)[] };
}

export interface Topic {
  id: string;
  name: string;
  lastModified: number;
  history: ChatMessage[];
  toolId?: string;
  selectedArchiveId?: string | null;
}