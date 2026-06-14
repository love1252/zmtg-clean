import type {
  KnowledgeQaCitationDto,
  KnowledgeQaRetrievalMode,
} from '@/modules/open-platform/server/platform-knowledge-qa-service';

export type KnowledgeAiProviderId =
  | 'mockLocalProvider'
  | 'realAiProvider'
  | 'openaiCompatibleProvider'
  | 'enterpriseModelGateway';

export type KnowledgeAiProviderStatus = 'enabled' | 'disabled';
export type KnowledgeAiProviderSafeStatus = 'answered' | 'provider_disabled' | 'provider_unavailable' | 'unsafe_input';

export type SafeKnowledgeAiProviderCitation = Pick<
  KnowledgeQaCitationDto,
  | 'knowledgeId'
  | 'knowledgeTitle'
  | 'fileId'
  | 'fileName'
  | 'chunkId'
  | 'chunkIndex'
  | 'textPreview'
  | 'score'
  | 'matchReason'
>;

export type SafeKnowledgeAiProviderInput = {
  tenantId: string;
  institutionId: string | null;
  question: string;
  retrievalMode: KnowledgeQaRetrievalMode;
  citations: SafeKnowledgeAiProviderCitation[];
};

export type KnowledgeAiProviderRawOutput = {
  answer?: string | null;
};

export type KnowledgeAiProviderAnswer = {
  providerId: KnowledgeAiProviderId;
  answer: string;
  citations: SafeKnowledgeAiProviderCitation[];
  safeStatus: KnowledgeAiProviderSafeStatus;
};

export type KnowledgeAiProvider = {
  providerId: KnowledgeAiProviderId;
  displayName: string;
  enabled: boolean;
  status: KnowledgeAiProviderStatus;
  disabledReason: string | null;
  entryCondition: string | null;
  generateAnswer(input: SafeKnowledgeAiProviderInput): Promise<KnowledgeAiProviderRawOutput>;
};

export const KNOWLEDGE_AI_PROVIDER_MESSAGES = {
  providerDisabled: '真实 AI 服务尚未启用，当前使用受控本地问答能力',
  providerUnavailable: '知识库智能问答服务暂时不可用',
  unsafeInput: '知识库问答内容未通过安全检查',
  noCitation: '当前授权范围内没有召回可引用的知识片段，暂不能给出知识库回答。',
};

const deniedProviderFragments = [
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

function optionalString(value: unknown) {
  const normalized = String(value ?? '').trim();
  return normalized ? normalized : null;
}

function requiredString(value: unknown) {
  return String(value ?? '').trim();
}

function requiredNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function hasDeniedFragment(value: unknown) {
  const serialized = JSON.stringify(value);
  return deniedProviderFragments.some((fragment) => serialized.includes(fragment));
}

function safeCitation(citation: Record<string, unknown>): SafeKnowledgeAiProviderCitation {
  return {
    knowledgeId: requiredString(citation.knowledgeId),
    knowledgeTitle: requiredString(citation.knowledgeTitle),
    fileId: requiredString(citation.fileId),
    fileName: requiredString(citation.fileName),
    chunkId: requiredString(citation.chunkId),
    chunkIndex: requiredNumber(citation.chunkIndex),
    textPreview: requiredString(citation.textPreview).slice(0, 600),
    score: requiredNumber(citation.score),
    matchReason: requiredString(citation.matchReason).slice(0, 120),
  };
}

function composeLocalAnswer(citations: SafeKnowledgeAiProviderCitation[]) {
  if (citations.length === 0) return KNOWLEDGE_AI_PROVIDER_MESSAGES.noCitation;

  const summary = citations
    .slice(0, 3)
    .map((citation, index) => `${index + 1}. ${citation.textPreview}`)
    .join(' ');

  return `基于已召回的知识片段：${summary}`;
}

const mockLocalProvider: KnowledgeAiProvider = {
  providerId: 'mockLocalProvider',
  displayName: 'mock/local provider',
  enabled: true,
  status: 'enabled',
  disabledReason: null,
  entryCondition: null,
  generateAnswer: async (input) => ({
    answer: composeLocalAnswer(input.citations),
  }),
};

const disabledProviders: KnowledgeAiProvider[] = [
  {
    providerId: 'realAiProvider',
    displayName: '真实 AI provider',
    enabled: false,
    status: 'disabled',
    disabledReason: '真实 AI 未启用，未接入真实第三方 AI。',
    entryCondition: '完成真实 AI 接入方案评审、密钥治理、安全策略、成本限额和 QA 质量验收后再开启。',
    generateAnswer: async () => ({ answer: KNOWLEDGE_AI_PROVIDER_MESSAGES.providerDisabled }),
  },
  {
    providerId: 'openaiCompatibleProvider',
    displayName: 'OpenAI compatible provider',
    enabled: false,
    status: 'disabled',
    disabledReason: '尚未启用 OpenAI compatible provider，未读取真实密钥，未调用外部网络。',
    entryCondition: '完成 provider 协议评审、密钥治理、网络出口审批和质量验收后再开启。',
    generateAnswer: async () => ({ answer: KNOWLEDGE_AI_PROVIDER_MESSAGES.providerDisabled }),
  },
  {
    providerId: 'enterpriseModelGateway',
    displayName: '企业模型网关',
    enabled: false,
    status: 'disabled',
    disabledReason: '尚未接入企业模型网关，当前不访问任何外部模型服务。',
    entryCondition: '完成企业网关方案评审、租户隔离、审计、限流和验收后再开启。',
    generateAnswer: async () => ({ answer: KNOWLEDGE_AI_PROVIDER_MESSAGES.providerDisabled }),
  },
];

export function getKnowledgeAiProviderRegistry() {
  return [mockLocalProvider, ...disabledProviders];
}

export function getDefaultKnowledgeAiProvider() {
  return mockLocalProvider;
}

export function buildSafeKnowledgeAiProviderInput(input: {
  tenantId?: unknown;
  institutionId?: unknown;
  question?: unknown;
  retrievalMode?: unknown;
  citations?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}): SafeKnowledgeAiProviderInput {
  const retrievalMode =
    input.retrievalMode === 'keyword' || input.retrievalMode === 'vector' || input.retrievalMode === 'hybrid'
      ? input.retrievalMode
      : 'hybrid';

  return {
    tenantId: requiredString(input.tenantId),
    institutionId: optionalString(input.institutionId),
    question: requiredString(input.question).slice(0, 512),
    retrievalMode,
    citations: (input.citations ?? []).map(safeCitation),
  };
}

export async function generateKnowledgeAiProviderAnswer(
  provider: KnowledgeAiProvider,
  input: SafeKnowledgeAiProviderInput,
): Promise<KnowledgeAiProviderAnswer> {
  if (hasDeniedFragment(input)) {
    return {
      providerId: provider.providerId,
      answer: KNOWLEDGE_AI_PROVIDER_MESSAGES.unsafeInput,
      citations: input.citations,
      safeStatus: 'unsafe_input',
    };
  }

  if (!provider.enabled || provider.status === 'disabled') {
    return {
      providerId: provider.providerId,
      answer: KNOWLEDGE_AI_PROVIDER_MESSAGES.providerDisabled,
      citations: input.citations,
      safeStatus: 'provider_disabled',
    };
  }

  try {
    const rawOutput = await provider.generateAnswer(input);
    const answer = requiredString(rawOutput.answer);
    if (!answer || hasDeniedFragment(answer)) {
      return {
        providerId: provider.providerId,
        answer: KNOWLEDGE_AI_PROVIDER_MESSAGES.providerUnavailable,
        citations: input.citations,
        safeStatus: 'provider_unavailable',
      };
    }

    return {
      providerId: provider.providerId,
      answer,
      citations: input.citations,
      safeStatus: 'answered',
    };
  } catch {
    return {
      providerId: provider.providerId,
      answer: KNOWLEDGE_AI_PROVIDER_MESSAGES.providerUnavailable,
      citations: input.citations,
      safeStatus: 'provider_unavailable',
    };
  }
}
