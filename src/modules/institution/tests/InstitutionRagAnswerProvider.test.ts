import { describe, expect, it, vi } from 'vitest';
import {
  createInstitutionDryRunAiChatProvider,
  createInstitutionOpenAiCompatibleChatProvider,
  createInstitutionRagAnswerProviderResolver,
} from '@/modules/institution/server/institution-rag-answer-provider';

const sensitiveFragments = [
  'api_key',
  'DATABASE_URL',
  'postgres://',
  'secret',
  'password',
  'Bearer',
  'Authorization',
  'baseUrl',
  'model',
  'vendor',
];

const encryptedApiKey = {
  version: 1,
  algorithm: 'aes-256-gcm',
  iv: 'iv',
  ciphertext: 'ciphertext',
  tag: 'tag',
};

vi.mock('@/modules/security/server/secretEncryption', () => ({
  decryptSecret: vi.fn(() => 'resolved-api-key'),
}));

function expectNoSensitiveFields(payload: unknown) {
  const serialized = JSON.stringify(payload);
  sensitiveFragments.forEach((fragment) => {
    expect(serialized).not.toContain(fragment);
  });
}

describe('机构端 RAG answer provider contract', () => {
  it('mock / dry-run provider 能基于 messages 返回受控答案和 usage', async () => {
    const provider = createInstitutionDryRunAiChatProvider({ latencyMs: 12 });

    const result = await provider.chat({
      messages: [
        { role: 'system', content: '只能基于召回片段回答。' },
        { role: 'user', content: '问题：术后冷敷注意事项？\n\n召回片段：冷敷每次15-20分钟。' },
      ],
      temperature: 0,
      maxTokens: 800,
      timeoutMs: 8_000,
    });

    expect(result.status).toBe('success');
    expect(result.answerText).toContain('当前基于机构知识库召回片段生成受控问答草稿');
    expect(result.answerText).toContain('术后冷敷注意事项？');
    expect(result.usage?.inputTokens).toBeGreaterThan(0);
    expect(result.usage?.outputTokens).toBeGreaterThan(0);
    expect(result.latencyMs).toBe(12);
    expectNoSensitiveFields(result);
  });

  it('mock / dry-run provider 可返回低敏不可用状态', async () => {
    const provider = createInstitutionDryRunAiChatProvider({
      status: 'provider_unavailable',
      errorCode: 'dry_run_provider_unavailable',
      latencyMs: 8,
    });

    const result = await provider.chat({
      messages: [{ role: 'user', content: '问题：冷敷？' }],
    });

    expect(result).toEqual({
      status: 'provider_unavailable',
      errorCode: 'dry_run_provider_unavailable',
      latencyMs: 8,
    });
    expectNoSensitiveFields(result);
  });

  it('OpenAI-compatible provider 使用注入 fetch 并解析成功响应', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      choices: [{ message: { content: '基于引用片段回答。' } }],
      usage: { prompt_tokens: 31, completion_tokens: 7, total_tokens: 38 },
    }), { status: 200 }));
    const provider = createInstitutionOpenAiCompatibleChatProvider({
      config: {
        baseUrl: 'https://provider.example/v1/',
        model: 'provider-model-a',
        apiKey: 'secret-api-key',
      },
      fetchImpl,
    });

    const result = await provider.chat({
      messages: [{ role: 'user', content: '问题：冷敷？' }],
      temperature: 0,
      maxTokens: 800,
      timeoutMs: 8_000,
    });

    expect(result.status).toBe('success');
    expect(result.answerText).toBe('基于引用片段回答。');
    expect(result.usage).toEqual({ inputTokens: 31, outputTokens: 7 });
    expect(fetchImpl).toHaveBeenCalledWith('https://provider.example/v1/chat/completions', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ Authorization: 'Bearer secret-api-key' }),
    }));
    expectNoSensitiveFields(result);
  });

  it('OpenAI-compatible provider HTTP failure 返回低敏 provider_unavailable', async () => {
    const fetchImpl = vi.fn(async () => new Response('DATABASE_URL secret stack', { status: 500 }));
    const provider = createInstitutionOpenAiCompatibleChatProvider({
      config: {
        baseUrl: 'https://provider.example/v1',
        model: 'provider-model-a',
        apiKey: 'secret-api-key',
      },
      fetchImpl,
    });

    const result = await provider.chat({ messages: [{ role: 'user', content: '问题：冷敷？' }] });

    expect(result.status).toBe('provider_unavailable');
    expect(result.errorCode).toBe('http_error');
    expectNoSensitiveFields(result);
  });

  it('OpenAI-compatible provider malformed response 返回低敏 service_unavailable', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ choices: [] }), { status: 200 }));
    const provider = createInstitutionOpenAiCompatibleChatProvider({
      config: {
        baseUrl: 'https://provider.example/v1',
        model: 'provider-model-a',
        apiKey: 'secret-api-key',
      },
      fetchImpl,
    });

    const result = await provider.chat({ messages: [{ role: 'user', content: '问题：冷敷？' }] });

    expect(result.status).toBe('service_unavailable');
    expect(result.errorCode).toBe('malformed_response');
    expectNoSensitiveFields(result);
  });

  it('provider resolver 处理 missing config 和 disabled config', async () => {
    const missingResolver = createInstitutionRagAnswerProviderResolver({
      repository: { findVendorConfig: vi.fn(async () => null) },
      vendor: 'deepseek',
    });
    await expect(missingResolver.resolve()).resolves.toEqual({
      status: 'provider_disabled',
      providerStatus: 'missing_config',
    });

    const disabledResolver = createInstitutionRagAnswerProviderResolver({
      repository: {
        findVendorConfig: vi.fn(async () => ({
          baseUrl: 'https://provider.example/v1',
          model: 'provider-model-a',
          encryptedApiKey,
          configured: false,
        })),
      },
      vendor: 'deepseek',
    });
    await expect(disabledResolver.resolve()).resolves.toEqual({
      status: 'provider_disabled',
      providerStatus: 'disabled',
    });
  });
});
