import { describe, expect, it, vi } from 'vitest';
import {
  KNOWLEDGE_AI_PROVIDER_MESSAGES,
  buildSafeKnowledgeAiProviderInput,
  generateKnowledgeAiProviderAnswer,
  getDefaultKnowledgeAiProvider,
  getKnowledgeAiProviderRegistry,
  type KnowledgeAiProvider,
} from '@/modules/open-platform/server/platform-knowledge-ai-provider-adapter';

const deniedFragments = [
  'storageKey',
  '/Users/',
  'textContent',
  'rawContent',
  'parsedContent',
  'embeddingVectorJson',
  'SQL',
  'stack',
  'token',
  'secret',
  'DATABASE_URL',
  'prompt',
  'system prompt',
  '真实 AI 原始响应',
];

function expectSafePayload(payload: unknown) {
  const serialized = JSON.stringify(payload);
  deniedFragments.forEach((fragment) => {
    expect(serialized).not.toContain(fragment);
  });
}

describe('知识库 AI provider 安全适配层', () => {
  it('默认使用 mock/local provider，真实 provider 占位默认 disabled 且有中文原因和进入条件', () => {
    const registry = getKnowledgeAiProviderRegistry();
    const defaultProvider = getDefaultKnowledgeAiProvider();

    expect(defaultProvider.providerId).toBe('mockLocalProvider');
    expect(defaultProvider.enabled).toBe(true);
    expect(defaultProvider.status).toBe('enabled');
    expect(registry.map((provider) => provider.providerId)).toEqual([
      'mockLocalProvider',
      'realAiProvider',
      'openaiCompatibleProvider',
      'enterpriseModelGateway',
    ]);

    registry
      .filter((provider) => provider.providerId !== 'mockLocalProvider')
      .forEach((provider) => {
        expect(provider.enabled).toBe(false);
        expect(provider.status).toBe('disabled');
        expect(provider.disabledReason).toMatch(/未启用|未接入|尚未/);
        expect(provider.entryCondition).toMatch(/评审|审批|验收|密钥治理/);
      });
    expect(JSON.stringify(registry)).not.toContain('真实 AI 已可用');
  });

  it('provider 输入只保留 question、retrievalMode、治理范围和 citation 低敏字段', () => {
    const input = buildSafeKnowledgeAiProviderInput({
      tenantId: 'tenant-a',
      institutionId: 'inst-a',
      question: '冷敷后怎么护理？',
      retrievalMode: 'hybrid',
      citations: [
        {
          knowledgeId: 'knowledge-a',
          knowledgeTitle: '术后护理知识库',
          fileId: 'file-a',
          fileName: '护理说明.txt',
          chunkId: 'chunk-a-0',
          chunkIndex: 0,
          textPreview: '术后护理需要冷敷，避免暴晒。',
          score: 0.98,
          matchReason: '关键词命中',
          storageKey: '/Users/local/private/raw.txt',
          textContent: '完整正文不得进入 provider',
          rawContent: '原始全文不得进入 provider',
          parsedContent: '解析全文不得进入 provider',
          embeddingVectorJson: [0.1, 0.2],
          SQL: 'select * from secrets',
          token: 'secret-token',
          secret: 'secret-value',
          prompt: '内部完整 prompt',
        },
      ],
      prompt: 'system prompt 不得进入 provider',
      DATABASE_URL: 'postgres://local',
    });

    expect(input).toEqual({
      tenantId: 'tenant-a',
      institutionId: 'inst-a',
      question: '冷敷后怎么护理？',
      retrievalMode: 'hybrid',
      citations: [
        {
          knowledgeId: 'knowledge-a',
          knowledgeTitle: '术后护理知识库',
          fileId: 'file-a',
          fileName: '护理说明.txt',
          chunkId: 'chunk-a-0',
          chunkIndex: 0,
          textPreview: '术后护理需要冷敷，避免暴晒。',
          score: 0.98,
          matchReason: '关键词命中',
        },
      ],
    });
    expectSafePayload(input);
  });

  it('mock/local provider 生成带 citations 的安全回答且不调用外部网络', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const provider = getDefaultKnowledgeAiProvider();
    const input = buildSafeKnowledgeAiProviderInput({
      tenantId: 'tenant-a',
      institutionId: null,
      question: '冷敷后怎么护理？',
      retrievalMode: 'keyword',
      citations: [
        {
          knowledgeId: 'knowledge-a',
          knowledgeTitle: '术后护理知识库',
          fileId: 'file-a',
          fileName: '护理说明.txt',
          chunkId: 'chunk-a-0',
          chunkIndex: 0,
          textPreview: '术后护理需要冷敷，避免暴晒。',
          score: 1,
          matchReason: '关键词命中',
        },
      ],
    });

    const result = await generateKnowledgeAiProviderAnswer(provider, input);

    expect(result).toEqual(
      expect.objectContaining({
        providerId: 'mockLocalProvider',
        answer: expect.stringContaining('基于已召回的知识片段'),
        citations: input.citations,
        safeStatus: 'answered',
      }),
    );
    expectSafePayload(result);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('禁用 provider 返回中文安全文案，provider 输出会清洗 system prompt 和真实模型原始响应', async () => {
    const disabledProvider = getKnowledgeAiProviderRegistry().find(
      (provider) => provider.providerId === 'realAiProvider',
    );
    const unsafeProvider: KnowledgeAiProvider = {
      providerId: 'mockLocalProvider',
      displayName: '测试 provider',
      enabled: true,
      status: 'enabled',
      disabledReason: null,
      entryCondition: null,
      generateAnswer: vi.fn(async () => ({
        answer: 'system prompt: 不应返回。真实 AI 原始响应：不应返回。安全答案。',
      })),
    };
    const input = buildSafeKnowledgeAiProviderInput({
      tenantId: 'tenant-a',
      institutionId: null,
      question: '冷敷后怎么护理？',
      retrievalMode: 'keyword',
      citations: [
        {
          knowledgeId: 'knowledge-a',
          knowledgeTitle: '术后护理知识库',
          fileId: 'file-a',
          fileName: '护理说明.txt',
          chunkId: 'chunk-a-0',
          chunkIndex: 0,
          textPreview: '术后护理需要冷敷，避免暴晒。',
          score: 1,
          matchReason: '关键词命中',
        },
      ],
    });

    expect(disabledProvider).toBeDefined();
    await expect(generateKnowledgeAiProviderAnswer(disabledProvider!, input)).resolves.toEqual(
      expect.objectContaining({
        providerId: 'realAiProvider',
        answer: KNOWLEDGE_AI_PROVIDER_MESSAGES.providerDisabled,
        safeStatus: 'provider_disabled',
      }),
    );

    const sanitized = await generateKnowledgeAiProviderAnswer(unsafeProvider, input);
    expect(sanitized.answer).toBe(KNOWLEDGE_AI_PROVIDER_MESSAGES.providerUnavailable);
    expectSafePayload(sanitized);
  });
});
