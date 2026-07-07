import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import postgres from 'postgres';

export const DEMO_SEED_KEY = 'v06_demo_low_sensitive_01';
export const DEMO_SEED_ENV_FLAG = 'ZMTG_ALLOW_DEMO_SEED';
export const DEMO_TENANT_ID = 'v06-demo-low-sensitive-01-tenant';
export const DEMO_TENANT_NAME = '智美天工 V0.6 演示租户';
export const DEMO_INSTITUTION_ID = 'v06-demo-low-sensitive-01-xinglan-institution';
export const DEMO_INSTITUTION_NAME = '星澜医美演示机构';
export const DEMO_WORKSPACE_ID = 'v06-demo-low-sensitive-01-workspace';

const seedActorId = 'v06-demo-low-sensitive-01-system';
const seedStartedAt = new Date('2026-07-07T09:00:00+08:00');
const treatmentDate = new Date('2026-07-01T10:00:00+08:00');
const passwordUpdatedAt = new Date('2026-07-07T09:00:00+08:00');
const lowSensitivePlaceholder = '未采集';
const demoTag = `demoSeedKey:${DEMO_SEED_KEY}`;
const demoSeedIdPrefix = 'v06-demo-low-sensitive-01';
const maxSeedIdLength = 64;
const seedMetadata = {
  demoSeedKey: DEMO_SEED_KEY,
  lowSensitiveOnly: true,
  institutionName: DEMO_INSTITUTION_NAME,
  forbidAutoSend: true,
  forbidExternalCallback: true,
  forbidAiCall: true,
};

export type CliMode = 'dry-run' | 'apply' | 'cleanup';
export type CliOptions = {
  mode: CliMode;
};
export type SafeDatabaseUrlCheck =
  | { allowed: true; host: string; reason: 'localhost' | 'demo_marker' }
  | { allowed: false; host: string | null; reason: 'missing_database_url' | 'invalid_database_url' | 'unsafe_host' };

type DbClient = ReturnType<typeof postgres>;
type DemoDatabase = DbClient;
type SeedRecordSet = ReturnType<typeof buildDemoSeedRecords>;
type DemoSeedEnv = Record<string, string | undefined>;
type DbScalar = string | number | boolean | Date | null | Record<string, unknown> | readonly string[];
type DbRecord = Record<string, DbScalar>;
type RowId = { id: string };
type TableMutationSummary = {
  tableName: string;
  created?: number;
  already_exists?: number;
  cleaned?: number;
  skipped: number;
};
type SeedApplySummary = { mode: 'apply'; seedKey: string; tables: TableMutationSummary[] };
type SeedCleanupSummary = { mode: 'cleanup'; seedKey: string; tables: TableMutationSummary[] };

function deterministicId(...parts: string[]) {
  const fullId = [demoSeedIdPrefix, ...parts].join('-');
  if (fullId.length <= maxSeedIdLength) return fullId;

  const stableHash = createHash('sha256').update(fullId).digest('hex').slice(0, 16);
  return `${demoSeedIdPrefix}-${stableHash}`;
}

function addDemoTags(tags: string[]) {
  return [...tags, demoTag, '低敏演示', '本地或 demo 环境限定'];
}

function isoAt(dayOffset: number, hour: number) {
  const date = new Date(treatmentDate.getTime());
  date.setUTCDate(date.getUTCDate() + dayOffset);
  date.setUTCHours(hour - 8, 0, 0, 0);
  return date;
}

const roleUsers = [
  {
    id: deterministicId('user', 'admin'),
    username: 'v06_demo_low_sensitive_admin',
    displayName: '机构管理员',
    role: 'tenant_admin' as const,
  },
  {
    id: deterministicId('user', 'consultant'),
    username: 'v06_demo_low_sensitive_consultant',
    displayName: '咨询师',
    role: 'consultant' as const,
  },
  {
    id: deterministicId('user', 'service'),
    username: 'v06_demo_low_sensitive_service',
    displayName: '客服',
    role: 'customer_service' as const,
  },
  {
    id: deterministicId('user', 'assistant'),
    username: 'v06_demo_low_sensitive_assistant',
    displayName: '医助',
    role: 'tenant_operator' as const,
  },
  {
    id: deterministicId('user', 'ops'),
    username: 'v06_demo_low_sensitive_ops',
    displayName: '运营负责人',
    role: 'tenant_operator' as const,
  },
] as const;

const customerProfiles = [
  {
    key: 'hydro-a',
    displayName: '演示客户A',
    ageRange: '25-30',
    lifecycle: 'post_care' as const,
    priority: 'observe' as const,
    ownerUserId: deterministicId('user', 'assistant'),
    projectInterest: '水光针',
    treatmentProject: '水光针',
    treatmentCategory: 'injection_review',
    treatmentStage: '术后 D1',
    recoveryStage: 'D1',
    riskLevel: 'watch' as const,
    templateKey: 'hydro_injection_care',
    ownerRole: '医助',
    tags: ['补水护理', '术后 D1', '需确认局部反应', '年龄段:25-30'],
    summary: '客户完成水光类补水护理，需确认 D1 局部反应、清洁补水和防晒执行情况。',
    nextCareAction: '医助人工确认局部反应，客服准备低敏护理提醒草稿。',
    riskSignals: ['轻微泛红', '需观察'],
  },
  {
    key: 'photoelectric-b',
    displayName: '演示客户B',
    ageRange: '30-35',
    lifecycle: 'post_care' as const,
    priority: 'medium' as const,
    ownerUserId: deterministicId('user', 'service'),
    projectInterest: '光子 / 光电',
    treatmentProject: '光子 / 光电',
    treatmentCategory: 'laser_repair',
    treatmentStage: '术后 D3',
    recoveryStage: 'D3',
    riskLevel: 'normal' as const,
    templateKey: 'photoelectric_care',
    ownerRole: '客服',
    tags: ['光电修复', '敏感观察', '防晒提醒', '年龄段:30-35'],
    summary: '客户完成光子 / 光电治疗，需跟进 D3 护理执行、防晒和敏感反应。',
    nextCareAction: '客服人工确认护理执行，异常时升级给医助。',
    riskSignals: ['敏感观察'],
  },
  {
    key: 'surgery-c',
    displayName: '演示客户C',
    ageRange: '25-30',
    lifecycle: 'post_care' as const,
    priority: 'observe' as const,
    ownerUserId: deterministicId('user', 'assistant'),
    projectInterest: '双眼皮术后修复',
    treatmentProject: '双眼皮术后修复',
    treatmentCategory: 'skin_repair',
    treatmentStage: '术后 D3',
    recoveryStage: 'D3',
    riskLevel: 'watch' as const,
    templateKey: 'post_surgery_repair',
    ownerRole: '医助',
    tags: ['双眼皮术后', '肿胀观察', '重点恢复', '年龄段:25-30'],
    summary: '客户处于双眼皮术后修复阶段，需要人工复核恢复进展、肿胀变化和复诊提醒。',
    nextCareAction: '医助复核恢复情况，咨询师准备复诊前沟通。',
    riskSignals: ['肿胀观察', '需复核'],
  },
  {
    key: 'skin-d',
    displayName: '演示客户D',
    ageRange: '35-40',
    lifecycle: 'repurchase_window' as const,
    priority: 'medium' as const,
    ownerUserId: deterministicId('user', 'consultant'),
    projectInterest: '皮肤管理',
    treatmentProject: '皮肤管理',
    treatmentCategory: 'skin_check',
    treatmentStage: '检测后 D7',
    recoveryStage: 'D7',
    riskLevel: 'normal' as const,
    templateKey: 'skin_management',
    ownerRole: '咨询师',
    tags: ['皮肤检测后', '复购窗口', '护理执行', '年龄段:35-40'],
    summary: '客户完成皮肤管理检测后护理，需复核 D7 改善进展和后续护理执行。',
    nextCareAction: '咨询师人工复核改善进展，并准备复购窗口内沟通。',
    riskSignals: ['复购窗口观察'],
  },
] as const;

const stagePlans = [
  { suffix: 'd1', stageKey: 'D1', nodeKey: 'demo_d1_check', dayOffset: 1, handlerRole: 'medical_assistant', title: 'D1 局部反应人工确认' },
  { suffix: 'd3', stageKey: 'D3', nodeKey: 'demo_d3_care', dayOffset: 3, handlerRole: 'customer_service', title: 'D3 护理执行人工确认' },
  { suffix: 'd7', stageKey: 'D7', nodeKey: 'demo_d7_review', dayOffset: 7, handlerRole: 'consultant', title: 'D7 恢复进展人工复核' },
] as const;

const sopDocuments = [
  ['hydro-sop', '水光术后护理 SOP', ['清洁补水观察点', 'D1 / D3 / D7 人工确认', '异常反应升级边界']],
  ['photoelectric-sop', '光电术后护理 SOP', ['红热与敏感观察', '防晒与修复产品使用', '异常反馈人工处理']],
  ['surgery-sop', '双眼皮术后恢复注意事项', ['肿胀观察', '冷敷 / 热敷阶段', '复诊提醒和高风险提示']],
  ['service-script-sop', '客服随访话术规范', ['低敏问候', '确认护理执行', '不得承诺医疗效果']],
  ['risk-escalation-sop', '高风险症状升级流程', ['升级给医助 / 运营负责人', '记录低敏摘要', '不替代医疗判断']],
  ['revisit-sop', '复诊提醒 SOP', ['复诊前提醒', '到店准备', '人工确认和时间线记录']],
] as const;

const messageTemplates = [
  {
    id: deterministicId('message-template', 'd1-care'),
    templateKey: 'v06_demo_d1_manual_care',
    templateName: 'V0.6 D1 人工确认草稿',
    templateType: 'risk_check' as const,
    applicableNodeKey: 'demo_d1_check',
    contentTemplate: '请人工确认客户 D1 局部反应、清洁补水和防晒执行情况；如出现异常，升级给医助处理。',
  },
  {
    id: deterministicId('message-template', 'd3-care'),
    templateKey: 'v06_demo_d3_manual_care',
    templateName: 'V0.6 D3 护理执行草稿',
    templateType: 'post_care' as const,
    applicableNodeKey: 'demo_d3_care',
    contentTemplate: '请人工确认客户 D3 护理执行、敏感反应和防晒情况；草稿仅供员工参考，不自动发送。',
  },
  {
    id: deterministicId('message-template', 'd7-review'),
    templateKey: 'v06_demo_d7_manual_review',
    templateName: 'V0.6 D7 恢复复核草稿',
    templateType: 'revisit' as const,
    applicableNodeKey: 'demo_d7_review',
    contentTemplate: '请人工复核客户 D7 恢复进展和复诊准备；不得承诺医疗效果。',
  },
] as const;

function customerId(profileKey: string) {
  return deterministicId('customer', profileKey);
}

function treatmentSummaryId(profileKey: string) {
  return deterministicId('treatment-summary', profileKey);
}

function enrollmentId(profileKey: string) {
  return deterministicId('enrollment', profileKey);
}

function taskId(profileKey: string, stageSuffix: string) {
  return deterministicId('task', profileKey, stageSuffix);
}

function stageId(profileKey: string, stageSuffix: string) {
  return deterministicId('stage', profileKey, stageSuffix);
}

function draftId(profileKey: string, stageSuffix: string) {
  return deterministicId('draft', profileKey, stageSuffix);
}

function documentId(docKey: string) {
  return deterministicId('kb-document', docKey);
}

function chunkId(docKey: string, chunkIndex: number) {
  return deterministicId('kb-chunk', docKey, String(chunkIndex + 1));
}

export function buildDemoSeedRecords() {
  const authUserRecords = roleUsers.map((user) => ({
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    phone: null,
    email: null,
    passwordHash: 'demo-disabled-password-hash-not-for-login',
    passwordUpdatedAt,
    passwordResetRequired: true,
    status: 'password_reset_required' as const,
    lastLoginAt: null,
    failedLoginCount: 0,
    lockedUntil: null,
    createdBy: seedActorId,
    updatedBy: seedActorId,
    createdAt: seedStartedAt,
    updatedAt: seedStartedAt,
  }));

  const tenantRecords = [{ id: DEMO_TENANT_ID, name: DEMO_TENANT_NAME, status: 'active' as const }];
  const tenantMemberRecords = roleUsers.map((user) => ({
    id: deterministicId('member', user.id.replace('v06-demo-low-sensitive-01-user-', '')),
    tenantId: DEMO_TENANT_ID,
    userId: user.id,
    role: user.role,
    displayName: user.displayName,
    createdAt: seedStartedAt,
    updatedAt: seedStartedAt,
  }));

  const customerRecords = customerProfiles.map((profile) => ({
    id: customerId(profile.key),
    tenantId: DEMO_TENANT_ID,
    displayName: profile.displayName,
    lifecycle: profile.lifecycle,
    priority: profile.priority,
    ownerUserId: profile.ownerUserId,
    projectInterest: profile.projectInterest,
    maskedPhone: lowSensitivePlaceholder,
    maskedMedicalRecordNo: lowSensitivePlaceholder,
    lastTouchSummary: `${profile.treatmentProject} ${profile.recoveryStage} 低敏演示摘要，需人工跟进。`,
    nextAction: `已纳入 ${profile.templateKey}，当前由${profile.ownerRole}人工处理。`,
    tags: addDemoTags([...profile.tags, `风险等级:${profile.riskLevel}`, `负责人角色:${profile.ownerRole}`]),
    gender: '',
    birthDate: '',
    referralSource: '受控演示',
    notes: `低敏演示画像：年龄段 ${profile.ageRange}；不包含手机号、身份证、病历号或地址。`,
    createdAt: seedStartedAt,
    updatedAt: seedStartedAt,
  }));

  const treatmentSummaryRecords = customerProfiles.map((profile) => ({
    id: treatmentSummaryId(profile.key),
    tenantId: DEMO_TENANT_ID,
    customerId: customerId(profile.key),
    appointmentId: null,
    treatmentDate,
    treatmentProject: profile.treatmentProject,
    treatmentCategory: profile.treatmentCategory,
    treatmentStage: profile.treatmentStage,
    recoveryStage: profile.recoveryStage,
    riskLevel: profile.riskLevel,
    ownerUserId: profile.ownerUserId,
    summary: profile.summary,
    nextCareAction: profile.nextCareAction,
    tags: addDemoTags([...profile.tags, `expectedPathTemplateKey:${profile.templateKey}`, ...profile.riskSignals]),
    voidedAt: null,
    voidedBy: null,
    voidReasonCode: null,
    voidReason: null,
    createdAt: seedStartedAt,
    updatedAt: seedStartedAt,
  }));

  const followUpTaskRecords = customerProfiles.flatMap((profile) =>
    stagePlans.map((stagePlan) => ({
      id: taskId(profile.key, stagePlan.suffix),
      tenantId: DEMO_TENANT_ID,
      customerId: customerId(profile.key),
      customerDisplayName: profile.displayName,
      journeyId: enrollmentId(profile.key),
      stage: `${profile.treatmentProject} ${stagePlan.title}`,
      status: stagePlan.suffix === 'd1' ? 'due' as const : 'scheduled' as const,
      dueAt: isoAt(stagePlan.dayOffset, 10),
      suggestedAction: `${stagePlan.stageKey} 节点由${profile.ownerRole}人工确认，禁止自动触达客户。`,
      riskLevel: profile.riskLevel,
      sourceTreatmentSummaryId: treatmentSummaryId(profile.key),
      sourceSuggestionKey: `${treatmentSummaryId(profile.key)}:${profile.templateKey}:${stagePlan.nodeKey}`,
      updatedBy: null,
      updatedAt: null,
      createdAt: seedStartedAt,
    })),
  );

  const followUpPathEnrollmentRecords = customerProfiles.map((profile) => ({
    id: enrollmentId(profile.key),
    tenantId: DEMO_TENANT_ID,
    institutionId: DEMO_INSTITUTION_ID,
    customerId: customerId(profile.key),
    treatmentSummaryId: treatmentSummaryId(profile.key),
    sourceType: 'treatment_summary' as const,
    sourceId: treatmentSummaryId(profile.key),
    templateKey: profile.templateKey,
    templateVersion: 'v0.6-demo-low-sensitive',
    templateSnapshotJson: {
      ...seedMetadata,
      templateKey: profile.templateKey,
      stages: stagePlans.map((stagePlan) => stagePlan.stageKey),
      requiresHumanConfirmation: true,
    },
    status: 'active' as const,
    startedAt: seedStartedAt,
    completedAt: null,
    safeReasonCode: 'demo_low_sensitive_path_enrolled',
    metadataJson: {
      ...seedMetadata,
      customerDisplayName: profile.displayName,
      ageRange: profile.ageRange,
      ownerRole: profile.ownerRole,
      currentPathStatus: `已纳入 ${profile.templateKey}`,
    },
    createdAt: seedStartedAt,
    updatedAt: seedStartedAt,
  }));

  const followUpPathStageRecords = customerProfiles.flatMap((profile) =>
    stagePlans.map((stagePlan) => ({
      id: stageId(profile.key, stagePlan.suffix),
      tenantId: DEMO_TENANT_ID,
      institutionId: DEMO_INSTITUTION_ID,
      enrollmentId: enrollmentId(profile.key),
      nodeKey: stagePlan.nodeKey,
      stageKey: stagePlan.stageKey,
      dueAt: isoAt(stagePlan.dayOffset, 10),
      status: stagePlan.suffix === 'd1' ? 'due' as const : 'scheduled' as const,
      followUpTaskId: taskId(profile.key, stagePlan.suffix),
      handlerRole: stagePlan.handlerRole,
      riskLevel: profile.riskLevel,
      safeMessage: `${stagePlan.stageKey} 低敏人工任务，不会自动联系客户。`,
      createdAt: seedStartedAt,
      updatedAt: seedStartedAt,
    })),
  );

  const followUpMessageTemplateRecords = messageTemplates.map((template) => ({
    ...template,
    tenantId: DEMO_TENANT_ID,
    institutionId: DEMO_INSTITUTION_ID,
    applicableTemplateKey: null,
    channelType: 'manual' as const,
    variablesJson: {
      demoSeedKey: DEMO_SEED_KEY,
      variables: ['customerDisplayName', 'stageKey'],
    },
    status: 'active' as const,
    requiresHumanApproval: true,
    forbidAutoSend: true,
    createdAt: seedStartedAt,
    updatedAt: seedStartedAt,
  }));

  const draftStatuses = ['draft', 'approved', 'marked_sent', 'rejected'] as const;
  const followUpMessageDraftRecords = customerProfiles.map((profile, index) => {
    const stagePlan = stagePlans[index % stagePlans.length];
    const status = draftStatuses[index % draftStatuses.length];
    const approvedAt = status === 'approved' || status === 'marked_sent' ? isoAt(stagePlan.dayOffset, 11) : null;
    const rejectedAt = status === 'rejected' ? isoAt(stagePlan.dayOffset, 11) : null;
    const markedSentAt = status === 'marked_sent' ? isoAt(stagePlan.dayOffset, 12) : null;
    const template = messageTemplates[index % messageTemplates.length];
    const safePreview = `${profile.displayName} ${stagePlan.stageKey} 低敏随访草稿，仅供人工确认。`;

    return {
      id: draftId(profile.key, stagePlan.suffix),
      tenantId: DEMO_TENANT_ID,
      institutionId: DEMO_INSTITUTION_ID,
      followUpTaskId: taskId(profile.key, stagePlan.suffix),
      enrollmentId: enrollmentId(profile.key),
      stageId: stageId(profile.key, stagePlan.suffix),
      customerId: customerId(profile.key),
      templateId: template.id,
      channelType: 'manual' as const,
      status,
      draftContent: `${safePreview} 请确认护理执行、风险变化和是否需要升级；系统不自动发送。`,
      editedContent: null,
      safePreview,
      approvedBy: approvedAt ? deterministicId('user', 'admin') : null,
      approvedAt,
      rejectedBy: rejectedAt ? deterministicId('user', 'admin') : null,
      rejectedAt,
      markedSentBy: markedSentAt ? deterministicId('user', 'service') : null,
      markedSentAt,
      safeReasonCode: status === 'draft'
        ? 'draft_created'
        : status === 'approved'
          ? 'draft_approved'
          : status === 'marked_sent'
            ? 'draft_marked_sent'
            : 'draft_rejected',
      metadataJson: {
        ...seedMetadata,
        manualOnly: true,
        channelType: 'manual',
        stageKey: stagePlan.stageKey,
      },
      createdAt: isoAt(stagePlan.dayOffset, 10),
      updatedAt: markedSentAt ?? rejectedAt ?? approvedAt ?? isoAt(stagePlan.dayOffset, 10),
    };
  });

  const knowledgeSourceRecords = [{
    id: deterministicId('kb-source', 'sop'),
    tenantId: DEMO_TENANT_ID,
    institutionId: DEMO_INSTITUTION_ID,
    workspaceId: DEMO_WORKSPACE_ID,
    sourceKind: 'demo' as const,
    status: 'ready' as const,
    readonlyStatus: 'readonly' as const,
    sourceLabel: `${DEMO_INSTITUTION_NAME} V0.6 低敏 SOP 样本`,
    createdAt: seedStartedAt,
    updatedAt: seedStartedAt,
  }];

  const knowledgeDocumentRecords = sopDocuments.map(([key, title]) => ({
    id: documentId(key),
    tenantId: DEMO_TENANT_ID,
    institutionId: DEMO_INSTITUTION_ID,
    workspaceId: DEMO_WORKSPACE_ID,
    sourceId: deterministicId('kb-source', 'sop'),
    sourceKind: 'demo' as const,
    status: 'ready' as const,
    readonlyStatus: 'readonly' as const,
    title,
    version: DEMO_SEED_KEY,
    createdAt: seedStartedAt,
    updatedAt: seedStartedAt,
  }));

  const knowledgeChunkRecords = sopDocuments.flatMap(([key, , chunks]) =>
    chunks.map((chunkLabel, chunkIndex) => ({
      id: chunkId(key, chunkIndex),
      tenantId: DEMO_TENANT_ID,
      institutionId: DEMO_INSTITUTION_ID,
      workspaceId: DEMO_WORKSPACE_ID,
      documentId: documentId(key),
      sourceKind: 'demo' as const,
      status: 'ready' as const,
      readonlyStatus: 'readonly' as const,
      chunkLabel: `${chunkLabel}（${DEMO_SEED_KEY}）`,
      chunkIndex,
      createdAt: seedStartedAt,
      updatedAt: seedStartedAt,
    })),
  );

  const knowledgeIndexJobRecords = sopDocuments.map(([key]) => ({
    id: deterministicId('kb-index-job', key),
    tenantId: DEMO_TENANT_ID,
    institutionId: DEMO_INSTITUTION_ID,
    workspaceId: DEMO_WORKSPACE_ID,
    documentId: documentId(key),
    sourceKind: 'demo' as const,
    status: 'ready' as const,
    readonlyStatus: 'readonly' as const,
    jobKind: 'demo_low_sensitive_index_ready',
    createdAt: seedStartedAt,
    updatedAt: seedStartedAt,
  }));

  const followUpCustomerTimelineEventRecords = customerProfiles.flatMap((profile) => {
    const firstDraft = followUpMessageDraftRecords.find((draft) => draft.customerId === customerId(profile.key));
    const taskGeneratedSourceId = `${enrollmentId(profile.key)}:tasks_generated`;
    const baseEvents = [
      {
        id: deterministicId('timeline', profile.key, 'path-enrolled'),
        sourceType: 'path_enrollment' as const,
        sourceId: enrollmentId(profile.key),
        eventType: 'followup_path_enrolled' as const,
        eventTitle: '纳入随访路径',
        safeSummary: `${profile.displayName} 已纳入 ${profile.templateKey}，生成 D1 / D3 / D7 人工任务。`,
        riskLevel: null,
        safeActorRole: 'tenant_operator',
      },
      {
        id: deterministicId('timeline', profile.key, 'tasks-generated'),
        sourceType: 'path_enrollment' as const,
        sourceId: taskGeneratedSourceId,
        eventType: 'followup_tasks_generated' as const,
        eventTitle: '生成阶段随访任务',
        safeSummary: `已生成 D1 / D3 / D7 阶段任务，全部需要人工处理。`,
        riskLevel: null,
        safeActorRole: 'tenant_operator',
      },
      {
        id: deterministicId('timeline', profile.key, 'manual-feedback'),
        sourceType: 'manual_note' as const,
        sourceId: `manual:${customerId(profile.key)}:${DEMO_SEED_KEY}`,
        eventType: 'manual_feedback_recorded' as const,
        eventTitle: '人工低敏反馈',
        safeSummary: `${profile.ownerRole}记录低敏恢复反馈：${profile.recoveryStage} 节点继续观察，不含联系方式或病历信息。`,
        riskLevel: profile.riskLevel,
        safeActorRole: 'tenant_operator',
      },
    ];

    const draftEvent = firstDraft
      ? [{
          id: deterministicId('timeline', profile.key, 'draft-created'),
          sourceType: 'message_draft' as const,
          sourceId: `${firstDraft.id}:message_draft_created`,
          eventType: 'message_draft_created' as const,
          eventTitle: '消息草稿已生成',
          safeSummary: `${firstDraft.safePreview} 标记已发送仅代表人工记录，不代表系统自动发送。`,
          riskLevel: null,
          safeActorRole: 'customer_service',
        }]
      : [];

    return [...baseEvents, ...draftEvent].map((event, index) => ({
      ...event,
      tenantId: DEMO_TENANT_ID,
      institutionId: DEMO_INSTITUTION_ID,
      customerId: customerId(profile.key),
      occurredAt: isoAt(index, 9),
      safeReasonCode: event.eventType,
      metadataJson: {
        ...seedMetadata,
        templateKey: profile.templateKey,
        currentPathStatus: `已纳入 ${profile.templateKey}`,
      },
      createdAt: isoAt(index, 9),
      updatedAt: isoAt(index, 9),
    }));
  });

  return {
    authUsers: authUserRecords,
    tenants: tenantRecords,
    tenantMembers: tenantMemberRecords,
    customers: customerRecords,
    treatmentSummaries: treatmentSummaryRecords,
    followUpTasks: followUpTaskRecords,
    followUpPathEnrollments: followUpPathEnrollmentRecords,
    followUpPathStages: followUpPathStageRecords,
    followUpMessageTemplates: followUpMessageTemplateRecords,
    followUpMessageDrafts: followUpMessageDraftRecords,
    followUpCustomerTimelineEvents: followUpCustomerTimelineEventRecords,
    knowledgeSources: knowledgeSourceRecords,
    knowledgeDocuments: knowledgeDocumentRecords,
    knowledgeChunks: knowledgeChunkRecords,
    knowledgeIndexJobs: knowledgeIndexJobRecords,
  };
}

export function parseCliArgs(argv: string[]): CliOptions {
  const args = new Set(argv);
  const cleanup = args.has('--cleanup');
  const apply = args.has('--apply');
  const dryRun = args.has('--dry-run');

  if (cleanup && apply) {
    throw new Error('不能同时传入 --apply 和 --cleanup；请分开执行 seed 或 cleanup。');
  }

  if (cleanup) return { mode: dryRun ? 'dry-run' : 'cleanup' };
  if (apply) return { mode: 'apply' };
  return { mode: 'dry-run' };
}

export function checkDemoSeedEnv(env: DemoSeedEnv = process.env) {
  if (env[DEMO_SEED_ENV_FLAG] !== '1') {
    throw new Error(`${DEMO_SEED_ENV_FLAG}=1 is required for --apply or --cleanup`);
  }
}

export function checkSafeDatabaseUrl(databaseUrl: string | undefined): SafeDatabaseUrlCheck {
  if (!databaseUrl) {
    return { allowed: false, host: null, reason: 'missing_database_url' };
  }

  try {
    const url = new URL(databaseUrl);
    const hostname = url.hostname.toLowerCase();
    const hostText = `${hostname} ${url.pathname.toLowerCase()} ${url.username.toLowerCase()}`;

    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '[::1]') {
      return { allowed: true, host: hostname, reason: 'localhost' };
    }

    if (/demo|demonstration|preview|staging-demo|local-demo/u.test(hostText)) {
      return { allowed: true, host: hostname, reason: 'demo_marker' };
    }

    return { allowed: false, host: hostname, reason: 'unsafe_host' };
  } catch {
    return { allowed: false, host: null, reason: 'invalid_database_url' };
  }
}

export function assertWriteGuards(env: DemoSeedEnv = process.env) {
  checkDemoSeedEnv(env);
  const check = checkSafeDatabaseUrl(env.DATABASE_URL);

  if (!check.allowed) {
    throw new Error(`DATABASE_URL host is not allowed for demo seed: ${check.reason}`);
  }
}

function ids<T extends { id: string }>(records: readonly T[]) {
  return records.map((record) => record.id);
}

export function getCleanupPlan(records: SeedRecordSet = buildDemoSeedRecords()) {
  return {
    followUpCustomerTimelineEvents: ids(records.followUpCustomerTimelineEvents),
    followUpMessageDrafts: ids(records.followUpMessageDrafts),
    followUpPathStages: ids(records.followUpPathStages),
    followUpPathEnrollments: ids(records.followUpPathEnrollments),
    followUpTasks: ids(records.followUpTasks),
    followUpMessageTemplates: ids(records.followUpMessageTemplates),
    knowledgeIndexJobs: ids(records.knowledgeIndexJobs),
    knowledgeChunks: ids(records.knowledgeChunks),
    knowledgeDocuments: ids(records.knowledgeDocuments),
    knowledgeSources: ids(records.knowledgeSources),
    treatmentSummaries: ids(records.treatmentSummaries),
    customers: ids(records.customers),
    tenantMembers: ids(records.tenantMembers),
    tenants: ids(records.tenants),
    authUsers: ids(records.authUsers),
  };
}

export function summarizeSeedRecords(records: SeedRecordSet = buildDemoSeedRecords()) {
  return Object.fromEntries(
    Object.entries(records).map(([key, value]) => [key, Array.isArray(value) ? value.length : 0]),
  ) as Record<keyof SeedRecordSet, number>;
}

export function assertLowSensitiveSeed(records: SeedRecordSet = buildDemoSeedRecords()) {
  const serialized = JSON.stringify(records);
  const disallowedPatterns = [
    /1[3-9]\d{9}/u,
    /\d{6}(?:19|20)\d{2}\d{2}\d{2}\d{3}[\dXx]/u,
    /\bMR[-_A-Z0-9]{3,}\b/iu,
    /(?:省|市|区|县).{0,20}(?:路|街|号楼|单元)/u,
    /postgres:\/\//iu,
    /mysql:\/\//iu,
    /DATABASE_URL/iu,
    /api[_\s-]?key/iu,
    /secret/iu,
    /provider/iu,
    /token/iu,
    /cost/iu,
    /vendor/iu,
  ];

  for (const pattern of disallowedPatterns) {
    if (pattern.test(serialized)) {
      throw new Error(`Demo seed contains disallowed sensitive pattern: ${pattern.source}`);
    }
  }

  const invalidCustomers = records.customers.filter(
    (customer) => customer.maskedPhone !== lowSensitivePlaceholder || customer.maskedMedicalRecordNo !== lowSensitivePlaceholder,
  );

  if (invalidCustomers.length > 0) {
    throw new Error('Demo seed customers must not contain phone or medical record placeholders other than 未采集');
  }
}

function toSnakeCase(value: string) {
  return value.replace(/[A-Z]/gu, (match) => `_${match.toLowerCase()}`);
}

function toDbRecord(record: Record<string, unknown>): DbRecord {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [toSnakeCase(key), value as DbScalar]),
  );
}

async function insertIfMissing<T extends { id: string }>(
  db: DemoDatabase,
  tableName: string,
  records: readonly T[],
): Promise<TableMutationSummary> {
  if (records.length === 0) return { tableName, created: 0, already_exists: 0, skipped: 0 };
  const rows = records.map((record) => toDbRecord(record));
  const createdRows = await db<RowId[]>`
    insert into ${db(tableName)} ${db(rows)} on conflict (id) do nothing returning id
  `;
  const created = createdRows.length;
  return {
    tableName,
    created,
    already_exists: records.length - created,
    skipped: 0,
  };
}

async function deleteByIds(
  db: DemoDatabase,
  tableName: string,
  columnName: string,
  recordIds: string[],
): Promise<TableMutationSummary> {
  if (recordIds.length === 0) return { tableName, cleaned: 0, skipped: 0 };
  const deletedRows = await db<RowId[]>`
    delete from ${db(tableName)} where ${db(columnName)} in ${db(recordIds)} returning id
  `;
  const cleaned = deletedRows.length;
  return {
    tableName,
    cleaned,
    skipped: recordIds.length - cleaned,
  };
}

export async function applyDemoSeed(
  db: DemoDatabase,
  records: SeedRecordSet = buildDemoSeedRecords(),
): Promise<SeedApplySummary> {
  assertLowSensitiveSeed(records);

  const tables = [
    await insertIfMissing(db, 'auth_users', records.authUsers),
    await insertIfMissing(db, 'tenants', records.tenants),
    await insertIfMissing(db, 'tenant_members', records.tenantMembers),
    await insertIfMissing(db, 'customers', records.customers),
    await insertIfMissing(db, 'treatment_summaries', records.treatmentSummaries),
    await insertIfMissing(db, 'follow_up_tasks', records.followUpTasks),
    await insertIfMissing(db, 'follow_up_path_enrollments', records.followUpPathEnrollments),
    await insertIfMissing(db, 'follow_up_path_stages', records.followUpPathStages),
    await insertIfMissing(db, 'follow_up_message_templates', records.followUpMessageTemplates),
    await insertIfMissing(db, 'follow_up_message_drafts', records.followUpMessageDrafts),
    await insertIfMissing(db, 'follow_up_customer_timeline_events', records.followUpCustomerTimelineEvents),
    await insertIfMissing(db, 'knowledge_sources', records.knowledgeSources),
    await insertIfMissing(db, 'knowledge_documents', records.knowledgeDocuments),
    await insertIfMissing(db, 'knowledge_chunks', records.knowledgeChunks),
    await insertIfMissing(db, 'knowledge_index_jobs', records.knowledgeIndexJobs),
  ];

  return { mode: 'apply', seedKey: DEMO_SEED_KEY, tables };
}

export async function cleanupDemoSeed(
  db: DemoDatabase,
  records: SeedRecordSet = buildDemoSeedRecords(),
): Promise<SeedCleanupSummary> {
  const cleanupPlan = getCleanupPlan(records);
  const tables = [
    await deleteByIds(db, 'follow_up_customer_timeline_events', 'id', cleanupPlan.followUpCustomerTimelineEvents),
    await deleteByIds(db, 'follow_up_message_drafts', 'id', cleanupPlan.followUpMessageDrafts),
    await deleteByIds(db, 'follow_up_path_stages', 'id', cleanupPlan.followUpPathStages),
    await deleteByIds(db, 'follow_up_path_enrollments', 'id', cleanupPlan.followUpPathEnrollments),
    await deleteByIds(db, 'follow_up_tasks', 'id', cleanupPlan.followUpTasks),
    await deleteByIds(db, 'follow_up_message_templates', 'id', cleanupPlan.followUpMessageTemplates),
    await deleteByIds(db, 'knowledge_index_jobs', 'id', cleanupPlan.knowledgeIndexJobs),
    await deleteByIds(db, 'knowledge_chunks', 'id', cleanupPlan.knowledgeChunks),
    await deleteByIds(db, 'knowledge_documents', 'id', cleanupPlan.knowledgeDocuments),
    await deleteByIds(db, 'knowledge_sources', 'id', cleanupPlan.knowledgeSources),
    await deleteByIds(db, 'treatment_summaries', 'id', cleanupPlan.treatmentSummaries),
    await deleteByIds(db, 'customers', 'id', cleanupPlan.customers),
    await deleteByIds(db, 'tenant_members', 'id', cleanupPlan.tenantMembers),
  ];

  const remainingSeedScopedRows = await db<RowId[]>`
    select id from tenant_members where tenant_id = ${DEMO_TENANT_ID}
  `;

  if (remainingSeedScopedRows.length === 0) {
    tables.push(await deleteByIds(db, 'tenants', 'id', cleanupPlan.tenants));
  } else {
    tables.push({ tableName: 'tenants', cleaned: 0, skipped: cleanupPlan.tenants.length });
  }

  tables.push(await deleteByIds(db, 'auth_users', 'id', cleanupPlan.authUsers));

  return { mode: 'cleanup', seedKey: DEMO_SEED_KEY, tables };
}

function printPlan(mode: CliMode, records: SeedRecordSet) {
  const summary = summarizeSeedRecords(records);
  console.log(JSON.stringify({
    seedKey: DEMO_SEED_KEY,
    mode,
    action: mode === 'dry-run' ? 'preview_only' : mode,
    records: summary,
    skipped: mode === 'dry-run' ? Object.values(summary).reduce((total, count) => total + count, 0) : 0,
    safety: {
      lowSensitiveOnly: true,
      noMessageSend: true,
      noHis: true,
      noExternalCallback: true,
      noAiCall: true,
    },
  }, null, 2));
}

function printMutationSummary(summary: SeedApplySummary | SeedCleanupSummary) {
  console.log(JSON.stringify(summary, null, 2));
}

async function runCli() {
  const options = parseCliArgs(process.argv.slice(2));
  const records = buildDemoSeedRecords();
  assertLowSensitiveSeed(records);
  printPlan(options.mode, records);

  if (options.mode === 'dry-run') return;

  assertWriteGuards();
  const client = postgres(process.env.DATABASE_URL as string, { max: 1, prepare: false });
  const db = client;

  try {
    if (options.mode === 'apply') {
      printMutationSummary(await applyDemoSeed(db, records));
    } else {
      printMutationSummary(await cleanupDemoSeed(db, records));
    }
  } finally {
    await client.end();
  }
}

function isDirectRun() {
  return process.argv[1] ? fileURLToPath(import.meta.url) === resolve(process.argv[1]) : false;
}

if (isDirectRun()) {
  runCli().catch((error) => {
    console.error(error instanceof Error ? error.message : 'demo seed failed');
    process.exit(1);
  });
}
