import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST as answerPost } from '@/app/api/institution/knowledge-management/answer/route';
import { getDatabase } from '@/server/db/client';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';
import { createPlatformKnowledgeManagementRepository } from '@/modules/open-platform/server/platform-knowledge-management-repository';
import { createAiCallUsageRepository } from '@/modules/institution/server/institution-ai-call-usage-repository';
import { answerInstitutionKnowledgeRagQuestion } from '@/modules/institution/server/institution-knowledge-rag-answer-service';

const database = { database: 'knowledge-answer-api-test-db' };

vi.mock('@/server/db/client', () => ({
  getDatabase: vi.fn(() => database),
}));

vi.mock('@/modules/security/server/access-context', () => ({
  getDemoAccessContextFromRequest: vi.fn(),
}));

vi.mock('@/modules/open-platform/server/platform-knowledge-management-repository', () => ({
  createPlatformKnowledgeManagementRepository: vi.fn(() => ({ repository: 'knowledge-answer-repository' })),
}));

vi.mock('@/modules/institution/server/institution-ai-call-usage-repository', () => ({
  createAiCallUsageRepository: vi.fn(() => ({ usageRepository: 'knowledge-answer-usage-repository' })),
}));

vi.mock('@/modules/institution/server/tenant-quota-enforcement', () => ({
  checkTenantQuotaForCreate: vi.fn(async () => ({ allowed: true })),
}));

vi.mock('@/modules/institution/server/institution-ai-call-service', () => ({
  getDefaultAiVendor: vi.fn(() => 'deepseek'),
  recordAiCallQuotaRejection: vi.fn(async () => undefined),
  recordKnowledgeRagAnswerUsageSuccess: vi.fn(async () => undefined),
}));

vi.mock('@/modules/institution/server/institution-rag-answer-provider', () => ({
  createInstitutionRagAnswerProviderResolver: vi.fn(() => ({ resolve: vi.fn() })),
}));

vi.mock('@/modules/institution/server/institution-knowledge-rag-answer-service', async () => {
  const actual = await vi.importActual<
    typeof import('@/modules/institution/server/institution-knowledge-rag-answer-service')
  >('@/modules/institution/server/institution-knowledge-rag-answer-service');
  return {
    ...actual,
    answerInstitutionKnowledgeRagQuestion: vi.fn(),
  };
});

const tenantContext = {
  userId: 'demo-user-admin',
  role: 'tenant_admin' as const,
  scope: 'tenant' as const,
  tenantId: 'demo-tenant-001',
  institutionId: 'demo-inst-001',
  source: 'demo_session' as const,
};

const platformContext = {
  userId: 'demo-user-platform',
  role: 'platform_admin' as const,
  scope: 'platform' as const,
  tenantId: null,
  institutionId: null,
  source: 'demo_session' as const,
};

const sources = [
  {
    knowledgeId: 'knowledge-a',
    knowledgeTitle: '术后护理指南',
    fileId: 'file-a',
    fileName: '护理手册.txt',
    chunkId: 'chunk-a',
    chunkIndex: 0,
    textPreview: '术后冷敷应每次15-20分钟。',
    retrievalMode: 'keyword' as const,
    matchReason: '包含“冷敷”',
  },
];

const sensitiveFragments = [
  'api_key',
  'DATABASE_URL',
  'postgres://',
  'secret',
  'password',
  'Bearer',
  'Authorization',
  'baseUrl',
  'provider config',
  'model',
  'vendor',
  'cost',
  'usage',
  'latencyMs',
  'errorCode',
  'messages',
  'prompt',
  'Token',
];

function createRequest(body: unknown) {
  return new Request('http://localhost/api/institution/knowledge-management/answer', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function expectNoSensitiveFields(payload: unknown) {
  const serialized = JSON.stringify(payload);
  sensitiveFragments.forEach((fragment) => {
    expect(serialized).not.toContain(fragment);
  });
  expect(serialized).not.toContain('问题：');
  expect(serialized).not.toContain('召回片段：');
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('机构端知识库 RAG answer API route', () => {
  it('未登录返回 401', async () => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(null);

    const response = await answerPost(createRequest({ question: '冷敷？' }));

    expect(response.status).toBe(401);
  });

  it('非机构 tenant scope 返回 403', async () => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(platformContext);

    const response = await answerPost(createRequest({ question: '冷敷？' }));

    expect(response.status).toBe(403);
  });

  it('scope 为 tenant 但缺少 institutionId 返回 403', async () => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue({ ...tenantContext, institutionId: null });

    const response = await answerPost(createRequest({ question: '冷敷？' }));

    expect(response.status).toBe(403);
  });


  it('禁止机构端选择 provider / model / vendor', async () => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(tenantContext);

    const response = await answerPost(createRequest({ question: '冷敷？', provider: 'evil', model: 'evil-model' }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe('INSTITUTION_AI_MODEL_SELECTION_FORBIDDEN');
    expect(answerInstitutionKnowledgeRagQuestion).not.toHaveBeenCalled();
    expectNoSensitiveFields(body);
  });

  it('机构账号成功问答，只使用 accessContext 的 tenantId/institutionId', async () => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(tenantContext);
    vi.mocked(answerInstitutionKnowledgeRagQuestion).mockResolvedValue({
      status: 'answered',
      answer: '基于片段回答。仅供内部运营参考，需人工确认',
      sources,
    });

    const response = await answerPost(createRequest({
      question: '术后冷敷注意事项？',
      topK: 5,
      tenantId: 'evil-tenant',
      institutionId: 'evil-inst',
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      status: 'answered',
      answer: '基于片段回答。仅供内部运营参考，需人工确认',
      sources,
    });
    expect(getDatabase).toHaveBeenCalledTimes(1);
    expect(createPlatformKnowledgeManagementRepository).toHaveBeenCalledWith(database);
    expect(createAiCallUsageRepository).toHaveBeenCalledWith(database);
    expect(answerInstitutionKnowledgeRagQuestion).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'demo-tenant-001',
      institutionId: 'demo-inst-001',
      question: '术后冷敷注意事项？',
      topK: 5,
      repository: { repository: 'knowledge-answer-repository' },
      providerResolver: expect.objectContaining({ resolve: expect.any(Function) }),
      quota: expect.objectContaining({
        check: expect.any(Function),
        onRejected: expect.any(Function),
      }),
      usageRecorder: expect.any(Function),
      actorUserId: 'demo-user-admin',
    }));
    expectNoSensitiveFields(body);
  });

  it('validation_failed 返回 400', async () => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(tenantContext);
    vi.mocked(answerInstitutionKnowledgeRagQuestion).mockResolvedValue({
      status: 'validation_failed',
      answer: '仅供内部运营参考，需人工确认',
      sources: [],
      message: '问题不能为空',
    });

    const response = await answerPost(createRequest({ question: '' }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.status).toBe('validation_failed');
    expect(body.message).toBe('问题不能为空');
    expectNoSensitiveFields(body);
  });

  it('no_answer 返回 noAnswerReason 且不泄露内部信息', async () => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(tenantContext);
    vi.mocked(answerInstitutionKnowledgeRagQuestion).mockResolvedValue({
      status: 'no_answer',
      answer: '未在当前知识库中找到足够依据。仅供内部运营参考，需人工确认',
      sources: [],
      noAnswerReason: 'no_retrieval_hit',
    });

    const response = await answerPost(createRequest({ question: '未知问题', topK: 3 }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      status: 'no_answer',
      answer: '未在当前知识库中找到足够依据。仅供内部运营参考，需人工确认',
      sources: [],
      noAnswerReason: 'no_retrieval_hit',
    });
    expectNoSensitiveFields(body);
  });


  it('quota_exceeded 低敏返回', async () => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(tenantContext);
    vi.mocked(answerInstitutionKnowledgeRagQuestion).mockResolvedValue({
      status: 'quota_exceeded',
      answer: 'AI 调用次数已达到当前套餐上限，请联系平台管理员调整套餐。仅供内部运营参考，需人工确认',
      sources,
      message: 'AI 调用次数已达到当前套餐上限，请联系平台管理员调整套餐',
    });

    const response = await answerPost(createRequest({ question: '冷敷？' }));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.status).toBe('quota_exceeded');
    expectNoSensitiveFields(body);
  });

  it('provider failure 低敏返回，不返回 prompt、模型、token、成本或厂商', async () => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(tenantContext);
    vi.mocked(answerInstitutionKnowledgeRagQuestion).mockResolvedValue({
      status: 'provider_failure',
      answer: '知识库问答服务暂时不可用，请稍后重试。仅供内部运营参考，需人工确认',
      sources,
      message: '知识库问答服务暂时不可用，请稍后重试',
    });

    const response = await answerPost(createRequest({ question: '冷敷？' }));
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.status).toBe('provider_failure');
    expect(body.answer).toContain('知识库问答服务暂时不可用');
    expectNoSensitiveFields(body);
  });

  it('service 异常时返回 503 且不泄露内部信息', async () => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(tenantContext);
    vi.mocked(answerInstitutionKnowledgeRagQuestion).mockRejectedValue(
      new Error('DATABASE_URL postgres://root:password@localhost secret=key prompt model token cost vendor stack'),
    );

    const response = await answerPost(createRequest({ question: '冷敷？' }));
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.status).toBe('service_unavailable');
    expect(body.answer).toBe('知识库问答服务暂时不可用，请稍后重试。仅供内部运营参考，需人工确认');
    expectNoSensitiveFields(body);
  });
});
