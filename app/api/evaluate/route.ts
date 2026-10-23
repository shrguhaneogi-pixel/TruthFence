import { NextRequest, NextResponse } from 'next/server';
import {
  executeGemmaInference,
  GeminiInferenceError,
  SUPPORTED_GEMMA_MODELS,
  VERIFIED_GEMMA_MODEL_ID,
  EvaluateRequestSchema,
  EvaluateSuccessResponse,
  EvaluateErrorResponse,
} from '@/lib/gemini';

/**
 * POST /api/evaluate
 *
 * Executes server-side Gemma 4 model inference using the official @google/genai SDK.
 */
export async function POST(req: NextRequest): Promise<NextResponse<EvaluateSuccessResponse | EvaluateErrorResponse>> {
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: 'Malformed request body. Expected valid JSON.',
        code: 'INVALID_REQUEST',
      },
      { status: 400 }
    );
  }

  const parseResult = EvaluateRequestSchema.safeParse(rawBody);
  if (!parseResult.success) {
    return NextResponse.json(
      {
        success: false,
        error: 'Validation failed',
        code: 'INVALID_REQUEST',
        issues: parseResult.error.format(),
      },
      { status: 400 }
    );
  }

  const {
    prompt,
    systemInstruction,
    systemPolicy,
    referenceDocument,
    referenceDoc,
    model,
    temperature,
  } = parseResult.data;

  // Resolve aliases
  const effectiveSystemInstruction = systemInstruction || systemPolicy;
  const effectiveReferenceDoc = referenceDocument || referenceDoc;
  const targetModel = model || VERIFIED_GEMMA_MODEL_ID;

  // Frame untrusted reference text securely
  const compositePrompt = effectiveReferenceDoc && effectiveReferenceDoc.trim().length > 0
    ? `=== REFERENCE DOCUMENT (UNTRUSTED USER INPUT) ===\n${effectiveReferenceDoc}\n=== END OF REFERENCE DOCUMENT ===\n\n=== USER REQUEST ===\n${prompt}`
    : prompt;

  try {
    const inference = await executeGemmaInference({
      prompt: compositePrompt,
      systemInstruction: effectiveSystemInstruction,
      modelId: targetModel,
      temperature,
    });

    return NextResponse.json({
      success: true,
      model: inference.model,
      text: inference.text,
      latencyMs: inference.latencyMs,
      tokenUsage: inference.tokenUsage,
      finishReason: inference.finishReason,
    });
  } catch (err: unknown) {
    if (err instanceof GeminiInferenceError) {
      return NextResponse.json(
        {
          success: false,
          error: err.message,
          code: err.code,
        },
        { status: err.status }
      );
    }

    // Generic safe fallback without exposing stack traces or internals
    const generalMsg = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to complete Gemma 4 inference: ' + generalMsg,
        code: 'UPSTREAM_FAILURE',
      },
      { status: 502 }
    );
  }
}

/**
 * GET /api/evaluate
 *
 * Discovery endpoint indicating inference readiness and supported models.
 */
export async function GET() {
  const hasApiKey = Boolean(
    process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0
  );

  return NextResponse.json({
    endpoint: '/api/evaluate',
    status: 'ready',
    hasApiKey,
    defaultModel: VERIFIED_GEMMA_MODEL_ID,
    supportedModels: SUPPORTED_GEMMA_MODELS,
  });
}
