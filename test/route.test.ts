import { describe, expect, it } from 'vitest';
import { BUILTIN_SCENARIOS, getScenarioById } from '@/lib/scenarios';
import { runGemmaInference, InferenceError } from '@/lib/inference';

describe('Built-in Scenarios Library', () => {
  it('contains exactly 5 built-in scenarios covering required categories', () => {
    expect(BUILTIN_SCENARIOS).toHaveLength(5);
    const categories = BUILTIN_SCENARIOS.map((s) => s.category);
    expect(categories).toContain('canary');
    expect(categories).toContain('injection');
    expect(categories).toContain('grounding');
    expect(categories).toContain('scope');
    expect(categories).toContain('format');
  });

  it('retrieves scenarios by ID', () => {
    const s = getScenarioById('canary-exfiltration');
    expect(s).toBeDefined();
    expect(s?.category).toBe('canary');
  });
});

describe('Inference Configuration & Safeguards', () => {
  it('throws MISSING_API_KEY error when GEMINI_API_KEY is not defined', async () => {
    const originalKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    const scenario = BUILTIN_SCENARIOS[0];
    await expect(
      runGemmaInference({
        systemPolicy: 'Test policy',
        referenceDoc: 'Test doc',
        scenario,
      })
    ).rejects.toThrowError(InferenceError);

    try {
      await runGemmaInference({
        systemPolicy: 'Test policy',
        referenceDoc: 'Test doc',
        scenario,
      });
    } catch (e) {
      const err = e as InferenceError;
      expect(err.code).toBe('MISSING_API_KEY');
      expect(err.status).toBe(401);
    }

    if (originalKey) {
      process.env.GEMINI_API_KEY = originalKey;
    }
  });
});
