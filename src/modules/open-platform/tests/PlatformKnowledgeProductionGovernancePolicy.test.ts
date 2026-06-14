import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  KNOWLEDGE_BASE_PRODUCTION_CAPABILITY_IDS,
  KNOWLEDGE_BASE_QA_QUOTA_POLICY,
  type KnowledgeBaseProductionCapabilityId,
  getKnowledgeBasePermissionMatrix,
  getKnowledgeBaseProductionCapabilityStatus,
  getKnowledgeBaseSensitiveFieldPolicy,
} from '@/modules/open-platform/server/platform-knowledge-production-governance-policy';
import { getKnowledgeBaseControlledTrialReadiness } from '@/modules/knowledge-base/domain/v1-knowledge-base-controlled-trial-readiness';

const disabledCapabilityIds: KnowledgeBaseProductionCapabilityId[] = [
  'realAiProvider',
  'ocr',
  'runtimeIngestion',
  'productionVectorStore',
];

const enabledInternalCapabilityIds: KnowledgeBaseProductionCapabilityId[] = [
  'fileManagement',
  'documentParsing',
  'keywordSearch',
  'mockEmbedding',
  'vectorSearch',
  'mockQa',
  'qaAudit',
  'qaQuota',
];

const platformActionIds = [
  'viewKnowledgeBase',
  'uploadFile',
  'archiveFile',
  'startParsing',
  'generateMockEmbedding',
  'keywordSearch',
  'vectorSearch',
  'qaAsk',
  'viewQaAudit',
  'manageInstitutionVisibility',
];

const institutionAllowedActionIds = [
  'viewAuthorizedKnowledgeBase',
  'downloadAuthorizedFile',
  'viewParseChunks',
  'keywordSearch',
  'vectorSearch',
  'qaAsk',
  'viewOwnQaAudit',
];

const institutionForbiddenActionIds = [
  'uploadPlatformKnowledgeFile',
  'archiveFile',
  'startParsing',
  'generateEmbedding',
  'manageVisibility',
  'viewOtherInstitutionAudit',
  'accessOtherTenantData',
];

const deniedFieldFragments = [
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
];

const controlledTrialNoGoLabels = [
  'OCR',
  '扫描 PDF / 图片文字识别',
  '真实 AI',
  '真实凭据 / API 凭据',
  '外部网络服务',
  '真实向量数据库',
  'runtime ingestion',
  'worker / queue / scheduler',
  '训练系统',
  '计费系统',
  'dashboard 聚合',
  '首页编辑',
];

const parserSafeFailureMessages = [
  '当前文件类型暂不支持解析',
  '文件大小超过解析限制，请拆分后重新上传',
  '文件未提取到可解析文本，扫描件或图片内容暂不支持',
  '知识库文件解析失败，请稍后重试',
  '解析文本超过长度限制，已截断为低敏预览',
];

const qaBoundaryMessages = [
  '当前知识库问答次数已达上限，请稍后再试',
  '当前账号没有访问该知识库内容的权限',
];

describe('知识库生产级治理 policy', () => {
  it('返回完整 capability 状态，生产级真实能力默认 disabled 且有中文原因和进入条件', () => {
    const status = getKnowledgeBaseProductionCapabilityStatus();
    const capabilitiesById = new Map(status.capabilities.map((capability) => [capability.id, capability]));

    expect(status.requestId).toBe('knowledge-base-production-capabilities');
    expect(status.readonly).toBe(true);
    expect(status.capabilities.map((capability) => capability.id)).toEqual(
      KNOWLEDGE_BASE_PRODUCTION_CAPABILITY_IDS,
    );

    enabledInternalCapabilityIds.forEach((capabilityId) => {
      expect(capabilitiesById.get(capabilityId)).toEqual(
        expect.objectContaining({
          id: capabilityId,
          enabled: true,
          status: 'enabled',
        }),
      );
    });

    disabledCapabilityIds.forEach((capabilityId) => {
      const capability = capabilitiesById.get(capabilityId);
      expect(capability).toEqual(
        expect.objectContaining({
          id: capabilityId,
          enabled: false,
          status: 'disabled',
        }),
      );
      expect(capability?.disabledReason).toMatch(/未启用|未接入|未完成/);
      expect(capability?.entryCondition).toMatch(/审批|评审|验收|方案/);
    });

    expect(capabilitiesById.get('realAiProvider')).toEqual(
      expect.objectContaining({
        enabled: false,
        status: 'disabled',
        summary: expect.stringContaining('AI provider 适配层已准备'),
        disabledReason: expect.stringContaining('真实 AI 未启用'),
      }),
    );
    expect(JSON.stringify(status)).not.toContain('真实 AI 已可用');
  });

  it('权限矩阵覆盖平台端动作、机构端允许动作和机构端禁止动作', () => {
    const matrix = getKnowledgeBasePermissionMatrix();
    const platformActions = new Map(matrix.platform.actions.map((action) => [action.id, action]));
    const institutionAllowedActions = new Map(matrix.institution.allowedActions.map((action) => [action.id, action]));
    const institutionForbiddenActions = new Map(matrix.institution.forbiddenActions.map((action) => [action.id, action]));

    platformActionIds.forEach((actionId) => {
      expect(platformActions.get(actionId)).toEqual(
        expect.objectContaining({
          id: actionId,
          allowed: true,
        }),
      );
    });

    institutionAllowedActionIds.forEach((actionId) => {
      expect(institutionAllowedActions.get(actionId)).toEqual(
        expect.objectContaining({
          id: actionId,
          allowed: true,
        }),
      );
    });

    institutionForbiddenActionIds.forEach((actionId) => {
      const action = institutionForbiddenActions.get(actionId);
      expect(action).toEqual(
        expect.objectContaining({
          id: actionId,
          allowed: false,
        }),
      );
      expect(action?.reason).toMatch(/禁止|只能|不得/);
    });
  });

  it('集中 QA 用量策略保持 tenant 100、institution 30 和中文超限文案', () => {
    expect(KNOWLEDGE_BASE_QA_QUOTA_POLICY).toEqual({
      tenantDailyLimit: 100,
      institutionDailyLimit: 30,
      usageLimitedMessage: '当前知识库问答次数已达上限，请稍后再试',
    });
  });

  it('敏感字段策略覆盖禁止对外返回字段', () => {
    const policy = getKnowledgeBaseSensitiveFieldPolicy();

    deniedFieldFragments.forEach((fragment) => {
      expect(policy.denylist).toContain(fragment);
    });
    expect(policy.allowlist).toEqual(
      expect.arrayContaining([
        'knowledgeId',
        'fileId',
        'chunkId',
        'auditId',
        'question',
        'answerPreview',
        'safeStatus',
      ]),
    );
  });

  it('输出内部受控试用 view model，统一平台端和机构端的允许能力、禁止能力与安全限制', () => {
    const readiness = getKnowledgeBaseControlledTrialReadiness();

    expect(readiness.stage).toBe('10-6');
    expect(readiness.status).toBe('内部受控试用发布包');
    expect(readiness.baselineCommit).toBe('c7f9b7603b7536fc7a4191213120b4cf6e62585f');
    expect(readiness.supportedFileTypes.map((fileType) => fileType.label)).toEqual([
      'TXT',
      'Markdown',
      'CSV',
      '文本型 PDF',
      'DOCX',
      'XLSX',
    ]);
    expect(readiness.safetyLimits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: '文件大小限制', value: '20MB' }),
        expect.objectContaining({ label: '解析文本上限', value: '32000 字符' }),
        expect.objectContaining({ label: 'ZIP 单文件解压上限', value: '5MB' }),
        expect.objectContaining({ label: 'PDF 单段解压上限', value: '8MB' }),
      ]),
    );
    expect(readiness.platform.allowedCapabilities.map((capability) => capability.label)).toEqual(
      expect.arrayContaining([
        '文件上传',
        '真实文本文件解析',
        'chunk 查看',
        '关键词检索',
        'mock 向量检索',
        'mock/local QA',
        'citations',
        'QA audit',
        'quota',
        'capability',
      ]),
    );
    expect(readiness.institution.allowedCapabilities.map((capability) => capability.label)).toEqual(
      expect.arrayContaining([
        '授权知识库查看',
        '授权文件查看',
        '解析状态查看',
        'chunk 预览',
        '关键词检索',
        'mock/local QA',
        'citations',
        'QA audit',
      ]),
    );
    expect(readiness.blockedCapabilities.map((capability) => capability.label)).toEqual(
      expect.arrayContaining(controlledTrialNoGoLabels),
    );
    expect(readiness.failureMessages).toEqual([...parserSafeFailureMessages, ...qaBoundaryMessages]);
    expect(readiness.institution.forbiddenActions.map((action) => action.label)).toEqual(
      expect.arrayContaining([
        '上传',
        '归档',
        '发起解析',
        '训练',
        '生成 embedding',
        '管理 visibility',
        '调用真实 AI',
      ]),
    );
    expect(JSON.stringify(readiness)).not.toContain('storageKey');
    expect(JSON.stringify(readiness)).not.toContain('/Users/');
    expect(JSON.stringify(readiness)).not.toContain('SQL');
    expect(JSON.stringify(readiness)).not.toContain('stack');
    expect(JSON.stringify(readiness)).not.toContain('token');
    expect(JSON.stringify(readiness)).not.toContain('secret');
    expect(JSON.stringify(readiness)).not.toContain('API key');
  });

  it('10-5 体验与验收闭环 view model 输出试用步骤、验收清单、失败态说明和通过标准', () => {
    const readiness = getKnowledgeBaseControlledTrialReadiness();

    expect(readiness.platform.trialSteps.map((step) => step.label)).toEqual([
      '确认 capability 与 No-Go',
      '上传白名单文件并发起解析',
      '查看解析状态与 chunk 预览',
      '执行关键词检索',
      '执行 mock 向量检索',
      '发起 mock/local QA',
      '核对 citations 与 QA audit',
      '核对 quota 与失败态说明',
    ]);
    expect(readiness.institution.trialSteps.map((step) => step.label)).toEqual([
      '确认只读授权范围',
      '查看授权知识库与授权文件',
      '查看解析状态与 chunk 预览',
      '执行关键词检索',
      '执行 mock 向量检索',
      '发起 mock/local QA',
      '核对 citations 与本机构 QA audit',
      '确认禁止操作不可用',
    ]);
    expect(readiness.platform.acceptanceChecklist.map((item) => item.label)).toEqual(
      expect.arrayContaining([
        '解析状态和失败文案可理解',
        '检索和 QA 均基于低敏 chunk',
        'citations、audit、quota、capability 可核对',
        'No-Go 和禁止外显字段持续可见',
      ]),
    );
    expect(readiness.institution.acceptanceChecklist.map((item) => item.label)).toEqual(
      expect.arrayContaining([
        '只能查看授权知识库内容',
        '只读链路可完成检索、QA、citations、audit 验收',
        '上传、归档、解析、训练、embedding、visibility、真实 AI 入口不可见',
        '跨机构、跨 tenant、未授权内容不可见',
      ]),
    );
    expect(readiness.commonFailureStates.map((state) => state.label)).toEqual([
      '空态',
      '解析失败',
      '权限失败',
      'quota 超限',
      '无引用',
      '无检索结果',
    ]);
    expect(readiness.commonFailureStates.map((state) => state.message)).toEqual(
      expect.arrayContaining([
        '暂无授权可见知识库',
        '知识库文件解析失败，请稍后重试',
        '当前账号没有访问该知识库内容的权限',
        '当前知识库问答次数已达上限，请稍后再试',
        '当前问题没有命中可引用的知识片段',
        '当前范围没有命中关键词或相似片段',
      ]),
    );
    expect(readiness.passingCriteria).toEqual(
      expect.arrayContaining([
        '平台端按步骤完成上传、解析、chunk、检索、QA、citations、audit、quota、capability 验收。',
        '机构端按步骤完成授权内容只读查看、检索、QA、citations 和本机构 audit 验收。',
        '空态、失败态、权限态、quota 超限态、无引用态、无检索结果均展示中文安全文案。',
      ]),
    );
    expect(JSON.stringify(readiness)).not.toContain('storageKey');
    expect(JSON.stringify(readiness)).not.toContain('/Users/');
    expect(JSON.stringify(readiness)).not.toContain('SQL');
    expect(JSON.stringify(readiness)).not.toContain('stack');
    expect(JSON.stringify(readiness)).not.toContain('token');
    expect(JSON.stringify(readiness)).not.toContain('secret');
    expect(JSON.stringify(readiness)).not.toContain('API key');
    expect(JSON.stringify(readiness)).not.toContain('DATABASE_URL');
    expect(JSON.stringify(readiness)).not.toContain('原始模型响应');
    expect(JSON.stringify(readiness)).not.toContain('prompt 原文');
  });

  it('10-6 发布包 view model 输出交付清单、操作手册、验收模板和后续进入条件', () => {
    const readiness = getKnowledgeBaseControlledTrialReadiness();

    expect(readiness.releasePackage.deliveryStatus).toBe('可交付内部受控试用');
    expect(readiness.releasePackage.conclusion).toContain('可以交付内部试用人员');
    expect(readiness.releasePackage.packageChecklist.map((item) => item.label)).toEqual([
      '阶段总交付说明',
      '平台端内部试用操作手册',
      '机构端只读试用操作手册',
      '内部验收报告模板',
      '已完成能力与 No-Go 清单',
      '后续进入条件说明',
    ]);
    expect(readiness.releasePackage.platformManualSummary.map((item) => item.label)).toEqual([
      '确认发布状态和 No-Go',
      '按白名单上传并解析文件',
      '核对 chunk、检索、QA 与引用',
      '记录 audit、quota 与失败态',
    ]);
    expect(readiness.releasePackage.institutionManualSummary.map((item) => item.label)).toEqual([
      '确认只读交付状态',
      '查看授权知识库和文件解析状态',
      '完成只读检索、QA 与 citations',
      '记录只读边界和失败态',
    ]);
    expect(readiness.releasePackage.acceptanceReportFields.map((field) => field.label)).toEqual([
      '试用人员与日期',
      '平台端试用记录',
      '机构端只读试用记录',
      '文件解析样本与失败态',
      '检索、QA、citations 与 audit 记录',
      'quota、capability 与 No-Go 核对',
      '问题、风险与交接结论',
    ]);
    expect(readiness.releasePackage.completedCapabilities.map((capability) => capability.label)).toEqual(
      expect.arrayContaining([
        '真实文本文件解析',
        'chunk 预览',
        '关键词检索',
        'mock 向量检索',
        'mock/local QA',
        'citations',
        'QA audit',
        'quota',
        'capability',
        '平台端低敏展示',
        '机构端只读低敏展示',
      ]),
    );
    expect(readiness.releasePackage.nextStageEntryConditions.map((condition) => condition.label)).toEqual([
      '真实 AI',
      'OCR',
      '真实向量库',
      'runtime ingestion',
      '任何真实外部服务',
    ]);
    expect(readiness.releasePackage.nextStageEntryConditions.map((condition) => condition.description)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('密钥治理、成本限额、质量评估、安全评估、灰度开关、回滚方案'),
        expect.stringContaining('文件安全策略、扫描件识别质量评估、失败补偿、人工复核边界'),
        expect.stringContaining('选型、schema/migration 审批、租户隔离、删除回滚、索引重建策略'),
        expect.stringContaining('worker/queue/scheduler 方案、幂等、重试、死信、可观测性和回滚'),
        expect.stringContaining('凭据管理、审计、限流、成本控制和降级策略'),
      ]),
    );
    [
      'storageKey',
      '/Users/',
      'SQL',
      'stack',
      'token',
      'secret',
      'API key',
      'DATABASE_URL',
      '原始模型响应',
      'prompt 原文',
    ].forEach((fragment) => {
      expect(JSON.stringify(readiness.releasePackage)).not.toContain(fragment);
    });
  });

  it('10-4 文档与 helper 使用同一组 No-Go 和 10-3 安全失败文案', () => {
    const readiness = getKnowledgeBaseControlledTrialReadiness();
    const doc = readFileSync(
      join(process.cwd(), 'docs/product/2026-06-14-v1-knowledge-base-controlled-trial-readiness-10-4.md'),
      'utf8',
    );

    controlledTrialNoGoLabels.forEach((label) => {
      expect(readiness.blockedCapabilities.map((capability) => capability.label)).toContain(label);
      expect(doc).toContain(label);
    });
    [...parserSafeFailureMessages, ...qaBoundaryMessages].forEach((message) => {
      expect(readiness.failureMessages).toContain(message);
      expect(doc).toContain(message);
    });
    [
      '该文件没有可解析的文本内容',
      '文件超过大小限制，无法解析',
      '文件解析失败，请检查文件内容后重试',
    ].forEach((legacyMessage) => {
      expect(readiness.failureMessages).not.toContain(legacyMessage);
      expect(doc).not.toContain(legacyMessage);
    });
    expect(JSON.stringify(readiness)).not.toContain('API key');
    expect(doc).not.toContain('API key');
  });

  it('10-5 文档记录验收流程、通过标准、失败态和后续禁止范围', () => {
    const doc = readFileSync(
      join(process.cwd(), 'docs/product/2026-06-14-v1-knowledge-base-controlled-trial-acceptance-10-5.md'),
      'utf8',
    );

    [
      '当前主干基线',
      '10-5 任务目标',
      '平台端内部试用验收流程',
      '机构端只读试用验收流程',
      '通过标准',
      '失败态处理方式',
      'No-Go 能力',
      '低敏字段和禁止字段',
      '测试范围',
      '后续不得直接进入的范围',
    ].forEach((heading) => {
      expect(doc).toContain(heading);
    });
    [...parserSafeFailureMessages, ...qaBoundaryMessages].forEach((message) => {
      expect(doc).toContain(message);
    });
    controlledTrialNoGoLabels.forEach((label) => {
      expect(doc).toContain(label);
    });
    expect(doc).not.toContain('API key');
    expect(doc).not.toContain('storageKey');
    expect(doc).not.toContain('/Users/');
    expect(doc).not.toContain('DATABASE_URL');
  });

  it('10-6 文档记录发布包、操作手册、验收模板和后续进入条件', () => {
    const doc = readFileSync(
      join(process.cwd(), 'docs/product/2026-06-14-v1-knowledge-base-controlled-trial-release-package-10-6.md'),
      'utf8',
    );

    [
      '当前主干基线',
      '10-6 任务目标',
      '当前已完成能力总清单',
      '平台端内部试用操作手册',
      '机构端只读试用操作手册',
      '内部验收报告模板',
      '失败态处理说明',
      'No-Go 能力清单',
      '低敏字段和禁止字段',
      '后续进入真实 AI / OCR / 真实向量库 / runtime 的前置条件',
      '当前阶段交付结论',
    ].forEach((heading) => {
      expect(doc).toContain(heading);
    });
    [
      '阶段总交付说明',
      '平台端内部试用操作手册',
      '机构端只读试用操作手册',
      '内部验收报告模板',
      '真实 AI：必须先完成密钥治理、成本限额、质量评估、安全评估、灰度开关、回滚方案。',
      'OCR：必须先完成文件安全策略、扫描件识别质量评估、失败补偿、人工复核边界。',
      '真实向量库：必须先完成选型、schema/migration 审批、租户隔离、删除回滚、索引重建策略。',
      'runtime ingestion：必须先完成 worker/queue/scheduler 方案、幂等、重试、死信、可观测性和回滚。',
      '任何真实外部服务：必须先完成凭据管理、审计、限流、成本控制和降级策略。',
    ].forEach((content) => {
      expect(doc).toContain(content);
    });
    [...parserSafeFailureMessages, ...qaBoundaryMessages].forEach((message) => {
      expect(doc).toContain(message);
    });
    controlledTrialNoGoLabels.forEach((label) => {
      expect(doc).toContain(label);
    });
    expect(doc).not.toContain('storageKey');
    expect(doc).not.toContain('/Users/');
    expect(doc).not.toContain('SQL');
    expect(doc).not.toContain('stack');
    expect(doc).not.toContain('token');
    expect(doc).not.toContain('secret');
    expect(doc).not.toContain('API key');
    expect(doc).not.toContain('DATABASE_URL');
    expect(doc).not.toContain('原始模型响应');
    expect(doc).not.toContain('prompt 原文');
  });

  it('capability API contract 复用受控试用 view model，且不暴露禁止字段原文', () => {
    const status = getKnowledgeBaseProductionCapabilityStatus();

    expect(status.controlledTrial).toEqual(getKnowledgeBaseControlledTrialReadiness());
    expect(JSON.stringify(status.controlledTrial)).not.toContain('storageKey');
    expect(JSON.stringify(status.controlledTrial)).not.toContain('/Users/');
    expect(JSON.stringify(status.controlledTrial)).not.toContain('SQL');
    expect(JSON.stringify(status.controlledTrial)).not.toContain('stack');
    expect(JSON.stringify(status.controlledTrial)).not.toContain('token');
    expect(JSON.stringify(status.controlledTrial)).not.toContain('secret');
    expect(JSON.stringify(status.controlledTrial)).not.toContain('API key');
  });
});
