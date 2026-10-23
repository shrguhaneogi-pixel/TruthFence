import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { computeScorecard, evaluateScenario } from '@/evaluator';
import { InferenceError, runGemmaInference, DEFAULT_MODEL_ID } from '@/lib/inference';
import { getScenarioById } from '@/lib/scenarios';
import { TestRunResult } from '@/types/scenario';

const RunTestRequestSchema = z.object({
  systemPolicy: z
    .string()
    .max(15000, 'System policy must not exceed 15,000 characters.'),
  referenceDoc: z
    .string()
    .max(30000, 'Reference document must not exceed 30,000 characters.'),
  scenarioIds: z
    .array(z.string().min(1))
    .min(1, 'Please select at least one test scenario.')
    .max(10, 'Maximum 10 scenarios permitted per test run.'),
  customPrompts: z.record(z.string().max(4000)).optional(),
  model: z.string().max(64).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json();
    const parseResult = RunTestRequestSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          issues: parseResult.error.format(),
        },
        { status: 400 }
      );
    }

    const { systemPolicy, referenceDoc, scenarioIds, customPrompts, model } =
      parseResult.data;
    const modelId = model || DEFAULT_MODEL_ID;

    const results: TestRunResult[] = [];

    // Execute scenarios sequentially to prevent rate limit spikes
    for (const scenarioId of scenarioIds) {
      const scenario = getScenarioById(scenarioId);
      if (!scenario) {
        results.push({
          scenario: {
            id: scenarioId,
            title: `Unknown Scenario (${scenarioId})`,
            category: 'grounding',
            description: 'Scenario definition not found',
            prompt: '',
            expectedBehavior: '',
          },
          rawOutput: '',
          latencyMs: 0,
          error: `Scenario ID "${scenarioId}" is not recognized.`,
          evaluatorResult: {
            scenarioId,
            category: 'grounding',
            passed: false,
            isHeuristic: false,
            metricName: 'Scenario Lookup',
            metricValue: 'NOT_FOUND',
            reason: `Scenario with ID "${scenarioId}" does not exist.`,
            details: {},
          },
        });
        continue;
      }

      const promptOverride = customPrompts?.[scenarioId];

      try {
        const inference = await runGemmaInference({
          systemPolicy,
          referenceDoc,
          scenario,
          promptOverride,
          modelId,
        });

        const evaluatorResult = evaluateScenario(
          scenario,
          inference.text,
          scenario.referenceDocOverride || referenceDoc,
          scenario.canarySecret
        );

        results.push({
          scenario,
          rawOutput: inference.text,
          latencyMs: inference.latencyMs,
          tokenUsage: inference.tokenUsage,
          evaluatorResult,
        });
      } catch (err: unknown) {
        if (err instanceof InferenceError) {
          results.push({
            scenario,
            rawOutput: '',
            latencyMs: 0,
            error: err.message,
            evaluatorResult: {
              scenarioId: scenario.id,
              category: scenario.category,
              passed: false,
              isHeuristic: false,
              metricName: 'Inference Execution',
              metricValue: err.code,
              reason: err.message,
              details: {
                evidenceSnippet: `Error [${err.code}]: ${err.message}`,
              },
            },
          });

          // If the API key is missing or invalid, short-circuit so user gets immediate diagnostic
          if (err.code === 'MISSING_API_KEY' || err.code === 'INVALID_API_KEY') {
            break;
          }
        } else {
          const generalMsg =
            err instanceof Error ? err.message : 'Unknown inference error';
          results.push({
            scenario,
            rawOutput: '',
            latencyMs: 0,
            error: generalMsg,
            evaluatorResult: {
              scenarioId: scenario.id,
              category: scenario.category,
              passed: false,
              isHeuristic: false,
              metricName: 'Inference Execution',
              metricValue: 'ERROR',
              reason: generalMsg,
              details: {},
            },
          });
        }
      }
    }

    const scorecard = computeScorecard(
      results,
      modelId,
      systemPolicy,
      referenceDoc
    );

    return NextResponse.json({
      success: true,
      scorecard,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Failed to process test request';
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
