export type KnowledgeBaseProductionCapabilityId =
  | 'fileManagement'
  | 'documentParsing'
  | 'keywordSearch'
  | 'mockEmbedding'
  | 'vectorSearch'
  | 'mockQa'
  | 'qaAudit'
  | 'qaQuota'
  | 'realAiProvider'
  | 'ocr'
  | 'runtimeIngestion'
  | 'productionVectorStore';

export type KnowledgeBaseCapabilityStatus = {
  id: KnowledgeBaseProductionCapabilityId;
  label: string;
  enabled: boolean;
  status: 'enabled' | 'disabled';
  summary: string;
  disabledReason: string | null;
  entryCondition: string | null;
};

export type KnowledgeBasePermissionAction = {
  id: string;
  label: string;
  allowed: boolean;
  reason: string;
};

export const KNOWLEDGE_BASE_PRODUCTION_CAPABILITY_IDS: KnowledgeBaseProductionCapabilityId[] = [
  'fileManagement',
  'documentParsing',
  'keywordSearch',
  'mockEmbedding',
  'vectorSearch',
  'mockQa',
  'qaAudit',
  'qaQuota',
  'realAiProvider',
  'ocr',
  'runtimeIngestion',
  'productionVectorStore',
];

export const KNOWLEDGE_BASE_QA_QUOTA_POLICY = {
  tenantDailyLimit: 100,
  institutionDailyLimit: 30,
  usageLimitedMessage: '当前知识库问答次数已达上限，请稍后再试',
};

const enabledCapabilities: KnowledgeBaseCapabilityStatus[] = [
  {
    id: 'fileManagement',
    label: '文件管理',
    enabled: true,
    status: 'enabled',
    summary: '内部受控文件上传、下载、归档和元数据管理已启用。',
    disabledReason: null,
    entryCondition: null,
  },
  {
    id: 'documentParsing',
    label: '文档解析',
    enabled: true,
    status: 'enabled',
    summary: '内部受控文本解析、解析状态和失败文案已启用。',
    disabledReason: null,
    entryCondition: null,
  },
  {
    id: 'keywordSearch',
    label: '关键词检索',
    enabled: true,
    status: 'enabled',
    summary: '基于已解析低敏 chunk 的关键词检索已启用。',
    disabledReason: null,
    entryCondition: null,
  },
  {
    id: 'mockEmbedding',
    label: 'mock embedding',
    enabled: true,
    status: 'enabled',
    summary: 'deterministic mock embedding 索引已启用，仅用于内部受控验证。',
    disabledReason: null,
    entryCondition: null,
  },
  {
    id: 'vectorSearch',
    label: '向量检索',
    enabled: true,
    status: 'enabled',
    summary: '基于 mock embedding 的相似片段检索已启用。',
    disabledReason: null,
    entryCondition: null,
  },
  {
    id: 'mockQa',
    label: 'mock/local QA',
    enabled: true,
    status: 'enabled',
    summary: '基于召回片段的 mock/local QA 已启用，不代表真实 AI 能力。',
    disabledReason: null,
    entryCondition: null,
  },
  {
    id: 'qaAudit',
    label: 'QA 审计',
    enabled: true,
    status: 'enabled',
    summary: 'QA 审计写入和低敏审计查询已启用。',
    disabledReason: null,
    entryCondition: null,
  },
  {
    id: 'qaQuota',
    label: 'QA 用量限制',
    enabled: true,
    status: 'enabled',
    summary: 'tenant 与 institution 每日 QA 用量限制已启用。',
    disabledReason: null,
    entryCondition: null,
  },
];

const disabledCapabilities: KnowledgeBaseCapabilityStatus[] = [
  {
    id: 'realAiProvider',
    label: '真实 AI provider',
    enabled: false,
    status: 'disabled',
    summary: 'AI provider 适配层已准备，真实 AI 未启用。',
    disabledReason: '真实 AI 未启用，未接入真实第三方 AI，当前仅支持 mock/local QA。',
    entryCondition: '完成真实 AI 接入方案评审、密钥治理、安全策略、成本限额和 QA 质量验收后再开启。',
  },
  {
    id: 'ocr',
    label: 'OCR',
    enabled: false,
    status: 'disabled',
    summary: 'OCR 未启用。',
    disabledReason: '未接入 OCR、图片文字识别或扫描件识别能力。',
    entryCondition: '完成 OCR 解析方案评审、文件安全策略、质量验收和失败补偿方案后再开启。',
  },
  {
    id: 'runtimeIngestion',
    label: 'runtime ingestion',
    enabled: false,
    status: 'disabled',
    summary: 'runtime ingestion 未启用。',
    disabledReason: '未启用队列、worker、scheduler 或自动索引流水线。',
    entryCondition: '完成 ingestion 架构方案评审、幂等、重试、死信、回滚和可观测性验收后再开启。',
  },
  {
    id: 'productionVectorStore',
    label: '真实向量数据库',
    enabled: false,
    status: 'disabled',
    summary: '真实向量数据库未启用。',
    disabledReason: '未接入生产级向量数据库，当前仅使用本地 mock embedding 验证链路。',
    entryCondition: '完成向量库选型、schema / migration 审批、租户隔离、删除回滚和索引重建方案后再开启。',
  },
];

function action(id: string, label: string, allowed: boolean, reason: string): KnowledgeBasePermissionAction {
  return { id, label, allowed, reason };
}

export function getKnowledgeBasePermissionMatrix() {
  return {
    platform: {
      scope: 'platform' as const,
      actions: [
        action('viewKnowledgeBase', '查看知识库', true, '平台端可查看 tenant 范围内低敏知识库数据。'),
        action('uploadFile', '上传文件', true, '平台端可在受控范围上传知识库文件。'),
        action('archiveFile', '归档文件', true, '平台端可归档知识库文件，不做真实物理删除。'),
        action('startParsing', '发起解析', true, '平台端可触发受控文本解析。'),
        action('generateMockEmbedding', '生成 mock embedding', true, '平台端可生成 deterministic mock embedding。'),
        action('keywordSearch', '关键词检索', true, '平台端可按 tenant 范围进行关键词检索。'),
        action('vectorSearch', '向量检索', true, '平台端可按 tenant 范围进行 mock 向量检索。'),
        action('qaAsk', 'QA 问答', true, '平台端可发起 mock/local QA。'),
        action('viewQaAudit', '查看 QA 审计', true, '平台端可查看 tenant / institution 范围的低敏 QA 审计。'),
        action('manageInstitutionVisibility', '管理机构授权', true, '平台端可绑定或解绑机构可见范围。'),
      ],
    },
    institution: {
      scope: 'institution' as const,
      allowedActions: [
        action('viewAuthorizedKnowledgeBase', '查看授权知识库', true, '机构端只能查看本机构归属或平台授权可见知识库。'),
        action('downloadAuthorizedFile', '下载授权文件', true, '机构端只能下载授权范围内文件。'),
        action('viewParseChunks', '查看解析片段', true, '机构端只能查看授权范围内低敏解析片段。'),
        action('keywordSearch', '关键词检索', true, '机构端只能在本机构可见范围内检索。'),
        action('vectorSearch', '向量检索', true, '机构端只能在本机构可见范围内检索。'),
        action('qaAsk', 'QA 问答', true, '机构端只能在本机构可见范围内发起 mock/local QA。'),
        action('viewOwnQaAudit', '查看本机构 QA 审计', true, '机构端只能查看 access context 对应机构的 QA 审计。'),
      ],
      forbiddenActions: [
        action('uploadPlatformKnowledgeFile', '上传平台知识库文件', false, '禁止机构端上传平台知识库文件。'),
        action('archiveFile', '归档文件', false, '禁止机构端归档平台知识库文件。'),
        action('startParsing', '发起解析', false, '禁止机构端发起平台知识库解析。'),
        action('generateEmbedding', '生成 embedding', false, '禁止机构端生成 embedding。'),
        action('manageVisibility', '管理 visibility', false, '禁止机构端管理机构可见范围。'),
        action('viewOtherInstitutionAudit', '查看其他机构审计', false, '机构端只能查看本机构 QA 审计，不得查看其他机构审计。'),
        action('accessOtherTenantData', '访问其他 tenant 数据', false, '机构端不得访问其他 tenant 数据。'),
      ],
    },
  };
}

export function getKnowledgeBaseSensitiveFieldPolicy() {
  return {
    allowlist: [
      'knowledgeId',
      'tenantId',
      'institutionId',
      'fileId',
      'chunkId',
      'auditId',
      'title',
      'category',
      'status',
      'sourceKind',
      'descriptionPreview',
      'question',
      'answerPreview',
      'retrievalMode',
      'citationCount',
      'safeStatus',
      'safeFailureMessage',
      'createdAt',
      'updatedAt',
    ],
    denylist: [
      'storageKey',
      '/Users/',
      'textContent',
      'rawContent',
      'parsedContent',
      'embeddingVectorJson',
      'trainingContent',
      'SQL',
      'stack',
      'token',
      'secret',
      'DATABASE_URL',
      '真实 AI 原始响应',
      'prompt',
      'system prompt',
    ],
  };
}

export function getKnowledgeBaseProductionCapabilityStatus() {
  const capabilities = [...enabledCapabilities, ...disabledCapabilities].sort(
    (left, right) =>
      KNOWLEDGE_BASE_PRODUCTION_CAPABILITY_IDS.indexOf(left.id) -
      KNOWLEDGE_BASE_PRODUCTION_CAPABILITY_IDS.indexOf(right.id),
  );

  return {
    requestId: 'knowledge-base-production-capabilities',
    readonly: true,
    capabilities,
    qaQuotaPolicy: KNOWLEDGE_BASE_QA_QUOTA_POLICY,
    permissionMatrix: getKnowledgeBasePermissionMatrix(),
  };
}
