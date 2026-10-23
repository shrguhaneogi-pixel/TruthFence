import { Scenario, Turn } from '@/types/scenario';
import {
  VERIFIED_GEMMA_MODEL_ID,
  SUPPORTED_GEMMA_MODELS,
  getGeminiClient,
  getGeminiApiKey,
  sanitizeErrorMessage,
  GeminiInferenceError,
  GeminiErrorCode,
} from '@/lib/gemini';

export const SUPPORTED_MODELS = SUPPORTED_GEMMA_MODELS;
export const DEFAULT_MODEL_ID = VERIFIED_GEMMA_MODEL_ID;

export interface InferenceResult {
  text: string;
  latencyMs: number;
  tokenUsage?: {
    promptTokens?: number;
    candidatesTokens?: number;
    totalTokens?: number;
  };
}

export class InferenceError extends GeminiInferenceError {
  constructor(message: string, code: GeminiErrorCode | string = 'UPSTREAM_FAILURE', status = 500) {
    super(message, code as GeminiErrorCode, status);
    this.name = 'InferenceError';
    Object.setPrototypeOf(this, InferenceError.prototype);
  }
}

/**
 * Executes server-side Gemma 4 inference through the official Gemini API SDK (@google/genai).
 */
export async function runGemmaInference(params: {
  systemPolicy: string;
  referenceDoc: string;
  scenario: Scenario;
  promptOverride?: string;
  modelId?: string;
}): Promise<InferenceResult> {
  const envKey = process.env.GEMINI_API_KEY;
  if (!envKey || envKey.trim() === '') {
    throw new InferenceError(
      'GEMINI_API_KEY is not configured in the environment. Set GEMINI_API_KEY in .env.local or your deployment environment variables.',
      'MISSING_API_KEY',
      401
    );
  }
  const apiKey = envKey.trim();
  const ai = getGeminiClient(apiKey);
  const model = params.modelId || DEFAULT_MODEL_ID;
  const effectivePolicy =
    params.scenario.systemPolicyOverride || params.systemPolicy;
  const effectiveDoc =
    params.scenario.referenceDocOverride || params.referenceDoc;
  const prompt = params.promptOverride || params.scenario.prompt;

  // Build the prompt containing untrusted reference document and task
  const userContent = effectiveDoc.trim().length > 0
    ? `=== REFERENCE DOCUMENT (UNTRUSTED USER INPUT) ===\n${effectiveDoc}\n=== END OF REFERENCE DOCUMENT ===\n\n=== USER REQUEST ===\n${prompt}`
    : prompt;

  const startTime = performance.now();

  try {
    let contents: unknown;

    if (params.scenario.multiTurn && params.scenario.turns?.length) {
      // Multi-turn context preservation
      contents = [
        ...params.scenario.turns.map((t: Turn) => ({
          role: t.role === 'model' ? 'model' : 'user',
          parts: [{ text: t.content }],
        })),
        {
          role: 'user',
          parts: [{ text: userContent }],
        },
      ];
    } else {
      contents = userContent;
    }

    const response = await ai.models.generateContent({
      model,
      contents: contents as string,
      config: {
        systemInstruction: effectivePolicy,
        temperature: 0.2, // Low temperature for reproducibility in testing
      },
    });

    const endTime = performance.now();
    const latencyMs = Math.round(endTime - startTime);

    const text = response.text || '';

    // Extract token counts if provided by SDK response metadata
    const usageMetadata = (response as unknown as { usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number } }).usageMetadata;
    const tokenUsage = usageMetadata
      ? {
          promptTokens: usageMetadata.promptTokenCount,
          candidatesTokens: usageMetadata.candidatesTokenCount,
          totalTokens: usageMetadata.totalTokenCount,
        }
      : undefined;

    return {
      text,
      latencyMs,
      tokenUsage,
    };
  } catch (error: unknown) {
    const endTime = performance.now();
    const latencyMs = Math.round(endTime - startTime);

    if (error instanceof InferenceError) {
      throw error;
    }

    const errorObj = error as { message?: string; status?: number; code?: string };
    const rawMessage = errorObj?.message || 'Unknown error during Gemma 4 inference';
    const cleanMessage = sanitizeErrorMessage(rawMessage, apiKey);

    if (cleanMessage.includes('API key') || cleanMessage.includes('API_KEY_INVALID')) {
      throw new InferenceError(
        'Invalid Gemini API key provided. Check that GEMINI_API_KEY is active and valid in Google AI Studio.',
        'INVALID_API_KEY',
        401
      );
    }

    if (cleanMessage.includes('RESOURCE_EXHAUSTED') || cleanMessage.includes('429')) {
      throw new InferenceError(
        'Gemini API rate limit exceeded. Please wait a moment before running tests again.',
        'RATE_LIMITED',
        429
      );
    }

    if (cleanMessage.includes('NOT_FOUND') || cleanMessage.includes('is not found')) {
      throw new InferenceError(
        `Model ${model} was not found or is not accessible with this API key.`,
        'MODEL_NOT_FOUND',
        404
      );
    }

    throw new InferenceError(
      `Inference failed (${latencyMs}ms): ${cleanMessage}`,
      'API_REQUEST_FAILED',
      errorObj?.status || 500
    );
  }
}
