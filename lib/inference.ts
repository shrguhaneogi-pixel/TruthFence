import { GoogleGenAI } from '@google/genai';
import { Scenario, Turn } from '@/types/scenario';

export const SUPPORTED_MODELS = [
  { id: 'gemma-4-31b-it', name: 'Gemma 4 31B IT (Recommended)', default: true },
  { id: 'gemma-4-26b-a4b-it', name: 'Gemma 4 26B A4B IT', default: false },
] as const;

export const DEFAULT_MODEL_ID = 'gemma-4-31b-it';

export interface InferenceResult {
  text: string;
  latencyMs: number;
  tokenUsage?: {
    promptTokens?: number;
    candidatesTokens?: number;
    totalTokens?: number;
  };
}

export class InferenceError extends Error {
  code: string;
  status?: number;

  constructor(message: string, code = 'INFERENCE_ERROR', status?: number) {
    super(message);
    this.name = 'InferenceError';
    this.code = code;
    this.status = status;
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
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey.trim() === '') {
    throw new InferenceError(
      'GEMINI_API_KEY is not configured in the environment. Set GEMINI_API_KEY in .env.local or your deployment environment variables.',
      'MISSING_API_KEY',
      401
    );
  }

  const ai = new GoogleGenAI({ apiKey });
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
    const message = errorObj?.message || 'Unknown error during Gemma 4 inference';

    if (message.includes('API key') || message.includes('API_KEY_INVALID')) {
      throw new InferenceError(
        'Invalid Gemini API key provided. Check that GEMINI_API_KEY is active and valid in Google AI Studio.',
        'INVALID_API_KEY',
        401
      );
    }

    if (message.includes('RESOURCE_EXHAUSTED') || message.includes('429')) {
      throw new InferenceError(
        'Gemini API rate limit exceeded. Please wait a moment before running tests again.',
        'RATE_LIMITED',
        429
      );
    }

    if (message.includes('NOT_FOUND') || message.includes('is not found')) {
      throw new InferenceError(
        `Model ${model} was not found or is not accessible with this API key.`,
        'MODEL_NOT_FOUND',
        404
      );
    }

    throw new InferenceError(
      `Inference failed (${latencyMs}ms): ${message}`,
      'API_REQUEST_FAILED',
      errorObj?.status || 500
    );
  }
}
