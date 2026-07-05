import { describe, expect, it } from 'vitest';
import { createInstitutionDryRunAiChatProvider } from '@/modules/institution/server/institution-rag-answer-provider';

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
});
