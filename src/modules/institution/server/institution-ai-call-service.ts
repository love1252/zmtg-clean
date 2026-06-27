import { randomUUID } from 'node:crypto';
import { decryptSecret } from '@/modules/security/server/secretEncryption';
import type { EncryptedSecretEnvelope } from '@/modules/security/server/secretEncryption';

export type AiCallUsageStatus = 'succeeded' | 'failed' | 'sensitive_input_rejected' | 'rate_limited' | 'provider_unavailable' | 'rejected';

export type AiCallUsageRecord = {
  id: string;
  tenantId: string;
  institutionId: string | null;
  actorUserId: string;
  provider: string;
  model: string;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  latencyMs: number | null;
  status: AiCallUsageStatus;
  errorCode: string | null;
  createdAt: Date;
};

export type AiCallUsageDto = Omit<AiCallUsageRecord, 'createdAt'> & {
  createdAt: string;
};

export type InstitutionAiCallResult = {
  status: 'created' | 'validation_failed' | 'not_found' | 'sensitive_input_rejected' | 'service_unavailable' | 'rate_limited' | 'provider_unavailable';
  message?: string;
  answer?: string;
  record?: AiCallUsageDto;
};

export type PlatformAiUsageSummary = {
  tenantId: string;
  callCount: number;
  totalTokens: number | null;
  succeededCount: number;
  failedCount: number;
  rejectedCount: number;
  quotaExceededCount: number;
};

export type PlatformAiUsageListResponse = {
  requestId: 'platform-ai-usage-summary';
  readonly: true;
  dataSource: 'repository';
  records: PlatformAiUsageSummary[];
  emptyState: {
    title: string;
    description: string;
  };
};

export type InstitutionAiCallUsageListResponse = {
  requestId: 'institution-ai-call-usage';
  readonly: true;
  dataSource: 'repository';
  records: AiCallUsageDto[];
  emptyState: {
    title: string;
    description: string;
  };
};

export type AiCallUsageRepository = {
  findVendorConfig(vendor: string): Promise<{
    baseUrl: string;
    model: string;
    encryptedApiKey: EncryptedSecretEnvelope;
    configured: boolean;
  } | null>;
  createUsageRecord(record: {
    id: string;
    tenantId: string;
    institutionId: string | null;
    actorUserId: string;
    provider: string;
    model: string;
    promptTokens: number | null;
    completionTokens: number | null;
    totalTokens: number | null;
    latencyMs: number | null;
    status: AiCallUsageStatus;
    errorCode: string | null;
  }): Promise<AiCallUsageRecord>;
  listInstitutionUsageRecords(input: {
    tenantId: string;
    institutionId: string;
    limit: number;
  }): Promise<AiCallUsageRecord[]>;
  listPlatformUsageSummary(): Promise<PlatformAiUsageSummary[]>;
};

const USAGE_RECORD_LIMIT = 50;
const AI_CALL_TIMEOUT_MS = 30000;

function normalizeRequired(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function nowIso() {
  return new Date().toISOString();
}

function generateRecordId() {
  return `ai-usage-${randomUUID()}`;
}

type OpenAiChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

type OpenAiChatCompletionResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
};

function estimateTokens(text: string) {
  if (!text) return 0;
  return Math.max(1, Math.ceil(text.length / 4));
}

const deniedResponseFragments = [
  'api key',
  'apikey',
  'authorization',
  'bearer',
  'DATABASE_URL',
  'postgres://',
  'secret',
  'token',
  'password',
  '/www/',
  '/Users/',
  'stack',
  'env.local',
];

const sensitiveInputPatterns = [
  { pattern: /\d{15}(\d{2}[0-9Xx])?/, label: '公民身份号码' },
  { pattern: /\d{6}\s*\d{8}[0-9A-Za-z]/, label: '公民身份号码' },
  { pattern: /\d{16,19}/, label: '银行卡号' },
  { pattern: /[\d\s-]{15,19}/, label: '银行卡号' },
  { pattern: /支付|付款|收款|转账|汇款|结算/, label: '支付信息' },
  { pattern: /发票号|发票|invoice|receipt/i, label: '票据信息' },
  { pattern: /合同号|合同编号|contract/i, label: '合同信息' },
  { pattern: /病历|诊断证明|检查报告|化验报告|影像报告|病理报告|处方笺/, label: '高敏医疗文书' },
  { pattern: /password|密码|secret|token|api.?key|api_key|apikey|authorization|bearer/i, label: '凭证类信息' },
];

function hasSensitiveInput(text: string) {
  const normalized = text.replace(/\s/g, '');
  for (const entry of sensitiveInputPatterns) {
    if (entry.pattern.test(text)) return true;
    if (entry.pattern.test(normalized)) return true;
  }
  if (hasDeniedFragment(text)) return true;
  return false;
}

function hasDeniedFragment(text: string) {
  const normalized = text.toLowerCase();
  return deniedResponseFragments.some((fragment) => normalized.includes(fragment.toLowerCase()));
}

function mapRecordToDto(record: AiCallUsageRecord): AiCallUsageDto {
  return {
    ...record,
    createdAt: record.createdAt instanceof Date
      ? record.createdAt.toISOString()
      : record.createdAt,
  };
}

export async function requestInstitutionAiCallService(input: {
  repository: AiCallUsageRepository;
  vendor: string;
  input: {
    tenantId?: string | null;
    institutionId?: string | null;
    userId?: string | null;
    question?: string | null;
  };
}): Promise<InstitutionAiCallResult> {
  const tenantId = normalizeRequired(input.input.tenantId);
  const institutionId = normalizeRequired(input.input.institutionId);
  const userId = normalizeRequired(input.input.userId) ?? 'anonymous';
  const question = normalizeRequired(input.input.question);

  if (!tenantId || !institutionId) {
    return { status: 'validation_failed', message: '缺少机构身份信息' };
  }
  if (!question) {
    return { status: 'validation_failed', message: '请输入问题' };
  }
  if (question.length > 512) {
    return { status: 'validation_failed', message: '问题过长，请控制在512字以内' };
  }

  if (hasSensitiveInput(question)) {
    const record = await input.repository.createUsageRecord({
      id: generateRecordId(),
      tenantId,
      institutionId,
      actorUserId: userId,
      provider: input.vendor,
      model: 'pre_call_safety_check',
      promptTokens: null,
      completionTokens: null,
      totalTokens: null,
      latencyMs: null,
      status: 'sensitive_input_rejected',
      errorCode: 'SENSITIVE_INPUT_REJECTED',
    }).catch(() => null);

    return {
      status: 'sensitive_input_rejected',
      message: '输入内容包含敏感信息，请移除身份证、银行卡、病历、合同、凭证等敏感内容后重试',
      record: record ? mapRecordToDto(record) : undefined,
    };
  }

  const vendorConfig = await input.repository.findVendorConfig(input.vendor);
  if (!vendorConfig || !vendorConfig.configured) {
    return {
      status: 'service_unavailable',
      message: 'AI 服务提供商未配置，请联系平台管理员',
    };
  }

  let apiKey: string;
  try {
    apiKey = decryptSecret(vendorConfig.encryptedApiKey);
  } catch {
    return {
      status: 'service_unavailable',
      message: 'AI 服务凭证解密失败，请联系平台管理员',
    };
  }

  const systemPrompt = '你是一个医疗美容机构助手。请基于专业知识回答用户问题，保持中文、专业、简洁。注意保护用户隐私，不编造诊断建议。';

  const messages: OpenAiChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: question },
  ];

  const providerName = input.vendor;
  const modelName = vendorConfig.model;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_CALL_TIMEOUT_MS);

  const startedAt = Date.now();

  try {
    const response = await fetch(`${vendorConfig.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelName,
        messages,
        max_tokens: 1024,
        temperature: 0.3,
      }),
      signal: controller.signal,
    });

    const latencyMs = Date.now() - startedAt;

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'unknown');
      const rateLimited = response.status === 429;
      const errorCode = rateLimited ? 'RATE_LIMITED' : `HTTP_${response.status}`;
      const status: AiCallUsageStatus = rateLimited ? 'rate_limited' : 'provider_unavailable';

      const record = await input.repository.createUsageRecord({
        id: generateRecordId(),
        tenantId,
        institutionId,
        actorUserId: userId,
        provider: providerName,
        model: modelName,
        promptTokens: estimateTokens(question),
        completionTokens: null,
        totalTokens: null,
        latencyMs,
        status,
        errorCode,
      });

      return {
        status,
        message: rateLimited
          ? 'AI 服务请求频率过高，请稍后重试'
          : `AI 服务暂时不可用（${response.status}），请稍后重试`,
        record: mapRecordToDto(record),
      };
    }

    const body: OpenAiChatCompletionResponse = await response.json().catch(() => ({}));
    const answer = body.choices?.[0]?.message?.content ?? '';

    if (!answer || hasDeniedFragment(answer)) {
      const record = await input.repository.createUsageRecord({
        id: generateRecordId(),
        tenantId,
        institutionId,
        actorUserId: userId,
        provider: providerName,
        model: modelName,
        promptTokens: estimateTokens(question),
        completionTokens: null,
        totalTokens: null,
        latencyMs,
        status: 'provider_unavailable',
        errorCode: 'UNSAFE_RESPONSE',
      });

      return {
        status: 'provider_unavailable',
        message: 'AI 服务返回内容未通过安全检查',
        answer: '',
        record: mapRecordToDto(record),
      };
    }

    const usage = body.usage ?? {};
    const promptTokens = usage.prompt_tokens ?? estimateTokens(question + systemPrompt);
    const completionTokens = usage.completion_tokens ?? estimateTokens(answer);
    const totalTokens = usage.total_tokens ?? (promptTokens + completionTokens);

    const record = await input.repository.createUsageRecord({
      id: generateRecordId(),
      tenantId,
      institutionId,
      actorUserId: userId,
      provider: providerName,
      model: modelName,
      promptTokens,
      completionTokens,
      totalTokens,
      latencyMs,
      status: 'succeeded',
      errorCode: null,
    });

    return {
      status: 'created',
      answer,
      record: mapRecordToDto(record),
    };
  } catch (error) {
    const latencyMs = Date.now() - startedAt;
    const timedOut = error instanceof DOMException && error.name === 'AbortError';

    const record = await input.repository.createUsageRecord({
      id: generateRecordId(),
      tenantId,
      institutionId,
      actorUserId: userId,
      provider: providerName,
      model: modelName,
      promptTokens: estimateTokens(question),
      completionTokens: null,
      totalTokens: null,
      latencyMs,
      status: timedOut ? 'provider_unavailable' : 'failed',
      errorCode: timedOut ? 'TIMEOUT' : 'NETWORK_ERROR',
    }).catch(() => null);

    return {
      status: 'service_unavailable',
      message: timedOut ? 'AI 服务响应超时，请稍后重试' : 'AI 服务调用失败，请稍后重试',
      record: record ? mapRecordToDto(record) : undefined,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function recordAiCallQuotaRejection(input: {
  repository: AiCallUsageRepository;
  tenantId: string;
  institutionId: string | null;
  actorUserId: string;
  vendor: string;
  model?: string | null;
}): Promise<AiCallUsageRecord | null> {
  try {
    const record = await input.repository.createUsageRecord({
      id: generateRecordId(),
      tenantId: input.tenantId,
      institutionId: input.institutionId,
      actorUserId: input.actorUserId,
      provider: input.vendor,
      model: input.model ?? 'unknown',
      promptTokens: null,
      completionTokens: null,
      totalTokens: null,
      latencyMs: null,
      status: 'rejected',
      errorCode: 'quota_exceeded_ai_calls',
    });
    return record;
  } catch {
    return null;
  }
}

const ALLOWED_VENDORS = ['deepseek', 'doubao', 'qwen'];

export function getDefaultAiVendor(): string {
  return process.env.ZMTG_AI_DEFAULT_VENDOR ?? 'deepseek';
}

export function isAllowedAiVendor(vendor: string): boolean {
  return ALLOWED_VENDORS.includes(vendor);
}

export async function listInstitutionAiCallUsageService(input: {
  repository: AiCallUsageRepository;
  params: {
    tenantId?: string | null;
    institutionId?: string | null;
  };
}): Promise<InstitutionAiCallUsageListResponse> {
  const tenantId = normalizeRequired(input.params.tenantId);
  const institutionId = normalizeRequired(input.params.institutionId);

  if (!tenantId || !institutionId) {
    return {
      requestId: 'institution-ai-call-usage',
      readonly: true,
      dataSource: 'repository',
      records: [],
      emptyState: {
        title: '暂无 AI 调用记录',
        description: '当前机构还没有发起过 AI 调用。',
      },
    };
  }

  try {
    const records = await input.repository.listInstitutionUsageRecords({
      tenantId,
      institutionId,
      limit: USAGE_RECORD_LIMIT,
    });

    return {
      requestId: 'institution-ai-call-usage',
      readonly: true,
      dataSource: 'repository',
      records: records.map(mapRecordToDto),
      emptyState: {
        title: '暂无 AI 调用记录',
        description: '当前机构还没有发起过 AI 调用。',
      },
    };
  } catch {
    return {
      requestId: 'institution-ai-call-usage',
      readonly: true,
      dataSource: 'repository',
      records: [],
      emptyState: {
        title: 'AI 调用记录暂时不可用',
        description: '请稍后刷新重试。',
      },
    };
  }
}

export async function listPlatformAiUsageSummaryService(input: {
  repository: AiCallUsageRepository;
}): Promise<PlatformAiUsageListResponse> {
  try {
    const records = await input.repository.listPlatformUsageSummary();

    return {
      requestId: 'platform-ai-usage-summary',
      readonly: true,
      dataSource: 'repository',
      records,
      emptyState: {
        title: '暂无 AI 调用数据',
        description: '还没有任何租户发起过 AI 调用。',
      },
    };
  } catch {
    return {
      requestId: 'platform-ai-usage-summary',
      readonly: true,
      dataSource: 'repository',
      records: [],
      emptyState: {
        title: 'AI 用量数据暂时不可用',
        description: '请稍后刷新重试。',
      },
    };
  }
}
