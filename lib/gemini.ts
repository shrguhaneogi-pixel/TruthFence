/**
 * Server-only model client integration for Gemma 4 via official @google/genai SDK.
 *
 * Verified Model ID: gemma-4-31b-it
 * SDK: @google/genai (^2.31.0)
 *
 * Security Guarantee:
 * - Server-only execution; throws if evaluated in a browser environment.
 * - Reads GEMINI_API_KEY strictly from server-side process.env.
 * - Never returns or logs API keys, secret credentials, or internal stack traces.
 * - Model outputs are treated strictly as text data; never executed as code/commands.
 */

import { GoogleGenAI } from '@google/genai';

// Guard against unintentional client-bundle inclusion
if (typeof window !== 'undefined') {
  throw new Error('lib/gemini.ts is a server-only module and cannot be run in client contexts.');
}

/**
 * Verified Gemma 4 model identifiers supported in Google AI Studio and Gemini API.
 */
export const VERIFIED_GEMMA_MODEL_ID = 'gemma-4-31b-it';

export const SUPPORTED_GEMMA_MODELS = [
  {
    id: 'gemma-4-31b-it',
    name: 'Gemma 4 31B IT (Recommended)',
    contextWindow: 262144, // 256k tokens
    default: true,
    description: 'Dense multimodal instruction-tuned model from Google DeepMind',
  },
  {
    id: 'gemma-4-26b-a4b-it',
    name: 'Gemma 4 26B A4B IT',
    contextWindow: 262144,
    default: false,
    description: 'Mixture-of-Experts Gemma 4 instruction-tuned variant',
  },
  {
    id: 'gemma-4-e4b-it',
    name: 'Gemma 4 Edge 4B IT',
    contextWindow: 131072,
    default: false,
    description: 'Lightweight edge-optimized Gemma 4 instruction-tuned model',
  },
  {
    id: 'gemma-4-e2b-it',
    name: 'Gemma 4 Edge 2B IT',
    contextWindow: 131072,
    default: false,
    description: 'Ultra-lightweight edge Gemma 4 instruction-tuned model',
  },
] as const;

export type GemmaModelId = (typeof SUPPORTED_GEMMA_MODELS)[number]['id'] | string;

export type GeminiErrorCode =
  | 'MISSING_API_KEY'
  | 'INVALID_API_KEY'
  | 'RATE_LIMITED'
  | 'MODEL_NOT_FOUND'
  | 'INVALID_MODEL_RESPONSE'
  | 'UPSTREAM_FAILURE'
  | 'INTERNAL_ERROR';

import { z } from 'zod';

export class GeminiInferenceError extends Error {
  readonly code: GeminiErrorCode;
  readonly status: number;

  constructor(message: string, code: GeminiErrorCode = 'UPSTREAM_FAILURE', status = 500) {
    super(message);
    this.name = 'GeminiInferenceError';
    this.code = code;
    this.status = status;
    Object.setPrototypeOf(this, GeminiInferenceError.prototype);
  }
}

/**
 * Request validation schema for Gemma 4 evaluation inference.
 * Enforces strict input limits to prevent payload abuse or memory exhaustion.
 */
export const EvaluateRequestSchema = z.object({
  prompt: z
    .string({ required_error: 'Prompt is required' })
    .trim()
    .min(1, 'Prompt cannot be empty.')
    .max(10000, 'Prompt must not exceed 10,000 characters.'),
  systemInstruction: z
    .string()
    .max(20000, 'System instruction must not exceed 20,000 characters.')
    .nullish(),
  systemPolicy: z
    .string()
    .max(20000, 'System policy must not exceed 20,000 characters.')
    .nullish(),
  referenceDocument: z
    .string()
    .max(40000, 'Reference document must not exceed 40,000 characters.')
    .nullish(),
  referenceDoc: z
    .string()
    .max(40000, 'Reference document must not exceed 40,000 characters.')
    .nullish(),
  model: z
    .string()
    .trim()
    .max(64, 'Model identifier must not exceed 64 characters.')
    .nullish(),
  temperature: z
    .number()
    .min(0, 'Temperature must be at least 0.0.')
    .max(2, 'Temperature must not exceed 2.0.')
    .nullish(),
  maxOutputTokens: z
    .number()
    .int('maxOutputTokens must be an integer.')
    .positive('maxOutputTokens must be positive.')
    .max(8192, 'maxOutputTokens must not exceed 8192.')
    .nullish(),
});

export type EvaluateRequest = z.infer<typeof EvaluateRequestSchema>;

export interface EvaluateSuccessResponse {
  success: true;
  model: string;
  text: string;
  latencyMs: number;
  tokenUsage?: {
    promptTokens?: number;
    candidatesTokens?: number;
    totalTokens?: number;
  };
  finishReason?: string;
}

export interface EvaluateErrorResponse {
  success: false;
  error: string;
  code: string;
  issues?: unknown;
}

/**
 * Sanitizes messages to guarantee no API keys or raw token sequences leak into errors.
 */
export function sanitizeErrorMessage(message: string, apiKey?: string): string {
  let sanitized = message;
  const knownKey = apiKey || process.env.GEMINI_API_KEY;
  if (knownKey && knownKey.length > 4) {
    sanitized = sanitized.replaceAll(knownKey, '[REDACTED_API_KEY]');
  }
  // Strip standard Google API key patterns: AIza... (39 chars)
  sanitized = sanitized.replace(/AIza[0-9A-Za-z_-]{35}/g, '[REDACTED_API_KEY]');
  sanitized = sanitized.replace(/AIzaSy[A-Za-z0-9_-]{33}/g, '[REDACTED_API_KEY]');
  // Strip Bearer tokens and query parameter tokens
  sanitized = sanitized.replace(/(Bearer\s+)[A-Za-z0-9._-]+/gi, '$1[REDACTED_API_KEY]');
  sanitized = sanitized.replace(/([?&](?:key|api_key|apiKey)=)[^&\s]+/gi, '$1[REDACTED_API_KEY]');
  return sanitized;
}

/**
 * Retrieves and validates the server-side GEMINI_API_KEY.
 * Never logs or exposes the key value.
 */
export function getGeminiApiKey(): string {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    throw new GeminiInferenceError(
      'GEMINI_API_KEY is not configured in the server environment. Configure GEMINI_API_KEY in .env.local or your deployment environment variables.',
      'MISSING_API_KEY',
      401
    );
  }
  return apiKey.trim();
}

let customClientProvider: (() => GoogleGenAI) | null = null;

/**
 * Configures a custom client provider (primarily for hermetic testing and dependency injection).
 */
export function setGeminiClientProvider(provider: (() => GoogleGenAI) | null): void {
  customClientProvider = provider;
}

/**
 * Instantiates or retrieves the official @google/genai client.
 */
export function getGeminiClient(explicitApiKey?: string): GoogleGenAI {
  if (customClientProvider) {
    return customClientProvider();
  }
  const apiKey = explicitApiKey || getGeminiApiKey();
  return new GoogleGenAI({ apiKey });
}

export interface GemmaInferenceOptions {
  prompt: string;
  systemInstruction?: string;
  modelId?: string;
  temperature?: number;
  maxOutputTokens?: number;
  client?: GoogleGenAI;
}

export interface GemmaInferenceResponse {
  text: string;
  model: string;
  latencyMs: number;
  tokenUsage?: {
    promptTokens?: number;
    candidatesTokens?: number;
    totalTokens?: number;
  };
  finishReason?: string;
}

/**
 * Executes server-side Gemma 4 text generation through the official @google/genai SDK.
 */
export async function executeGemmaInference(
  options: GemmaInferenceOptions
): Promise<GemmaInferenceResponse> {
  const hasInjectedClient = Boolean(options.client || customClientProvider);
  const apiKey = hasInjectedClient
    ? (process.env.GEMINI_API_KEY || 'injected-client')
    : getGeminiApiKey();
  const client = options.client || getGeminiClient(apiKey);
  const model = options.modelId || VERIFIED_GEMMA_MODEL_ID;

  const startTime = performance.now();

  try {
    const config: Record<string, unknown> = {
      temperature: typeof options.temperature === 'number' ? options.temperature : 0.2,
    };

    if (options.systemInstruction && options.systemInstruction.trim().length > 0) {
      config.systemInstruction = options.systemInstruction;
    }

    if (typeof options.maxOutputTokens === 'number') {
      config.maxOutputTokens = options.maxOutputTokens;
    }

    const response = await client.models.generateContent({
      model,
      contents: options.prompt,
      config,
    });

    const endTime = performance.now();
    const latencyMs = Math.round(endTime - startTime);

    if (!response) {
      throw new GeminiInferenceError(
        'Model returned an empty response.',
        'INVALID_MODEL_RESPONSE',
        502
      );
    }

    if (response.promptFeedback?.blockReason) {
      throw new GeminiInferenceError(
        `Model prompt was blocked by content filters: ${response.promptFeedback.blockReason}`,
        'INVALID_MODEL_RESPONSE',
        422
      );
    }

    const candidate = response.candidates?.[0];
    const finishReason = candidate?.finishReason;

    if (finishReason === 'SAFETY' || finishReason === 'RECITATION' || finishReason === 'BLOCKLIST') {
      throw new GeminiInferenceError(
        `Model response generation was blocked (${finishReason}).`,
        'INVALID_MODEL_RESPONSE',
        422
      );
    }

    const text = response.text;
    if (typeof text !== 'string') {
      throw new GeminiInferenceError(
        'Model returned an invalid response structure without text content.',
        'INVALID_MODEL_RESPONSE',
        502
      );
    }

    // Safely extract token counts from response usageMetadata
    const usage = response.usageMetadata;
    const tokenUsage = usage
      ? {
          promptTokens: usage.promptTokenCount,
          candidatesTokens: usage.candidatesTokenCount,
          totalTokens: usage.totalTokenCount,
        }
      : undefined;

    return {
      text,
      model,
      latencyMs,
      tokenUsage,
      finishReason,
    };
  } catch (error: unknown) {
    const endTime = performance.now();
    const latencyMs = Math.round(endTime - startTime);

    if (error instanceof GeminiInferenceError) {
      throw error;
    }

    const rawError = error as { message?: string; status?: number; code?: string };
    const rawMessage = rawError?.message || 'Unknown error occurred during Gemma 4 inference';
    const cleanMessage = sanitizeErrorMessage(rawMessage, apiKey);

    // Classify known API and network failure cases cleanly without leaking internals
    if (
      cleanMessage.includes('API key') ||
      cleanMessage.includes('API_KEY_INVALID') ||
      rawError?.status === 401
    ) {
      throw new GeminiInferenceError(
        'Invalid Gemini API key provided. Verify that GEMINI_API_KEY is active and valid in Google AI Studio.',
        'INVALID_API_KEY',
        401
      );
    }

    if (
      cleanMessage.includes('RESOURCE_EXHAUSTED') ||
      cleanMessage.includes('quota') ||
      rawError?.status === 429
    ) {
      throw new GeminiInferenceError(
        'Gemini API rate limit or quota exceeded. Please back off before retrying.',
        'RATE_LIMITED',
        429
      );
    }

    if (
      cleanMessage.includes('NOT_FOUND') ||
      cleanMessage.includes('is not found') ||
      rawError?.status === 404
    ) {
      throw new GeminiInferenceError(
        `Model "${model}" was not found or is not accessible with this API key.`,
        'MODEL_NOT_FOUND',
        404
      );
    }

    throw new GeminiInferenceError(
      `Gemma 4 inference failed after ${latencyMs}ms: ${cleanMessage}`,
      'UPSTREAM_FAILURE',
      rawError?.status || 502
    );
  }
}
