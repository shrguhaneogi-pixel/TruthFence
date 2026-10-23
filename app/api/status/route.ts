import { NextResponse } from 'next/server';
import { SUPPORTED_MODELS, DEFAULT_MODEL_ID } from '@/lib/inference';
import { BUILTIN_SCENARIOS } from '@/lib/scenarios';

export async function GET() {
  const hasApiKey = Boolean(
    process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0
  );

  return NextResponse.json({
    status: 'ok',
    hasApiKey,
    defaultModel: DEFAULT_MODEL_ID,
    supportedModels: SUPPORTED_MODELS,
    availableScenariosCount: BUILTIN_SCENARIOS.length,
    timestamp: new Date().toISOString(),
  });
}
