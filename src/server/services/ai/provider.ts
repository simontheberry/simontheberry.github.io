// ============================================================================
// AI Provider Abstraction Layer
// Model-agnostic interface for LLM operations
// ============================================================================

import { createLogger } from '../../utils/logger';

const logger = createLogger('ai-provider');

// ---- Types ----

export interface AiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AiCompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

export interface AiCompletionResult {
  content: string;
  model: string;
  tokenUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  latencyMs: number;
}

export interface AiEmbeddingResult {
  embedding: number[];
  model: string;
  tokenUsage: number;
}

export interface AiProvider {
  name: string;
  complete(messages: AiMessage[], options?: AiCompletionOptions): Promise<AiCompletionResult>;
  embed(text: string): Promise<AiEmbeddingResult>;
}

// ---- OpenAI Provider ----

export class OpenAiProvider implements AiProvider {
  name = 'openai';
  private apiKey: string;
  private defaultModel: string;
  private embeddingModel: string;

  constructor(apiKey: string, defaultModel = 'gpt-4o', embeddingModel = 'text-embedding-ada-002') {
    this.apiKey = apiKey;
    this.defaultModel = defaultModel;
    this.embeddingModel = embeddingModel;
  }

  async complete(messages: AiMessage[], options: AiCompletionOptions = {}): Promise<AiCompletionResult> {
    const start = Date.now();
    const model = options.model || this.defaultModel;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: options.temperature ?? 0.1,
        max_tokens: options.maxTokens ?? 4096,
        ...(options.jsonMode ? { response_format: { type: 'json_object' } } : {}),
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error('OpenAI API error', { status: response.status, error });
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json() as {
      choices: Array<{ message: { content: string } }>;
      usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
    };

    return {
      content: data.choices[0].message.content,
      model,
      tokenUsage: {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      },
      latencyMs: Date.now() - start,
    };
  }

  async embed(text: string): Promise<AiEmbeddingResult> {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.embeddingModel,
        input: text,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI Embedding API error: ${response.status}`);
    }

    const data = await response.json() as {
      data: Array<{ embedding: number[] }>;
      usage: { total_tokens: number };
    };

    return {
      embedding: data.data[0].embedding,
      model: this.embeddingModel,
      tokenUsage: data.usage.total_tokens,
    };
  }
}

// ---- Anthropic Provider ----

export class AnthropicProvider implements AiProvider {
  name = 'anthropic';
  private apiKey: string;
  private defaultModel: string;

  constructor(apiKey: string, defaultModel = 'claude-sonnet-4-20250514') {
    this.apiKey = apiKey;
    this.defaultModel = defaultModel;
  }

  async complete(messages: AiMessage[], options: AiCompletionOptions = {}): Promise<AiCompletionResult> {
    const start = Date.now();
    const model = options.model || this.defaultModel;

    // Extract system message and enforce JSON output instruction
    let systemMessage = messages.find(m => m.role === 'system')?.content || '';
    if (options.jsonMode && !systemMessage.includes('valid JSON')) {
      systemMessage += '\n\nYou must respond ONLY with valid JSON. Do not include any text outside the JSON object.';
    }

    const userMessages = messages
      .filter(m => m.role !== 'system')
      .map(m => ({ role: m.role, content: m.content }));

    // Prefill assistant response with `{` to enforce JSON output
    if (options.jsonMode) {
      userMessages.push({ role: 'assistant' as const, content: '{' });
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: options.maxTokens ?? 4096,
        temperature: options.temperature ?? 0.1,
        system: systemMessage,
        messages: userMessages,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error('Anthropic API error', { status: response.status, error });
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const data = await response.json() as {
      content: Array<{ text: string }>;
      usage: { input_tokens: number; output_tokens: number };
    };

    // When JSON mode is enabled, we prefilled `{` so the response continues from there
    const rawContent = data.content[0].text;
    const content = options.jsonMode ? `{${rawContent}` : rawContent;

    return {
      content,
      model,
      tokenUsage: {
        promptTokens: data.usage.input_tokens,
        completionTokens: data.usage.output_tokens,
        totalTokens: data.usage.input_tokens + data.usage.output_tokens,
      },
      latencyMs: Date.now() - start,
    };
  }

  async embed(_text: string): Promise<AiEmbeddingResult> {
    // Anthropic doesn't have a native embedding API — fall back to OpenAI or a local model
    throw new Error('Anthropic provider does not support embeddings. Use OpenAI for embedding operations.');
  }
}

// ---- Factory ----

export function createAiProvider(
  provider: string,
  apiKey: string,
  model?: string,
  embeddingModel?: string,
): AiProvider {
  switch (provider) {
    case 'openai':
      return new OpenAiProvider(apiKey, model, embeddingModel);
    case 'anthropic':
      return new AnthropicProvider(apiKey, model);
    default:
      throw new Error(`Unsupported AI provider: ${provider}`);
  }
}
