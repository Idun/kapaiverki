import { GoogleGenAI } from "@google/genai";
import type { CombinedCards, AIConfig, AIProvider, Card, NovelInfo, ChatMessage } from '../types';
import { CardType } from '../types';
import { CARD_TYPE_NAMES } from '../constants';

interface OpenAIModel {
  id: string;
}

interface OllamaModel {
  name: string;
}

const createPrompt = (cards: CombinedCards, customPrompt: string, novelInfo: NovelInfo): string => {
    
    const formatCards = (cardType: CardType): string => {
        const cardArray = cards[cardType];
        if (!cardArray || cardArray.every(c => c === null)) return '';
        
        const validCards = cardArray.filter((c): c is Card => c !== null);
        if (validCards.length === 0) return '';
        
        // Special prompt for Character archetype
        if (cardType === CardType.Character) {
            const names = validCards.map(c => `「${c.name}」`).join('和');
            const descs = validCards.map(c => `(${c.description})`).join('; ');
            return `- 角色创作指导 (Character Archetype Guide): 这是创作角色的核心概念，请基于${names}${descs}的特质，设计一个或多个独特的、有血有肉的角色。请注意，这只是一个创作指引，严禁在故事中直接使用原型名称作为角色的名字或身份。`;
        }
        
        const cardStrings = validCards.map(c => `${c.name} (${c.description})`);
        const title = CARD_TYPE_NAMES[cardType];
        return `- ${title}: ${cardStrings.join(' | ')}`;
    };

    const promptParts = [
        formatCards(CardType.Theme),
        formatCards(CardType.Genre),
        formatCards(CardType.Character),
        formatCards(CardType.Plot),
        formatCards(CardType.Structure),
        formatCards(CardType.Technique),
        formatCards(CardType.Ending),
        formatCards(CardType.Inspiration),
    ].filter(Boolean); // Filter out empty strings
    

    const novelInfoParts = [];
    if (novelInfo.name) novelInfoParts.push(`- 小说名称: ${novelInfo.name}`);
    if (novelInfo.channel) novelInfoParts.push(`- 书籍频道: ${novelInfo.channel === 'male' ? '男频' : '女频'}`);
    if (novelInfo.emotion && novelInfo.emotion !== '无') novelInfoParts.push(`- 核心情绪: ${novelInfo.emotion}`);
    if (novelInfo.wordCount) novelInfoParts.push(`- 预估字数: ${novelInfo.wordCount}`);
    if (novelInfo.perspective) novelInfoParts.push(`- 叙事视角: ${novelInfo.perspective}`);
    if (novelInfo.synopsis) novelInfoParts.push(`- 一句话概要: ${novelInfo.synopsis}`);
    
    const novelInfoSection = novelInfoParts.length > 0 ? `
请同时参考以下小说基本信息：
${novelInfoParts.join('\n')}` : '';

    return `
${customPrompt}
${novelInfoSection}

请基于以下故事核心要素进行创作：
${promptParts.join('\n')}
`;
}


async function* generateWithGemini(promptOrMessages: string | ChatMessage[], config: AIConfig, signal?: AbortSignal): AsyncGenerator<string> {
    const apiKey = config.apiKey || process.env.API_KEY;
    if (!apiKey) {
        throw new Error("Gemini API 密钥未配置。请在“设置”页面中提供您的密钥。");
    }
    const ai = new GoogleGenAI({ apiKey });
    
    if (!config.model) {
        throw new Error("Gemini model name is not configured.");
    }
    const modelName = config.model;

    const generationConfig: { 
        temperature?: number; 
        topP?: number; 
        maxOutputTokens?: number;
        thinkingConfig?: { thinkingBudget: number };
    } = {};
    if (config.temperature !== undefined) generationConfig.temperature = config.temperature;
    if (config.topP !== undefined) generationConfig.topP = config.topP;
    if (config.maxTokens !== undefined) {
        generationConfig.maxOutputTokens = config.maxTokens;
        generationConfig.thinkingConfig = { thinkingBudget: Math.floor(config.maxTokens / 4) };
    }


    const messages = typeof promptOrMessages === 'string'
        ? [{ role: 'user', content: promptOrMessages }]
        : promptOrMessages;

    const contents = messages.map(msg => {
        const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
        if (msg.content) {
            parts.push({ text: msg.content });
        }

        if (msg.images) {
            msg.images.forEach(imgData => {
                const mimeType = imgData.startsWith('/9j/') ? 'image/jpeg' : 'image/png';
                parts.push({
                    inlineData: {
                        mimeType,
                        data: imgData,
                    }
                });
            });
        }
        
        return {
            role: msg.role === 'model' ? 'model' : 'user',
            parts: parts,
        };
    });

    if (config.streaming) {
        const response = await ai.models.generateContentStream({
            model: modelName,
            contents: contents as any,
            config: generationConfig,
        });
        for await (const chunk of response) {
            if (signal?.aborted) throw new DOMException('Aborted by user', 'AbortError');
            const chunkText = chunk.text;
            if (chunkText) {
                yield chunkText;
            }
        }
    } else {
        if (signal?.aborted) throw new DOMException('Aborted by user', 'AbortError');
        const response = await ai.models.generateContent({
            model: modelName,
            contents: contents as any,
            config: generationConfig,
        });
        if (signal?.aborted) throw new DOMException('Aborted by user', 'AbortError');
        if (!response.text) {
            throw new Error("API returned an empty response.");
        }
        yield response.text.trim();
    }
}

const getEndpoint = (url: string, path: 'chat' | 'models'): string => {
    const trimmedUrl = url.trim().replace(/\/+$/, '');
    const finalPath = path === 'chat' ? '/v1/chat/completions' : '/v1/models';
    
    if (trimmedUrl.endsWith('/v1')) {
        return `${trimmedUrl}/${path === 'chat' ? 'chat/completions' : 'models'}`;
    }
    if (trimmedUrl.includes('/api/v1')) {
        return `${trimmedUrl}/${path === 'chat' ? 'chat/completions' : 'models'}`;
    }
    if (trimmedUrl.endsWith(finalPath)) {
        return trimmedUrl;
    }
    return `${trimmedUrl}${finalPath}`;
};


async function* generateWithOpenAICompatible(promptOrMessages: string | ChatMessage[], config: AIConfig, signal?: AbortSignal): AsyncGenerator<string> {
    const providersThatNeedKey: AIProvider[] = ['openai', 'deepseek', 'openrouter', 'siliconflow', 'modelscope'];
    if (providersThatNeedKey.includes(config.provider) && !config.apiKey) {
        throw new Error(`API key is required for the ${config.provider} provider.`);
    }
    if (!config.endpoint) throw new Error("Endpoint URL is missing.");
    if (!config.model) throw new Error("Model name is missing.");

    const endpoint = getEndpoint(config.endpoint, 'chat');
    
    const headers: HeadersInit = { 'Content-Type': 'application/json' };

    if (config.apiKey) {
        headers['Authorization'] = `Bearer ${config.apiKey}`;
    }
    
    const body: Record<string, any> = {
        model: config.model,
    };
    
    const messages = typeof promptOrMessages === 'string' 
        ? [{ role: 'user', content: promptOrMessages }]
        : promptOrMessages;
        
    const preparedMessages = messages.map(msg => {
        const role = msg.role === 'model' ? 'assistant' : msg.role;

        if (!msg.images || msg.images.length === 0) {
            return { role, content: msg.content };
        }

        const contentParts: any[] = [{ type: 'text', text: msg.content }];
        
        msg.images.forEach(imgData => {
            const mimeType = imgData.startsWith('/9j/') ? 'image/jpeg' : 'image/png';
            contentParts.push({
                type: 'image_url',
                image_url: { url: `data:${mimeType};base64,${imgData}` }
            });
        });

        return { role, content: contentParts };
    });
    body.messages = preparedMessages;

    if (config.temperature !== undefined) body.temperature = config.temperature;
    if (config.maxTokens !== undefined) body.max_tokens = config.maxTokens;
    if (config.topP !== undefined) body.top_p = config.topP;
    
    if (config.provider !== 'modelscope') {
        if (config.frequencyPenalty !== undefined) body.frequency_penalty = config.frequencyPenalty;
        if (config.presencePenalty !== undefined) body.presence_penalty = config.presencePenalty;
    }


    if (config.streaming) {
        body.stream = true;
        const response = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(body), signal });
        if (!response.ok || !response.body) {
             let errorData;
            try {
                errorData = await response.json();
            } catch(e) {
                throw new Error(`API error (${response.status}): ${response.statusText}`);
            }
            throw new Error(`API error (${response.status}): ${errorData.error?.message || 'Unknown error'}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            if (signal?.aborted) {
                await reader.cancel();
                throw new DOMException('Aborted by user', 'AbortError');
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const dataStr = line.substring(6);
                    if (dataStr.trim() === '[DONE]') return;
                    try {
                        const data = JSON.parse(dataStr);
                        const content = data.choices?.[0]?.delta?.content;
                        if (content) {
                            yield content;
                        }
                    } catch (e) {
                        // Ignore JSON parse errors, might be partial data
                    }
                }
            }
        }
    } else {
        const response = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(body), signal });
        if (!response.ok) {
            let errorData;
            try {
                errorData = await response.json();
            } catch(e) {
                throw new Error(`API error (${response.status}): ${response.statusText}`);
            }
            throw new Error(`API error (${response.status}): ${errorData.error?.message || 'Unknown error'}`);
        }
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;

        if (!content) {
            throw new Error("API returned an invalid response structure.");
        }
        yield content.trim();
    }
}


export async function* generateOutline(cards: CombinedCards, config: AIConfig, novelInfo: NovelInfo): AsyncGenerator<string> {
    const activePrompt = config.prompts.find(p => p.id === config.activePromptId) || config.prompts[0];
    if (!activePrompt) {
        throw new Error("No active prompt template found. Please check your settings.");
    }

    const prompt = createPrompt(cards, activePrompt.content, novelInfo);
    const openAICompatibleProviders: AIProvider[] = ['openai', 'deepseek', 'openrouter', 'siliconflow', 'ollama', 'custom', 'modelscope'];
    
    try {
        if (config.provider === 'gemini') {
            yield* generateWithGemini(prompt, config);
        } else if (openAICompatibleProviders.includes(config.provider)) {
            yield* generateWithOpenAICompatible(prompt, config);
        } else {
            throw new Error(`Unsupported AI provider: ${config.provider}`);
        }
    } catch (error) {
        console.error(`Error generating outline with ${config.provider} API:`, error);
        if (error instanceof Error) {
            let detailedMessage = `生成故事大纲失败: ${error.message}`;
            if (error.message.includes('Failed to fetch')) {
                detailedMessage += '\n\n这通常是由于以下原因之一造成的：\n1. **网络连接问题**：请检查您的网络连接以及能否访问目标 Endpoint URL。\n2. **CORS 跨域问题**：如果您正在使用本地或自定义 API，请确保服务器已正确配置 CORS 策略，允许来自当前网页的请求。\n3. **Endpoint URL 错误**：请检查您在设置中填写的 Endpoint URL 是否正确，包括协议 (http/https) 和端口。';
            }
            throw new Error(detailedMessage);
        }
        throw new Error(`生成故事大纲失败。请检查您的 API 设置后重试。`);
    }
}

export async function* polishOutline(currentOutline: string, userMessage: string, config: AIConfig, signal?: AbortSignal): AsyncGenerator<string> {
    const polishPrompt = `你是一位专业的小说写作助理。你的任务是根据用户的指示来修改一份故事大纲。

这是当前的大纲内容（Markdown格式）：
---
${currentOutline}
---

用户的修改要求是：
"${userMessage}"

请提供完整、修订后的小说大纲，并保持 Markdown 格式。不要在纲要之外添加任何评论或解释。只返回更新后的完整 Markdown 内容。`;

    const openAICompatibleProviders: AIProvider[] = ['openai', 'deepseek', 'openrouter', 'siliconflow', 'ollama', 'custom', 'modelscope'];

    try {
        if (config.provider === 'gemini') {
            yield* generateWithGemini(polishPrompt, config, signal);
        } else if (openAICompatibleProviders.includes(config.provider)) {
            yield* generateWithOpenAICompatible(polishPrompt, config, signal);
        } else {
            throw new Error(`Unsupported AI provider: ${config.provider}`);
        }
    } catch (error) {
        console.error(`Error polishing outline with ${config.provider} API:`, error);
        if (error instanceof Error) {
            let detailedMessage = `AI 润色失败: ${error.message}`;
            if (error.message.includes('Failed to fetch')) {
                detailedMessage += '\n\n请检查您的网络连接和 AI Endpoint 设置。';
            }
            throw new Error(detailedMessage);
        }
        throw new Error(`AI 润色失败。请检查您的 API 设置后重试。`);
    }
}

export async function* generateChatResponse(chatHistory: ChatMessage[], config: AIConfig, signal?: AbortSignal): AsyncGenerator<string> {
    const openAICompatibleProviders: AIProvider[] = ['openai', 'deepseek', 'openrouter', 'siliconflow', 'ollama', 'custom', 'modelscope'];
    const chatConfig = { ...config, model: config.assistantModel || config.model };

    try {
        if (chatConfig.provider === 'gemini') {
            yield* generateWithGemini(chatHistory, chatConfig, signal);
        } else if (openAICompatibleProviders.includes(chatConfig.provider)) {
            yield* generateWithOpenAICompatible(chatHistory, chatConfig, signal);
        } else {
            throw new Error(`Unsupported AI provider: ${chatConfig.provider}`);
        }
    } catch (error) {
        console.error(`Error in chat response with ${chatConfig.provider} API:`, error);
        if (error instanceof Error) {
            let detailedMessage = `AI 聊天失败: ${error.message}`;
            if (error.message.includes('Failed to fetch')) {
                detailedMessage += '\n\n请检查您的网络连接和 AI Endpoint 设置。';
            }
            throw new Error(detailedMessage);
        }
        throw new Error(`AI 聊天失败。请检查您的 API 设置后重试。`);
    }
}


export const fetchModels = async (config: AIConfig): Promise<string[]> => {
    if (config.provider === 'gemini') {
        const apiKey = config.apiKey || process.env.API_KEY;
        if (!apiKey) {
            throw new Error("Gemini API 密钥未配置。");
        }
        if (!config.endpoint) {
            throw new Error("Gemini Endpoint URL is not configured.");
        }

        const endpoint = `${config.endpoint.trim().replace(/\/+$/, '')}/v1beta/models`;
        
        try {
            const response = await fetch(endpoint, {
                method: 'GET',
                headers: {
                    'x-goog-api-key': apiKey,
                },
            });

            if (!response.ok) {
                let errorData;
                try {
                    errorData = await response.json();
                } catch (e) {
                    throw new Error(`API 返回状态 ${response.status}: ${response.statusText}`);
                }
                throw new Error(`获取 Gemini 模型列表失败 (状态 ${response.status}): ${errorData.error?.message || '请检查 Endpoint URL 和 API 密钥。'}`);
            }

            const data = await response.json();

            if (!data.models) {
                throw new Error('从 Gemini API 获取模型时返回了无效的响应。');
            }
            
            // Filter for models that can generate content and are not legacy, then sort
            const models = data.models
                .filter((model: any) => 
                    model.supportedGenerationMethods?.includes('generateContent') &&
                    !model.name.includes('embedding') &&
                    !model.name.includes('text-bison') // filter out legacy models
                )
                .map((model: any) => model.name.replace('models/', ''))
                .sort();
                
            return models;
        } catch (error) {
            console.error(`Failed to fetch models from Gemini:`, error);
            if (error instanceof Error) {
                let detailedMessage = `获取模型列表失败: ${error.message}`;
                 if (error.message.includes('Failed to fetch')) {
                    detailedMessage += '\n\n请检查您的网络连接、Endpoint URL 是否正确，以及 API 密钥是否有效。';
                }
                throw new Error(detailedMessage);
            }
            throw new Error('获取模型列表时发生未知网络错误。');
        }
    }

    if (!config.endpoint) {
        throw new Error("Endpoint URL 不能为空。");
    }
    
    const endpoint = config.provider === 'ollama'
        ? `${config.endpoint.trim().replace(/\/+$/, '')}/api/tags`
        : getEndpoint(config.endpoint, 'models');

    const headers: HeadersInit = { 'Content-Type': 'application/json' };

    if (config.provider !== 'ollama' && config.apiKey) {
        headers['Authorization'] = `Bearer ${config.apiKey}`;
    }

    try {
        const response = await fetch(endpoint, { method: 'GET', headers });

        if (!response.ok) {
            let errorData;
            try {
                errorData = await response.json();
            } catch (e) {
                throw new Error(`API 返回状态 ${response.status}: ${response.statusText}`);
            }
            throw new Error(`获取模型列表失败 (状态 ${response.status}): ${errorData.error?.message || '请检查 Endpoint URL。'}`);
        }

        const data = await response.json();

        if (config.provider === 'ollama') {
            return data.models?.map((model: OllamaModel) => model.name) || [];
        } else {
            return data.data?.map((model: OpenAIModel) => model.id).sort() || [];
        }
    } catch (error) {
        console.error(`Failed to fetch models from ${config.endpoint}:`, error);
        if (error instanceof Error) {
            let detailedMessage = `获取模型列表失败: ${error.message}`;
             if (error.message.includes('Failed to fetch')) {
                detailedMessage += '\n\n这通常是由于以下原因之一造成的：\n1. **网络连接问题**：请检查您的网络连接以及能否访问目标 Endpoint URL。\n2. **CORS 跨域问题**：如果您正在使用本地或自定义 API，请确保服务器已正确配置 CORS 策略。\n3. **Endpoint URL 错误**：请检查您在设置中填写的 Endpoint URL 是否正确。';
            }
            throw new Error(detailedMessage);
        }
        throw new Error('获取模型列表时发生未知网络错误。');
    }
};

export async function generateCardDetails(cardName: string, cardType: CardType, config: AIConfig): Promise<{ tooltipText: string; description: string }> {
    if (!cardName.trim()) {
        throw new Error("Card name cannot be empty.");
    }

    const cardTypeName = CARD_TYPE_NAMES[cardType];

    const prompt = `你是一位专业的创意写作和故事理论专家。请为一个写作提示卡片生成两段文本，卡片类型为“${cardTypeName}”，名称为“${cardName}”：

1.  **tooltipText**: 一句简明扼要的总结（少于20个汉字），解释卡片的核心概念。
2.  **description**: 一段详细的说明（大约50-80汉字），这段内容将作为AI生成故事大纲的更大提示词（prompt）的一部分。这段描述应该对AI具有启发性和指导性。

请严格按照以下JSON格式提供输出，不要包含任何markdown标记或额外的解释：
{
  "tooltipText": "...",
  "description": "..."
}`;
    
    const getFullResponse = async (prompt: string, config: AIConfig): Promise<string> => {
        const openAICompatibleProviders: AIProvider[] = ['openai', 'deepseek', 'openrouter', 'siliconflow', 'ollama', 'custom', 'modelscope'];
        const nonStreamingConfig = { ...config, streaming: false };

        let stream: AsyncGenerator<string>;

        if (nonStreamingConfig.provider === 'gemini') {
            stream = generateWithGemini(prompt, nonStreamingConfig);
        } else if (openAICompatibleProviders.includes(nonStreamingConfig.provider)) {
            stream = generateWithOpenAICompatible(prompt, nonStreamingConfig);
        } else {
            throw new Error(`Unsupported AI provider: ${nonStreamingConfig.provider}`);
        }

        const { value } = await stream.next();
        return value || "";
    }

    try {
        const responseText = await getFullResponse(prompt, config);
        const cleanedResponse = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanedResponse);

        if (typeof parsed.tooltipText === 'string' && typeof parsed.description === 'string') {
            return parsed;
        } else {
            throw new Error("AI response did not contain the expected JSON structure.");
        }
    } catch (error) {
        console.error("Failed to generate or parse card details from AI:", error);
        throw new Error(`AI生成卡片详情失败: ${error instanceof Error ? error.message : '请检查网络和AI设置。'}`);
    }
}