import { EvaluatorResult, Scenario } from '@/types/scenario';

/**
 * Extracts and cleans JSON content from raw output,
 * stripping markdown code fence formatting if present.
 */
export function extractJsonString(rawOutput: string): string {
  const trimmed = rawOutput.trim();

  // 1. Check for markdown json block
  const markdownJsonMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (markdownJsonMatch && markdownJsonMatch[1]) {
    return markdownJsonMatch[1].trim();
  }

  // 2. Check for outer curly braces or square brackets
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  return trimmed;
}

/**
 * Output Format Evaluator
 * Deterministic check: Parses JSON from model output and validates required schema keys.
 */
export function evaluateFormat(
  rawOutput: string,
  scenario: Scenario
): EvaluatorResult {
  const jsonStr = extractJsonString(rawOutput);
  let parsed: Record<string, unknown> | null = null;

  try {
    parsed = JSON.parse(jsonStr);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Invalid JSON syntax';
    return {
      scenarioId: scenario.id,
      category: 'format',
      passed: false,
      isHeuristic: false,
      metricName: 'JSON Syntax & Schema',
      metricValue: 'SYNTAX_ERROR',
      threshold: 'VALID_JSON',
      reason: `Failed to parse JSON from response: ${errorMsg}`,
      details: {
        jsonValid: false,
        evidenceSnippet: rawOutput.slice(0, 200),
      },
    };
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return {
      scenarioId: scenario.id,
      category: 'format',
      passed: false,
      isHeuristic: false,
      metricName: 'JSON Syntax & Schema',
      metricValue: 'INVALID_OBJECT',
      threshold: 'KEY_VALUE_OBJECT',
      reason: 'Output is valid JSON but not a structured key-value JSON object.',
      details: {
        jsonValid: true,
        parsedJson: parsed as unknown as Record<string, unknown>,
      },
    };
  }

  const requiredKeys = scenario.requiredJsonKeys || [];
  const missingKeys = requiredKeys.filter((k) => !(k in parsed));

  if (missingKeys.length > 0) {
    return {
      scenarioId: scenario.id,
      category: 'format',
      passed: false,
      isHeuristic: false,
      metricName: 'JSON Schema Validation',
      metricValue: `MISSING_${missingKeys.length}_KEYS`,
      threshold: 'ALL_KEYS_PRESENT',
      reason: `JSON structure is missing required key(s): ${missingKeys.map((k) => `"${k}"`).join(', ')}.`,
      details: {
        jsonValid: true,
        missingKeys,
        parsedJson: parsed,
      },
    };
  }

  return {
    scenarioId: scenario.id,
    category: 'format',
    passed: true,
    isHeuristic: false,
    metricName: 'JSON Schema Validation',
    metricValue: 'VALID',
    threshold: 'ALL_KEYS_PRESENT',
    reason: `Successfully parsed valid JSON containing all ${requiredKeys.length} required keys.`,
    details: {
      jsonValid: true,
      missingKeys: [],
      parsedJson: parsed,
    },
  };
}
