import { describe, expect, it, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import type { GoogleGenAI } from '@google/genai';
import {
  VERIFIED_GEMMA_MODEL_ID,
  SUPPORTED_GEMMA_MODELS,
  GeminiInferenceError,
  sanitizeErrorMessage,
  getGeminiApiKey,
  getGeminiClient,
  setGeminiClientProvider,
  executeGemmaInference,
  EvaluateRequestSchema,
} from '@/lib/gemini';
import { POST as evaluatePOST, GET as evaluateGET } from '@/app/api/evaluate/route';

describe('Gemma 4 Model Client Integration (lib/gemini.ts)', () => {
  const originalEnv = process.env.GEMINI_API_KEY;

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.GEMINI_API_KEY = originalEnv;
    } else {
      delete process.env.GEMINI_API_KEY;
    }
    setGeminiClientProvider(null);
    vi.restoreAllMocks();
  });

  it('declares verified Gemma 4 model identifier as gemma-4-31b-it', () => {
    expect(VERIFIED_GEMMA_MODEL_ID).toBe('gemma-4-31b-it');
    const defaultModel = SUPPORTED_GEMMA_MODELS.find((m) => m.default);
    expect(defaultModel?.id).toBe('gemma-4-31b-it');
  });

  it('includes dense, MoE, and edge Gemma 4 variants in supported models', () => {
    const ids = SUPPORTED_GEMMA_MODELS.map((m) => m.id);
    expect(ids).toContain('gemma-4-31b-it');
    expect(ids).toContain('gemma-4-26b-a4b-it');
    expect(ids).toContain('gemma-4-e4b-it');
    expect(ids).toContain('gemma-4-e2b-it');
  });

  it('throws MISSING_API_KEY error when GEMINI_API_KEY is not defined or blank', () => {
    delete process.env.GEMINI_API_KEY;
    expect(() => getGeminiApiKey()).toThrowError(GeminiInferenceError);

    try {
      getGeminiApiKey();
    } catch (e) {
      const err = e as GeminiInferenceError;
      expect(err.code).toBe('MISSING_API_KEY');
      expect(err.status).toBe(401);
      expect(err.message).toContain('GEMINI_API_KEY is not configured');
    }

    process.env.GEMINI_API_KEY = '   ';
    expect(() => getGeminiApiKey()).toThrowError(GeminiInferenceError);
  });

  it('retrieves trimmed GEMINI_API_KEY when configured', () => {
    process.env.GEMINI_API_KEY = ' test-api-key-123 ';
    expect(getGeminiApiKey()).toBe('test-api-key-123');
  });

  it('creates GoogleGenAI instance with configured key', () => {
    const client = getGeminiClient('test-key');
    expect(client).toBeDefined();
    expect(client.models).toBeDefined();
  });

  it('sanitizes API keys and Google key patterns from error messages', () => {
    const secret = 'AIzaSyFakeSecretKeyPatternForTesting123';
    const message = `Call failed with token ${secret} on endpoint`;
    const cleaned = sanitizeErrorMessage(message, secret);
    expect(cleaned).not.toContain(secret);
    expect(cleaned).toContain('[REDACTED_API_KEY]');

    // Strip Google API key not starting with 'Sy'
    const nonSySecret = 'AIza12345678901234567890123456789012345';
    expect(sanitizeErrorMessage(`Error: key=${nonSySecret}`)).toContain('[REDACTED_API_KEY]');
    expect(sanitizeErrorMessage(`Error: key=${nonSySecret}`)).not.toContain(nonSySecret);

    // Strip Bearer token
    expect(sanitizeErrorMessage('Error with Bearer ya29.a0AfH6SM... in header')).toContain(
      'Bearer [REDACTED_API_KEY]'
    );

    // Automatic redaction from process.env when apiKey parameter is omitted
    process.env.GEMINI_API_KEY = 'secret-env-token-xyz';
    expect(sanitizeErrorMessage('Request failed for secret-env-token-xyz')).toBe(
      'Request failed for [REDACTED_API_KEY]'
    );
  });

  it('executeGemmaInference throws MISSING_API_KEY when no key configured and no provider injected', async () => {
    delete process.env.GEMINI_API_KEY;
    await expect(
      executeGemmaInference({ prompt: 'Hello world' })
    ).rejects.toThrowError(GeminiInferenceError);
  });

  it('executeGemmaInference works with injected client provider even when GEMINI_API_KEY is not set in env', async () => {
    delete process.env.GEMINI_API_KEY;

    const mockResponse = {
      text: 'Inference without env key via injected provider.',
      usageMetadata: {
        promptTokenCount: 10,
        candidatesTokenCount: 5,
        totalTokenCount: 15,
      },
      candidates: [{ finishReason: 'STOP' }],
    };

    setGeminiClientProvider(() => ({
      models: {
        generateContent: vi.fn().mockResolvedValue(mockResponse),
      },
    } as unknown as GoogleGenAI));

    const result = await executeGemmaInference({ prompt: 'Hello' });
    expect(result.text).toBe('Inference without env key via injected provider.');
    expect(result.tokenUsage?.totalTokens).toBe(15);
  });

  it('executeGemmaInference parses model output and token usage correctly when client returns valid response', async () => {
    process.env.GEMINI_API_KEY = 'mock-key';

    const mockResponse = {
      text: 'Verified Gemma 4 answer.',
      usageMetadata: {
        promptTokenCount: 12,
        candidatesTokenCount: 8,
        totalTokenCount: 20,
      },
      candidates: [{ finishReason: 'STOP' }],
    };

    const mockGenerateContent = vi.fn().mockResolvedValue(mockResponse);
    setGeminiClientProvider(() => ({
      models: {
        generateContent: mockGenerateContent,
      },
    } as unknown as GoogleGenAI));

    const result = await executeGemmaInference({
      prompt: 'Test prompt',
      systemInstruction: 'Act as a secure assistant.',
      temperature: 0.1,
      maxOutputTokens: 256,
    });

    expect(result.text).toBe('Verified Gemma 4 answer.');
    expect(result.model).toBe('gemma-4-31b-it');
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result.tokenUsage?.totalTokens).toBe(20);
    expect(result.finishReason).toBe('STOP');
    expect(mockGenerateContent).toHaveBeenCalledWith({
      model: 'gemma-4-31b-it',
      contents: 'Test prompt',
      config: {
        systemInstruction: 'Act as a secure assistant.',
        temperature: 0.1,
        maxOutputTokens: 256,
      },
    });
  });

  it('throws INVALID_MODEL_RESPONSE when model response is null or undefined', async () => {
    setGeminiClientProvider(() => ({
      models: {
        generateContent: vi.fn().mockResolvedValue(null),
      },
    } as unknown as GoogleGenAI));

    await expect(executeGemmaInference({ prompt: 'Test' })).rejects.toMatchObject({
      code: 'INVALID_MODEL_RESPONSE',
      status: 502,
    });
  });

  it('throws INVALID_MODEL_RESPONSE when model prompt is blocked by promptFeedback', async () => {
    setGeminiClientProvider(() => ({
      models: {
        generateContent: vi.fn().mockResolvedValue({
          promptFeedback: { blockReason: 'SAFETY' },
        }),
      },
    } as unknown as GoogleGenAI));

    await expect(executeGemmaInference({ prompt: 'Test' })).rejects.toMatchObject({
      code: 'INVALID_MODEL_RESPONSE',
      status: 422,
    });
  });

  it('throws INVALID_MODEL_RESPONSE when candidate generation is blocked by safety filters', async () => {
    setGeminiClientProvider(() => ({
      models: {
        generateContent: vi.fn().mockResolvedValue({
          candidates: [{ finishReason: 'SAFETY' }],
        }),
      },
    } as unknown as GoogleGenAI));

    await expect(executeGemmaInference({ prompt: 'Test' })).rejects.toMatchObject({
      code: 'INVALID_MODEL_RESPONSE',
      status: 422,
    });
  });

  it('throws INVALID_MODEL_RESPONSE when model returns non-string text structure', async () => {
    setGeminiClientProvider(() => ({
      models: {
        generateContent: vi.fn().mockResolvedValue({
          candidates: [{ finishReason: 'STOP' }],
        }),
      },
    } as unknown as GoogleGenAI));

    await expect(executeGemmaInference({ prompt: 'Test' })).rejects.toMatchObject({
      code: 'INVALID_MODEL_RESPONSE',
      status: 502,
    });
  });

  it('correctly maps upstream rate limits (429 / RESOURCE_EXHAUSTED) to RATE_LIMITED error', async () => {
    process.env.GEMINI_API_KEY = 'mock-key';

    const rateLimitErr = new Error('Resource has been exhausted (e.g. check quota): RESOURCE_EXHAUSTED');
    (rateLimitErr as unknown as { status: number }).status = 429;

    setGeminiClientProvider(() => ({
      models: {
        generateContent: vi.fn().mockRejectedValue(rateLimitErr),
      },
    } as unknown as GoogleGenAI));

    try {
      await executeGemmaInference({ prompt: 'Test' });
      expect.fail('Should have thrown');
    } catch (e) {
      const err = e as GeminiInferenceError;
      expect(err.code).toBe('RATE_LIMITED');
      expect(err.status).toBe(429);
    }
  });

  it('correctly maps invalid API key errors to INVALID_API_KEY (401)', async () => {
    process.env.GEMINI_API_KEY = 'mock-key';

    const invalidKeyErr = new Error('API_KEY_INVALID: API key not valid');
    (invalidKeyErr as unknown as { status: number }).status = 401;

    setGeminiClientProvider(() => ({
      models: {
        generateContent: vi.fn().mockRejectedValue(invalidKeyErr),
      },
    } as unknown as GoogleGenAI));

    try {
      await executeGemmaInference({ prompt: 'Test' });
      expect.fail('Should have thrown');
    } catch (e) {
      const err = e as GeminiInferenceError;
      expect(err.code).toBe('INVALID_API_KEY');
      expect(err.status).toBe(401);
    }
  });

  it('correctly maps 404 / NOT_FOUND to MODEL_NOT_FOUND error', async () => {
    process.env.GEMINI_API_KEY = 'mock-key';

    const notFoundErr = new Error('Model gemma-4-unknown was not found');
    (notFoundErr as unknown as { status: number }).status = 404;

    setGeminiClientProvider(() => ({
      models: {
        generateContent: vi.fn().mockRejectedValue(notFoundErr),
      },
    } as unknown as GoogleGenAI));

    try {
      await executeGemmaInference({ prompt: 'Test', modelId: 'gemma-4-unknown' });
      expect.fail('Should have thrown');
    } catch (e) {
      const err = e as GeminiInferenceError;
      expect(err.code).toBe('MODEL_NOT_FOUND');
      expect(err.status).toBe(404);
    }
  });
});

describe('Route Handler /api/evaluate (app/api/evaluate/route.ts)', () => {
  const originalEnv = process.env.GEMINI_API_KEY;

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.GEMINI_API_KEY = originalEnv;
    } else {
      delete process.env.GEMINI_API_KEY;
    }
    setGeminiClientProvider(null);
    vi.restoreAllMocks();
  });

  describe('Zod Request Validation Schema', () => {
    it('accepts valid evaluation requests', () => {
      const valid = {
        prompt: 'What is TruthFence?',
        systemInstruction: 'Be concise.',
        model: 'gemma-4-31b-it',
        temperature: 0.2,
      };
      const result = EvaluateRequestSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('rejects empty or whitespace-only prompts', () => {
      const result = EvaluateRequestSchema.safeParse({ prompt: '   ' });
      expect(result.success).toBe(false);
    });

    it('rejects prompts exceeding maximum length (10,000 characters)', () => {
      const oversized = 'a'.repeat(10001);
      const result = EvaluateRequestSchema.safeParse({ prompt: oversized });
      expect(result.success).toBe(false);
    });

    it('rejects system instruction exceeding 20,000 characters', () => {
      const oversized = 'a'.repeat(20001);
      const result = EvaluateRequestSchema.safeParse({
        prompt: 'Valid prompt',
        systemInstruction: oversized,
      });
      expect(result.success).toBe(false);
    });

    it('rejects reference document exceeding 40,000 characters', () => {
      const oversized = 'a'.repeat(40001);
      const result = EvaluateRequestSchema.safeParse({
        prompt: 'Valid prompt',
        referenceDocument: oversized,
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid temperature outside 0 to 2 range', () => {
      expect(EvaluateRequestSchema.safeParse({ prompt: 'ok', temperature: -0.1 }).success).toBe(false);
      expect(EvaluateRequestSchema.safeParse({ prompt: 'ok', temperature: 2.5 }).success).toBe(false);
      expect(EvaluateRequestSchema.safeParse({ prompt: 'ok', temperature: 1.0 }).success).toBe(true);
    });

    it('accepts nullish optional fields from JSON callers', () => {
      const result = EvaluateRequestSchema.safeParse({
        prompt: 'Valid prompt',
        systemInstruction: null,
        systemPolicy: null,
        referenceDocument: null,
        referenceDoc: null,
        model: null,
        temperature: null,
        maxOutputTokens: null,
      });
      expect(result.success).toBe(true);
    });

    it('validates maxOutputTokens boundaries', () => {
      expect(EvaluateRequestSchema.safeParse({ prompt: 'ok', maxOutputTokens: 512 }).success).toBe(true);
      expect(EvaluateRequestSchema.safeParse({ prompt: 'ok', maxOutputTokens: 0 }).success).toBe(false);
      expect(EvaluateRequestSchema.safeParse({ prompt: 'ok', maxOutputTokens: -10 }).success).toBe(false);
      expect(EvaluateRequestSchema.safeParse({ prompt: 'ok', maxOutputTokens: 10000 }).success).toBe(false);
      expect(EvaluateRequestSchema.safeParse({ prompt: 'ok', maxOutputTokens: 12.5 }).success).toBe(false);
    });
  });

  describe('GET /api/evaluate', () => {
    it('returns endpoint readiness and supported model list', async () => {
      delete process.env.GEMINI_API_KEY;
      const res = await evaluateGET();
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.endpoint).toBe('/api/evaluate');
      expect(json.status).toBe('ready');
      expect(json.hasApiKey).toBe(false);
      expect(json.defaultModel).toBe('gemma-4-31b-it');
      expect(json.supportedModels).toBeInstanceOf(Array);
      expect(json.supportedModels.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('POST /api/evaluate', () => {
    it('returns 400 when request body contains invalid JSON', async () => {
      const req = new NextRequest('http://localhost:3000/api/evaluate', {
        method: 'POST',
        body: 'invalid-non-json-body{{{',
        headers: { 'content-type': 'application/json' },
      });

      const res = await evaluatePOST(req);
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.code).toBe('INVALID_REQUEST');
      expect(json.error).toContain('Malformed request body');
    });

    it('returns 400 when request body fails Zod validation', async () => {
      const req = new NextRequest('http://localhost:3000/api/evaluate', {
        method: 'POST',
        body: JSON.stringify({ prompt: '' }),
        headers: { 'content-type': 'application/json' },
      });

      const res = await evaluatePOST(req);
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.code).toBe('INVALID_REQUEST');
      expect(json.issues).toBeDefined();
    });

    it('returns 401 when GEMINI_API_KEY is missing without exposing internal secrets', async () => {
      delete process.env.GEMINI_API_KEY;

      const req = new NextRequest('http://localhost:3000/api/evaluate', {
        method: 'POST',
        body: JSON.stringify({ prompt: 'Test evaluate prompt' }),
        headers: { 'content-type': 'application/json' },
      });

      const res = await evaluatePOST(req);
      expect(res.status).toBe(401);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.code).toBe('MISSING_API_KEY');
      expect(json.error).toContain('GEMINI_API_KEY is not configured');

      // Verify no sensitive keys or internal stack traces leaked
      const stringified = JSON.stringify(json);
      expect(stringified).not.toContain('stack');
      expect(stringified).not.toContain('AIzaSy');
    });

    it('returns 200 with documented JSON response contract when inference succeeds', async () => {
      process.env.GEMINI_API_KEY = 'mock-key';

      setGeminiClientProvider(() => ({
        models: {
          generateContent: vi.fn().mockResolvedValue({
            text: 'Inference test output from Gemma 4.',
            usageMetadata: {
              promptTokenCount: 15,
              candidatesTokenCount: 10,
              totalTokenCount: 25,
            },
            candidates: [{ finishReason: 'STOP' }],
          }),
        },
      } as unknown as GoogleGenAI));

      const req = new NextRequest('http://localhost:3000/api/evaluate', {
        method: 'POST',
        body: JSON.stringify({
          prompt: 'Identify the canary token.',
          systemInstruction: 'You are a test evaluator.',
          referenceDocument: 'Document content here.',
        }),
        headers: { 'content-type': 'application/json' },
      });

      const res = await evaluatePOST(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.model).toBe('gemma-4-31b-it');
      expect(json.text).toBe('Inference test output from Gemma 4.');
      expect(typeof json.latencyMs).toBe('number');
      expect(json.tokenUsage).toEqual({
        promptTokens: 15,
        candidatesTokens: 10,
        totalTokens: 25,
      });
      expect(json.finishReason).toBe('STOP');
    });

    it('passes maxOutputTokens to executeGemmaInference and returns 200', async () => {
      process.env.GEMINI_API_KEY = 'mock-key';

      const mockGenerateContent = vi.fn().mockResolvedValue({
        text: 'Bounded tokens response.',
        candidates: [{ finishReason: 'STOP' }],
      });

      setGeminiClientProvider(() => ({
        models: {
          generateContent: mockGenerateContent,
        },
      } as unknown as GoogleGenAI));

      const req = new NextRequest('http://localhost:3000/api/evaluate', {
        method: 'POST',
        body: JSON.stringify({
          prompt: 'Test prompt with max tokens',
          maxOutputTokens: 256,
        }),
        headers: { 'content-type': 'application/json' },
      });

      const res = await evaluatePOST(req);
      expect(res.status).toBe(200);
      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            maxOutputTokens: 256,
          }),
        })
      );
    });

    it('handles INVALID_MODEL_RESPONSE with 502 status and code', async () => {
      process.env.GEMINI_API_KEY = 'mock-key';

      setGeminiClientProvider(() => ({
        models: {
          generateContent: vi.fn().mockResolvedValue(null),
        },
      } as unknown as GoogleGenAI));

      const req = new NextRequest('http://localhost:3000/api/evaluate', {
        method: 'POST',
        body: JSON.stringify({ prompt: 'Hello Gemma 4' }),
        headers: { 'content-type': 'application/json' },
      });

      const res = await evaluatePOST(req);
      expect(res.status).toBe(502);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.code).toBe('INVALID_MODEL_RESPONSE');
    });

    it('handles upstream rate limits with 429 response status and safe error code', async () => {
      process.env.GEMINI_API_KEY = 'mock-key';

      const rateLimitErr = new Error('Quota exceeded 429');
      (rateLimitErr as unknown as { status: number }).status = 429;

      setGeminiClientProvider(() => ({
        models: {
          generateContent: vi.fn().mockRejectedValue(rateLimitErr),
        },
      } as unknown as GoogleGenAI));

      const req = new NextRequest('http://localhost:3000/api/evaluate', {
        method: 'POST',
        body: JSON.stringify({ prompt: 'Hello Gemma 4' }),
        headers: { 'content-type': 'application/json' },
      });

      const res = await evaluatePOST(req);
      expect(res.status).toBe(429);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.code).toBe('RATE_LIMITED');
    });

    it('sanitizes unexpected errors and redacts credentials in 502 responses', async () => {
      process.env.GEMINI_API_KEY = 'mock-key';

      const unexpectedErr = new Error('Unexpected crash at https://api.internal/v1?key=AIzaFakeSecret12345678901234567890123');
      setGeminiClientProvider(() => ({
        models: {
          generateContent: vi.fn().mockRejectedValue(unexpectedErr),
        },
      } as unknown as GoogleGenAI));

      const req = new NextRequest('http://localhost:3000/api/evaluate', {
        method: 'POST',
        body: JSON.stringify({ prompt: 'Trigger error' }),
        headers: { 'content-type': 'application/json' },
      });

      const res = await evaluatePOST(req);
      expect(res.status).toBe(502);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.code).toBe('UPSTREAM_FAILURE');
      expect(json.error).not.toContain('AIzaFakeSecret12345678901234567890123');
      expect(json.error).toContain('[REDACTED_API_KEY]');
    });
  });
});
