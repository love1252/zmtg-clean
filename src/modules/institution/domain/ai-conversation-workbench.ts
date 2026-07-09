import type { AuditReason } from '@/modules/audit/domain/audit-events';
import {
  createAiAutoStrategyTimelineMetadata,
  evaluateAiAutoStrategy,
  type AiAutoStrategyContext,
  type AiAutoStrategyResult,
} from '@/modules/institution/domain/ai-auto-strategy';
import {
  approveFollowUpMessageDraft,
  type FollowUpMessageDraft,
} from '@/modules/institution/domain/followup-message-drafts';
import {
  createMessageDeliveryFromApprovedDraft,
  mapMessageDeliveryToDto,
  messageDeliveryToTimelineMetadata,
  type MessageDeliveryDto,
} from '@/modules/institution/domain/followup-message-deliveries';
import {
  buildRealChannelPreflightStats,
  createDefaultRealChannelPreflightInput,
  createRealChannelPreflightTimelineMetadata,
  evaluateRealChannelPreflight,
  type RealChannelPreflightResult,
  type RealChannelPreflightStats,
  type RealChannelRoute,
} from '@/modules/institution/domain/real-channel-preflight';
import {
  buildWeComOfficialDryRunStats,
  createDefaultWeComOfficialDryRunInput,
  createWeComOfficialDryRunTimelineMetadata,
  evaluateWeComOfficialDryRun,
  type WeComOfficialDryRunResult,
  type WeComOfficialDryRunStats,
} from '@/modules/institution/domain/wecom-official-dry-run';
import {
  buildWeComOfficialDryRunConfigStats,
  createDefaultWeComOfficialDryRunConfigInput,
  createWeComOfficialDryRunTimelineMetadata as createWeComOfficialDryRunConfigTimelineMetadata,
  evaluateWeComOfficialDryRunConfig,
  type WeComOfficialDryRunConfigResult,
  type WeComOfficialDryRunConfigStats,
} from '@/modules/institution/domain/wecom-official-dry-run-config';

export const aiConversationStatuses = [
  'ai_handling',
  'waiting_human',
  'human_takeover',
  'closed',
] as const;

export type AiConversationStatus = (typeof aiConversationStatuses)[number];
export type AiConversationFilter = 'all' | 'ai' | 'waiting_human' | 'human_takeover';

export const aiConversationAuditReasons = [
  'ai_conversation_viewed',
  'ai_conversation_takeover',
  'ai_conversation_recommendation_used',
  'ai_conversation_message_mock_sent',
  'ai_conversation_risk_blocked',
  'ai_conversation_closed',
  'ai_auto_strategy_evaluated',
  'ai_auto_reply_mock_allowed',
  'ai_auto_followup_mock_allowed',
  'ai_auto_reply_human_confirmation_required',
  'ai_auto_followup_human_confirmation_required',
  'ai_auto_reply_blocked',
  'ai_auto_followup_blocked',
  'ai_marketing_automation_blocked',
  'ai_add_friend_blocked',
  'real_channel_preflight_viewed',
  'real_channel_preflight_evaluated',
  'real_channel_preflight_blocked',
  'real_channel_proof_mock_eligible',
  'real_channel_sensitive_config_blocked',
  'account_custody_route_blocked',
  'wecom_dry_run_config_viewed',
  'wecom_dry_run_config_evaluated',
  'wecom_dry_run_ready',
  'wecom_dry_run_blocked',
  'wecom_dry_run_sensitive_value_blocked',
  'wecom_dry_run_secret_read_blocked',
  'wecom_official_dry_run_viewed',
  'wecom_official_dry_run_evaluated',
  'wecom_official_dry_run_plan_ready',
  'wecom_official_dry_run_mock_completed',
  'wecom_official_dry_run_blocked',
  'wecom_official_dry_run_sensitive_payload_blocked',
  'wecom_official_dry_run_real_network_blocked',
  'wecom_official_dry_run_real_send_blocked',
] as const satisfies readonly AuditReason[];

export type AiConversationAuditReason = (typeof aiConversationAuditReasons)[number];

export const aiConversationRiskTags = [
  'medical_advice_risk',
  'efficacy_commitment_risk',
  'price_commitment_risk',
  'allergy_or_postoperative_abnormal_risk',
  'complaint_or_dissatisfaction_risk',
  'privacy_field_leakage_risk',
] as const;

export type AiConversationRiskTag = (typeof aiConversationRiskTags)[number];

export const aiConversationRiskTagLabels = {
  medical_advice_risk: '医疗建议风险',
  efficacy_commitment_risk: '疗效承诺风险',
  price_commitment_risk: '价格承诺风险',
  allergy_or_postoperative_abnormal_risk: '过敏 / 术后异常风险',
  complaint_or_dissatisfaction_risk: '投诉 / 不满风险',
  privacy_field_leakage_risk: '隐私字段泄露风险',
} as const satisfies Record<AiConversationRiskTag, string>;

export const aiConversationStatusLabels = {
  ai_handling: 'AI 处理中',
  waiting_human: '待接管',
  human_takeover: '人工',
  closed: '已结束',
} as const satisfies Record<AiConversationStatus, string>;

export type AiConversationMessageSender = 'customer' | 'ai' | 'human' | 'system';

export type AiConversationMessage = {
  id: string;
  sender: AiConversationMessageSender;
  safeSummary: string;
  occurredAt: string;
  delivery?: MessageDeliveryDto;
};

export type AiConversationRecommendation = {
  id: string;
  title: string;
  safeContent: string;
  sourceSummary: string;
  confidenceLabel: string;
};

export type AiConversationProjectRecommendation = {
  id: string;
  name: string;
  matchLabel: string;
  safeReason: string;
  priceBand: string;
};

export type AiConversationProfile = {
  customerDisplayName: string;
  customerMaskedRef: string;
  ownerMaskedRef: string;
  lowSensitiveCustomerSummary: string;
  lowSensitiveMessageSummary: string;
  consumptionPower: string;
  projectPreference: string;
  repurchaseIntent: string;
  recentVisit: string;
  recentAccess: string;
  followUpTaskSummary: string;
  knowledgeSourceSummary: string;
};

export type AiConversationTimelineEvent = {
  id: string;
  title: string;
  safeSummary: string;
  auditReason: AiConversationAuditReason;
  occurredAt: string;
  metadata?: Record<string, string | null>;
};

export type AiConversationAutomationStrategy = {
  context: AiAutoStrategyContext;
  result: AiAutoStrategyResult;
};

export type AiConversationRecord = {
  id: string;
  status: AiConversationStatus;
  aiProcessingLabel: string;
  customerDisplayName: string;
  customerMaskedRef: string;
  ownerMaskedRef: string;
  recentMessageSummary: string;
  canTakeover: boolean;
  hasRiskWarning: boolean;
  hasRecommendation: boolean;
  riskTags: AiConversationRiskTag[];
  recommendedQuestions: string[];
  recommendations: AiConversationRecommendation[];
  projectRecommendations: AiConversationProjectRecommendation[];
  automationStrategy: AiConversationAutomationStrategy;
  realChannelPreflight: RealChannelPreflightResult;
  weComOfficialDryRunConfig: WeComOfficialDryRunConfigResult;
  weComOfficialDryRun: WeComOfficialDryRunResult;
  profile: AiConversationProfile;
  messages: AiConversationMessage[];
  timeline: AiConversationTimelineEvent[];
};

export type AiConversationWorkbenchStats = {
  totalCount: number;
  aiHandlingCount: number;
  waitingHumanCount: number;
  humanTakeoverCount: number;
  riskWarningCount: number;
  recommendationCount: number;
  mockSentCount: number;
  closedCount: number;
  strategyEvaluatedCount: number;
  aiRecommendOnlyCount: number;
  humanConfirmationRequiredCount: number;
  mockAutoReplyAllowedCount: number;
  mockAutoFollowupAllowedCount: number;
  highRiskBlockedCount: number;
  marketingAutomationBlockedCount: number;
  addFriendBlockedCount: number;
} & RealChannelPreflightStats & WeComOfficialDryRunConfigStats & WeComOfficialDryRunStats;

const occurredAt = {
  aiEntered: '2026-07-08T09:05:00.000+08:00',
  waiting: '2026-07-08T09:12:00.000+08:00',
  human: '2026-07-08T09:18:00.000+08:00',
  closed: '2026-07-08T09:30:00.000+08:00',
};

export const aiConversationBoundaryLabels = [
  '当前为模拟版',
  '不接真实企业微信 / 微信',
  '不接短信 / HIS / webhook',
  '不真实发送',
  '不真实出网',
  '自动回复仅策略模拟',
  '自动随访仅策略模拟',
  '发送前人工确认',
  '只展示低敏摘要',
] as const;

export const aiConversationReferenceLabels = [
  '客服工作台：医美咨询账号列、会话列表、聊天窗口、档案 / AI 面板',
  '消息接入：全部 / AI / 待接管 / 人工状态筛选',
  '接管边界：点击接管后才允许生成模拟发送记录',
  '快捷回复：推荐回复只填入草稿，发送前人工确认',
  '右侧 AI 面板：推荐回复、风险预警、推荐项目、用户画像',
  '敏感词监控：风险词阻断并写低敏 audit',
  '客服中心教程：客服管理、消息接入、分流详情仅作低敏参考',
  '群发客服 / 素材收录：本任务不实现群发和真实触达',
  'AI 知识库：只展示低敏依据摘要',
] as const;

const forbiddenAiConversationTextPatterns = [
  /1[3-9]\d{9}/u,
  /\d{6}(?:19|20)\d{2}\d{2}\d{2}\d{3}[\dXx]/u,
  /\bMR[-_A-Z0-9]{3,}\b/iu,
  /完整病历|病历号|身份证|手机号原文|真实微信|external_userid|userid|corpId|聊天原文|咨询全文/u,
  /机器编号|扫码托管|端口托管|uip|真实端口|真实扫码/u,
  /(?:\bHIS\b payload|his payload|webhook payload|webhook_secret|access_token|api key|DATABASE_URL)/iu,
];

const highRiskSendPatterns: Array<{ tag: AiConversationRiskTag; pattern: RegExp }> = [
  { tag: 'medical_advice_risk', pattern: /自行用药|诊断为|无需就医|可以不用医生|直接处理/u },
  { tag: 'efficacy_commitment_risk', pattern: /保证|一定有效|永久|无风险|百分百/u },
  { tag: 'price_commitment_risk', pattern: /最低价|锁定价格|承诺价格|绝对优惠/u },
  { tag: 'allergy_or_postoperative_abnormal_risk', pattern: /过敏|红肿加重|术后异常|出血|感染/u },
  { tag: 'complaint_or_dissatisfaction_risk', pattern: /投诉|退款|不满意|维权|纠纷/u },
  { tag: 'privacy_field_leakage_risk', pattern: /1[3-9]\d{9}|身份证|病历号|external_userid|userid|corpId/u },
];

function assertLowSensitiveText(value: string) {
  return !forbiddenAiConversationTextPatterns.some((pattern) => pattern.test(value));
}

function safeText(value: string, fallback: string) {
  const normalized = value.normalize('NFKC').replace(/\s+/gu, ' ').trim().slice(0, 500);
  return normalized && assertLowSensitiveText(normalized) ? normalized : fallback;
}

function createTimelineEvent(input: Omit<AiConversationTimelineEvent, 'safeSummary'> & { safeSummary: string }) {
  return {
    ...input,
    safeSummary: safeText(input.safeSummary, '低敏会话事件摘要已隐藏。'),
  };
}

function createAutomationStrategyContext(input: {
  conversationId: string;
  customerMaskedRef: string;
  conversationStatus: AiConversationStatus;
  intentType: AiAutoStrategyContext['intentType'];
  riskTags?: AiConversationRiskTag[];
  hasConsent?: boolean;
  hasOptOut?: boolean;
  frequencyCapPassed?: boolean;
  isAftercareFollowup?: boolean;
  isMarketing?: boolean;
  isAddFriendIntent?: boolean;
  isComplaint?: boolean;
  isMedicalRisk?: boolean;
  isPriceCommitmentRisk?: boolean;
  operatorRole?: AiAutoStrategyContext['operatorRole'];
}): AiAutoStrategyContext {
  const riskTags = input.riskTags ?? [];

  return {
    conversationId: input.conversationId,
    tenantId: 'tenant-low-sensitive-001',
    institutionId: 'institution-low-sensitive-001',
    customerMaskedRef: safeText(input.customerMaskedRef, '客户 ZM****000'),
    conversationStatus: input.conversationStatus,
    intentType: input.intentType,
    riskTags,
    hasConsent: input.hasConsent ?? true,
    hasOptOut: input.hasOptOut ?? false,
    frequencyCapPassed: input.frequencyCapPassed ?? true,
    isAftercareFollowup: input.isAftercareFollowup ?? false,
    isMarketing: input.isMarketing ?? false,
    isAddFriendIntent: input.isAddFriendIntent ?? false,
    isComplaint: input.isComplaint ?? riskTags.includes('complaint_or_dissatisfaction_risk'),
    isMedicalRisk: input.isMedicalRisk ?? riskTags.some((tag) => tag === 'medical_advice_risk' || tag === 'allergy_or_postoperative_abnormal_risk'),
    isPriceCommitmentRisk: input.isPriceCommitmentRisk ?? riskTags.includes('price_commitment_risk'),
    safetySwitchSummary: {
      emergencyStopEnabled: true,
      allowRealSend: false,
      externalChannelEnabled: false,
    },
    operatorRole: input.operatorRole ?? 'customer_service',
  };
}

function createAutomationStrategy(
  context: AiAutoStrategyContext,
): AiConversationAutomationStrategy {
  return {
    context,
    result: evaluateAiAutoStrategy(context),
  };
}

function createAutomationStrategyTimelineEvent(input: {
  conversationId: string;
  strategy: AiConversationAutomationStrategy;
  occurredAt: string;
}) {
  return createTimelineEvent({
    id: `${input.conversationId}:timeline:auto-strategy:${input.strategy.result.decision}:${input.occurredAt}`,
    title: '自动化策略评估',
    safeSummary: input.strategy.result.timelineSummary,
    auditReason: input.strategy.result.auditReason,
    occurredAt: input.occurredAt,
    metadata: createAiAutoStrategyTimelineMetadata(input.strategy.result),
  });
}

function createRealChannelPreflightTimelineEvent(input: {
  conversationId: string;
  preflight: RealChannelPreflightResult;
  occurredAt: string;
}) {
  return createTimelineEvent({
    id: `${input.conversationId}:timeline:real-channel-preflight:${input.preflight.preflightStatus}:${input.occurredAt}:${input.preflight.auditReason}`,
    title: '真实通道前置检查',
    safeSummary: input.preflight.timelineSummary,
    auditReason: input.preflight.auditReason,
    occurredAt: input.occurredAt,
    metadata: createRealChannelPreflightTimelineMetadata(input.preflight),
  });
}

function createPreflightForConversation(input: {
  conversation: Pick<AiConversationRecord, 'id' | 'riskTags'>;
  strategy: AiConversationAutomationStrategy;
  hasManualConfirmation?: boolean;
  channelRoute?: RealChannelRoute;
}) {
  return evaluateRealChannelPreflight(createDefaultRealChannelPreflightInput({
    channelRoute: input.channelRoute ?? 'official_wecom_self_built',
    hasManualConfirmation: input.hasManualConfirmation ?? false,
    hasConsent: input.strategy.context.hasConsent,
    hasOptOut: input.strategy.context.hasOptOut,
    frequencyCapPassed: input.strategy.context.frequencyCapPassed,
    aiStrategyDecision: input.strategy.result.decision,
    aiStrategyLevel: input.strategy.result.recommendedLevel,
    riskTags: input.conversation.riskTags,
    safetySwitchSummary: input.strategy.result.safetySwitchSummary,
    allowRealSend: false,
    externalChannelEnabled: false,
    emergencyStopEnabled: input.strategy.result.safetySwitchSummary.emergencyStopEnabled,
    isAccountCustodyRoute: input.channelRoute === 'account_custody',
  }));
}

function createWeComOfficialDryRunTimelineEvent(input: {
  conversationId: string;
  config: WeComOfficialDryRunConfigResult;
  occurredAt: string;
}) {
  return createTimelineEvent({
    id: `${input.conversationId}:timeline:wecom-official-dry-run:${input.config.configStatus}:${input.occurredAt}:${input.config.auditReason}`,
    title: '企微 dry-run 配置',
    safeSummary: input.config.timelineSummary,
    auditReason: input.config.auditReason,
    occurredAt: input.occurredAt,
    metadata: createWeComOfficialDryRunConfigTimelineMetadata(input.config),
  });
}

function createOfficialRouteDryRunTimelineEvent(input: {
  conversationId: string;
  dryRun: WeComOfficialDryRunResult;
  occurredAt: string;
}) {
  return createTimelineEvent({
    id: `${input.conversationId}:timeline:wecom-official-route-dry-run:${input.dryRun.dryRunStatus}:${input.occurredAt}:${input.dryRun.auditReason}`,
    title: '官方路线 dry-run',
    safeSummary: input.dryRun.timelineSummary,
    auditReason: input.dryRun.auditReason,
    occurredAt: input.occurredAt,
    metadata: createWeComOfficialDryRunTimelineMetadata(input.dryRun),
  });
}

function createWeComDryRunConfigForConversation(input: {
  preflight: RealChannelPreflightResult;
  hasManualConfirmation?: boolean;
  officialRoute?: RealChannelRoute;
}) {
  return evaluateWeComOfficialDryRunConfig(createDefaultWeComOfficialDryRunConfigInput({
    officialRoute: input.officialRoute ?? input.preflight.channelRoute,
    preflightStatus: input.preflight.preflightStatus,
    proofEligibleMock: input.preflight.proofEligibleMock,
    hasManualConfirmation: input.hasManualConfirmation ?? false,
    hasSecretKeeperConfirmed: input.preflight.proofEligibleMock,
    hasTestWeComEnvironment: true,
    hasCallbackDomainPlaceholder: true,
    callbackUrlPlaceholder: 'https://callback-placeholder.example.test/wecom/dry-run',
    allowRealSend: false,
    externalChannelEnabled: false,
    realSendAllowed: false,
    dryRunOnly: true,
  }));
}

function createOfficialRouteDryRunForConversation(input: {
  preflight: RealChannelPreflightResult;
  config: WeComOfficialDryRunConfigResult;
  hasManualConfirmation?: boolean;
  networkMode?: 'disabled' | 'mock';
}) {
  return evaluateWeComOfficialDryRun(createDefaultWeComOfficialDryRunInput({
    tenantId: input.config.tenantId,
    institutionId: input.config.institutionId ?? 'institution-low-sensitive-001',
    operatorRole: input.config.operatorRole,
    officialRoute: input.config.officialRoute,
    dryRunConfigStatus: input.config.configStatus,
    preflightStatus: input.preflight.preflightStatus,
    proofEligibleMock: input.preflight.proofEligibleMock,
    hasManualConfirmation: input.hasManualConfirmation ?? false,
    hasSecretPlaceholder: input.config.dryRunReady,
    hasCallbackUrlPlaceholder: Boolean(input.config.callbackUrlPlaceholder),
    networkMode: input.networkMode ?? (input.config.dryRunReady ? 'mock' : 'disabled'),
    allowRealSend: false,
    externalChannelEnabled: false,
    realSendAllowed: false,
    noSecretRead: true,
    noRealSend: true,
    dryRunOnly: true,
  }));
}

function withAutomationStrategy<T extends Omit<AiConversationRecord, 'automationStrategy' | 'realChannelPreflight' | 'weComOfficialDryRunConfig' | 'weComOfficialDryRun' | 'timeline'> & { timeline: AiConversationTimelineEvent[] }>(
  conversation: T,
  context: AiAutoStrategyContext,
): AiConversationRecord {
  const automationStrategy = createAutomationStrategy(context);
  const realChannelPreflight = createPreflightForConversation({
    conversation,
    strategy: automationStrategy,
    hasManualConfirmation: conversation.status === 'human_takeover',
  });
  const weComOfficialDryRunConfig = createWeComDryRunConfigForConversation({
    preflight: realChannelPreflight,
    hasManualConfirmation: conversation.status === 'human_takeover',
  });
  const weComOfficialDryRun = createOfficialRouteDryRunForConversation({
    preflight: realChannelPreflight,
    config: weComOfficialDryRunConfig,
    hasManualConfirmation: conversation.status === 'human_takeover',
  });

  return {
    ...conversation,
    automationStrategy,
    realChannelPreflight,
    weComOfficialDryRunConfig,
    weComOfficialDryRun,
    timeline: [
      ...conversation.timeline,
      createAutomationStrategyTimelineEvent({
        conversationId: conversation.id,
        strategy: automationStrategy,
        occurredAt: occurredAt.aiEntered,
      }),
      createRealChannelPreflightTimelineEvent({
        conversationId: conversation.id,
        preflight: realChannelPreflight,
        occurredAt: occurredAt.aiEntered,
      }),
      createWeComOfficialDryRunTimelineEvent({
        conversationId: conversation.id,
        config: weComOfficialDryRunConfig,
        occurredAt: occurredAt.aiEntered,
      }),
      createOfficialRouteDryRunTimelineEvent({
        conversationId: conversation.id,
        dryRun: weComOfficialDryRun,
        occurredAt: occurredAt.aiEntered,
      }),
    ],
  };
}

export function getAiConversationWorkbenchFixture(): AiConversationRecord[] {
  return [
    withAutomationStrategy({
      id: 'ai-conv-001',
      status: 'ai_handling',
      aiProcessingLabel: 'AI 处理中',
      customerDisplayName: '王女士',
      customerMaskedRef: '客户 QY****001',
      ownerMaskedRef: '客服 CS****A',
      recentMessageSummary: '咨询水光护理后的恢复节奏，等待 AI 推荐回复。',
      canTakeover: true,
      hasRiskWarning: true,
      hasRecommendation: true,
      riskTags: ['medical_advice_risk', 'allergy_or_postoperative_abnormal_risk'],
      recommendedQuestions: ['客户担心恢复期怎么回复？', '客户询问价格时怎么回复？', '水光针做完多久可以化妆？'],
      recommendations: [
        {
          id: 'rec-001-care',
          title: '水光恢复期低敏回复',
          safeContent: '您好，轻微泛红属于常见恢复反馈，请先加强保湿和观察；如果不适持续加重，我会帮您转人工跟进。',
          sourceSummary: '依据：AI 知识库低敏摘要 / 工作台快捷回复样式。',
          confidenceLabel: '建议人工确认后使用',
        },
      ],
      projectRecommendations: [
        {
          id: 'proj-001-repair',
          name: '光子嫩肤 + 水光护理组合',
          matchLabel: '88% 匹配',
          safeReason: '与水光、抗衰、恢复期低敏标签匹配。',
          priceBand: '价格需人工确认，不自动承诺',
        },
      ],
      profile: {
        customerDisplayName: '王女士',
        customerMaskedRef: '客户 QY****001',
        ownerMaskedRef: '客服 CS****A',
        lowSensitiveCustomerSummary: '恢复期客户，关注水光护理、抗衰和到院复核。',
        lowSensitiveMessageSummary: '客户反馈恢复感受，需要人工安全边界判断。',
        consumptionPower: '高',
        projectPreference: '水光 / 抗衰',
        repurchaseIntent: '强',
        recentVisit: '最后到院：Apr 28',
        recentAccess: '最近访问：客服工作台会话入口',
        followUpTaskSummary: '随访任务：水光恢复观察，需人工确认。',
        knowledgeSourceSummary: '知识库依据：水光护理注意事项低敏摘要。',
      },
      messages: [
        {
          id: 'msg-001-customer',
          sender: 'customer',
          safeSummary: '客户咨询水光护理后恢复和是否需要复核。',
          occurredAt: '2026-07-08T09:04:00.000+08:00',
        },
        {
          id: 'msg-001-ai',
          sender: 'ai',
          safeSummary: 'AI 建议给出恢复期边界说明，并提示明显不适转人工。',
          occurredAt: '2026-07-08T09:05:00.000+08:00',
        },
      ],
      timeline: [
        createTimelineEvent({
          id: 'tl-001-ai-entered',
          title: '会话进入 AI 处理',
          safeSummary: 'AI 基于低敏知识库和快捷回复样式生成推荐回复，未连接真实渠道。',
          auditReason: 'ai_conversation_viewed',
          occurredAt: occurredAt.aiEntered,
        }),
      ],
    }, createAutomationStrategyContext({
      conversationId: 'ai-conv-001',
      customerMaskedRef: '客户 QY****001',
      conversationStatus: 'ai_handling',
      intentType: 'medical_risk',
      riskTags: ['medical_advice_risk', 'allergy_or_postoperative_abnormal_risk'],
      isAftercareFollowup: true,
    })),
    withAutomationStrategy({
      id: 'ai-conv-002',
      status: 'waiting_human',
      aiProcessingLabel: '待接管',
      customerDisplayName: '林女士',
      customerMaskedRef: '客户 ZM****002',
      ownerMaskedRef: '客服 CS****B',
      recentMessageSummary: '客户表达对费用和方案不满，等待人工接管。',
      canTakeover: true,
      hasRiskWarning: true,
      hasRecommendation: true,
      riskTags: ['price_commitment_risk', 'complaint_or_dissatisfaction_risk'],
      recommendedQuestions: ['是否需要主管介入？', '是否已有到院安排？'],
      recommendations: [
        {
          id: 'rec-002-complaint',
          title: '费用争议安抚回复',
          safeContent: '您好，您的反馈我们已记录。费用和方案需要由人工顾问结合门店规则核实，当前先为您转人工处理。',
          sourceSummary: '依据：投诉不满风险标签 / 价格承诺风险标签。',
          confidenceLabel: '必须人工确认',
        },
      ],
      projectRecommendations: [
        {
          id: 'proj-002-review',
          name: '方案复核服务',
          matchLabel: '需人工确认',
          safeReason: '涉及费用争议，不自动推荐价格或承诺。',
          priceBand: '价格不展示，线下人工核实',
        },
      ],
      profile: {
        customerDisplayName: '林女士',
        customerMaskedRef: '客户 ZM****002',
        ownerMaskedRef: '客服 CS****B',
        lowSensitiveCustomerSummary: '高优先级客户，当前存在不满反馈。',
        lowSensitiveMessageSummary: '客户关注费用解释和方案复核。',
        consumptionPower: '中',
        projectPreference: '复诊复核 / 方案解释',
        repurchaseIntent: '低，需要人工修复体验',
        recentVisit: '最近到院：2026-06 中旬',
        recentAccess: '最近访问：客服会话入口',
        followUpTaskSummary: '随访任务：投诉不满复核，待人工接管。',
        knowledgeSourceSummary: '知识库依据：价格沟通边界低敏摘要。',
      },
      messages: [
        {
          id: 'msg-002-customer',
          sender: 'customer',
          safeSummary: '客户表达对费用解释不满，要求人工回应。',
          occurredAt: '2026-07-08T09:10:00.000+08:00',
        },
        {
          id: 'msg-002-system',
          sender: 'system',
          safeSummary: '系统标记为待接管，禁止 AI 自动回复。',
          occurredAt: '2026-07-08T09:12:00.000+08:00',
        },
      ],
      timeline: [
        createTimelineEvent({
          id: 'tl-002-ai-entered',
          title: '会话进入 AI 处理',
          safeSummary: 'AI 识别价格和不满风险，仅生成低敏建议。',
          auditReason: 'ai_conversation_viewed',
          occurredAt: occurredAt.aiEntered,
        }),
        createTimelineEvent({
          id: 'tl-002-risk-blocked',
          title: '风险阻断',
          safeSummary: '价格承诺和投诉风险触发待接管，不自动发送。',
          auditReason: 'ai_conversation_risk_blocked',
          occurredAt: occurredAt.waiting,
        }),
      ],
    }, createAutomationStrategyContext({
      conversationId: 'ai-conv-002',
      customerMaskedRef: '客户 ZM****002',
      conversationStatus: 'waiting_human',
      intentType: 'complaint',
      riskTags: ['price_commitment_risk', 'complaint_or_dissatisfaction_risk'],
      isComplaint: true,
      isPriceCommitmentRisk: true,
    })),
    withAutomationStrategy({
      id: 'ai-conv-003',
      status: 'human_takeover',
      aiProcessingLabel: '人工已接管',
      customerDisplayName: '赵女士',
      customerMaskedRef: '客户 ZM****003',
      ownerMaskedRef: '咨询师 CT****C',
      recentMessageSummary: '咨询师已接管，会话仅模拟发送。',
      canTakeover: false,
      hasRiskWarning: false,
      hasRecommendation: true,
      riskTags: [],
      recommendedQuestions: ['是否确认下次到院时间？', '是否需要补充护理提醒？'],
      recommendations: [
        {
          id: 'rec-003-revisit',
          title: '到院复核提醒',
          safeContent: '您好，已为您记录复核需求。到院时间和护理安排由咨询师人工确认后再同步给您。',
          sourceSummary: '依据：预约中心低敏摘要 / 随访任务摘要。',
          confidenceLabel: '可作为人工草稿',
        },
      ],
      projectRecommendations: [
        {
          id: 'proj-003-hydration',
          name: '补水护理组合',
          matchLabel: '匹配度中',
          safeReason: '与最近关注项目和复购意向匹配。',
          priceBand: '价格区间：人工确认',
        },
      ],
      profile: {
        customerDisplayName: '赵女士',
        customerMaskedRef: '客户 ZM****003',
        ownerMaskedRef: '咨询师 CT****C',
        lowSensitiveCustomerSummary: '复购窗口客户，已由咨询师人工承接。',
        lowSensitiveMessageSummary: '客户关注复核时间和护理安排。',
        consumptionPower: '高',
        projectPreference: '补水护理 / 复诊复核',
        repurchaseIntent: '高',
        recentVisit: '最近到院：2026-07 上旬',
        recentAccess: '最近访问：预约确认入口',
        followUpTaskSummary: '随访任务：D28 复购建议，人工处理中。',
        knowledgeSourceSummary: '知识库依据：复诊前沟通低敏摘要。',
      },
      messages: [
        {
          id: 'msg-003-system',
          sender: 'system',
          safeSummary: '咨询师已接管会话。',
          occurredAt: '2026-07-08T09:18:00.000+08:00',
        },
        {
          id: 'msg-003-human',
          sender: 'human',
          safeSummary: '人工回复低敏摘要：已记录复核需求，等待确认时间。',
          occurredAt: '2026-07-08T09:20:00.000+08:00',
        },
      ],
      timeline: [
        createTimelineEvent({
          id: 'tl-003-ai-entered',
          title: '会话进入 AI 处理',
          safeSummary: 'AI 先给出低敏建议。',
          auditReason: 'ai_conversation_viewed',
          occurredAt: occurredAt.aiEntered,
        }),
        createTimelineEvent({
          id: 'tl-003-takeover',
          title: '人工接管',
          safeSummary: '咨询师接管会话，后续仍为模拟发送。',
          auditReason: 'ai_conversation_takeover',
          occurredAt: occurredAt.human,
        }),
        createTimelineEvent({
          id: 'tl-003-sent',
          title: '模拟发送',
          safeSummary: '生成低敏 MessageDelivery 记录，状态为 mock_sent。',
          auditReason: 'ai_conversation_message_mock_sent',
          occurredAt: '2026-07-08T09:20:00.000+08:00',
        }),
      ],
    }, createAutomationStrategyContext({
      conversationId: 'ai-conv-003',
      customerMaskedRef: '客户 ZM****003',
      conversationStatus: 'human_takeover',
      intentType: 'appointment_question',
    })),
    withAutomationStrategy({
      id: 'ai-conv-004',
      status: 'closed',
      aiProcessingLabel: '已结束',
      customerDisplayName: '陈女士',
      customerMaskedRef: '客户 ZM****004',
      ownerMaskedRef: '客服 CS****D',
      recentMessageSummary: '会话已结束，保留低敏时间线。',
      canTakeover: false,
      hasRiskWarning: false,
      hasRecommendation: false,
      riskTags: [],
      recommendedQuestions: ['是否需要创建后续随访任务？'],
      recommendations: [],
      projectRecommendations: [
        {
          id: 'proj-004-next',
          name: '后续随访任务',
          matchLabel: '已沉淀',
          safeReason: '会话结束后仅保留低敏看板统计。',
          priceBand: '不展示价格',
        },
      ],
      profile: {
        customerDisplayName: '陈女士',
        customerMaskedRef: '客户 ZM****004',
        ownerMaskedRef: '客服 CS****D',
        lowSensitiveCustomerSummary: '已结束会话客户，等待下次随访。',
        lowSensitiveMessageSummary: '会话闭环，仅保留低敏摘要。',
        consumptionPower: '中',
        projectPreference: '皮肤管理',
        repurchaseIntent: '中',
        recentVisit: '最近到院：低敏月份',
        recentAccess: '最近访问：会话结束页',
        followUpTaskSummary: '随访任务：已生成低敏摘要。',
        knowledgeSourceSummary: '知识库依据：会话结束 SOP 低敏摘要。',
      },
      messages: [
        {
          id: 'msg-004-system',
          sender: 'system',
          safeSummary: '会话已结束。',
          occurredAt: '2026-07-08T09:30:00.000+08:00',
        },
      ],
      timeline: [
        createTimelineEvent({
          id: 'tl-004-closed',
          title: '会话结束',
          safeSummary: '人工结束会话，仅保留低敏审计和看板统计。',
          auditReason: 'ai_conversation_closed',
          occurredAt: occurredAt.closed,
        }),
      ],
    }, createAutomationStrategyContext({
      conversationId: 'ai-conv-004',
      customerMaskedRef: '客户 ZM****004',
      conversationStatus: 'closed',
      intentType: 'unknown',
    })),
  ];
}

export function filterAiConversations(
  conversations: readonly AiConversationRecord[],
  filter: AiConversationFilter,
) {
  if (filter === 'all') return [...conversations];
  if (filter === 'ai') return conversations.filter((conversation) => conversation.status === 'ai_handling');
  return conversations.filter((conversation) => conversation.status === filter);
}

export function buildAiConversationWorkbenchStats(
  conversations: readonly AiConversationRecord[],
): AiConversationWorkbenchStats {
  const preflightStats = buildRealChannelPreflightStats(conversations.map((conversation) => conversation.realChannelPreflight));
  const dryRunConfigStats = buildWeComOfficialDryRunConfigStats(conversations.map((conversation) => conversation.weComOfficialDryRunConfig));
  const officialDryRunStats = buildWeComOfficialDryRunStats(conversations.map((conversation) => conversation.weComOfficialDryRun));

  return {
    totalCount: conversations.length,
    aiHandlingCount: conversations.filter((conversation) => conversation.status === 'ai_handling').length,
    waitingHumanCount: conversations.filter((conversation) => conversation.status === 'waiting_human').length,
    humanTakeoverCount: conversations.filter((conversation) => conversation.status === 'human_takeover').length,
    riskWarningCount: conversations.filter((conversation) => conversation.hasRiskWarning).length,
    recommendationCount: conversations.filter((conversation) => conversation.recommendations.length > 0).length,
    mockSentCount: conversations.reduce(
      (count, conversation) =>
        count + conversation.messages.filter((message) => message.delivery?.status === 'mock_sent').length,
      0,
    ),
    closedCount: conversations.filter((conversation) => conversation.status === 'closed').length,
    strategyEvaluatedCount: conversations.filter((conversation) => conversation.automationStrategy).length,
    aiRecommendOnlyCount: conversations.filter(
      (conversation) => conversation.automationStrategy.result.decision === 'recommend_only',
    ).length,
    humanConfirmationRequiredCount: conversations.filter(
      (conversation) => conversation.automationStrategy.result.requiresHumanConfirmation,
    ).length,
    mockAutoReplyAllowedCount: conversations.filter(
      (conversation) => conversation.automationStrategy.result.canAutoReplyMock,
    ).length,
    mockAutoFollowupAllowedCount: conversations.filter(
      (conversation) => conversation.automationStrategy.result.canAutoFollowupMock,
    ).length,
    highRiskBlockedCount: conversations.filter(
      (conversation) => conversation.automationStrategy.result.decision === 'blocked_high_risk',
    ).length,
    marketingAutomationBlockedCount: conversations.filter(
      (conversation) => conversation.automationStrategy.result.decision === 'blocked_marketing_automation',
    ).length,
    addFriendBlockedCount: conversations.filter(
      (conversation) => conversation.automationStrategy.result.decision === 'blocked_add_friend',
    ).length,
    ...preflightStats,
    ...dryRunConfigStats,
    ...officialDryRunStats,
  };
}

export function takeoverAiConversation(input: {
  conversation: AiConversationRecord;
  actorId: string;
  occurredAt: string;
}) {
  if (input.conversation.status === 'closed') {
    return { kind: 'invalid_status' as const, conversation: input.conversation };
  }

  const safeActorId = safeText(input.actorId, 'operator-low-sensitive');
  const realChannelPreflight = evaluateRealChannelPreflight(createDefaultRealChannelPreflightInput({
    hasManualConfirmation: true,
    hasConsent: input.conversation.automationStrategy.context.hasConsent,
    hasOptOut: input.conversation.automationStrategy.context.hasOptOut,
    frequencyCapPassed: input.conversation.automationStrategy.context.frequencyCapPassed,
    aiStrategyDecision: input.conversation.automationStrategy.result.decision,
    aiStrategyLevel: input.conversation.automationStrategy.result.recommendedLevel,
    riskTags: input.conversation.riskTags,
    safetySwitchSummary: input.conversation.automationStrategy.result.safetySwitchSummary,
    emergencyStopEnabled: input.conversation.automationStrategy.result.safetySwitchSummary.emergencyStopEnabled,
  }));
  const weComOfficialDryRunConfig = createWeComDryRunConfigForConversation({
    preflight: realChannelPreflight,
    hasManualConfirmation: true,
  });
  const weComOfficialDryRun = createOfficialRouteDryRunForConversation({
    preflight: realChannelPreflight,
    config: weComOfficialDryRunConfig,
    hasManualConfirmation: true,
  });
  return {
    kind: 'taken_over' as const,
    conversation: {
      ...input.conversation,
      realChannelPreflight,
      weComOfficialDryRunConfig,
      weComOfficialDryRun,
      status: 'human_takeover' as const,
      aiProcessingLabel: '人工已接管',
      canTakeover: false,
      recentMessageSummary: '人工已接管，会话仍为模拟发送。',
      messages: [
        ...input.conversation.messages,
        {
          id: `${input.conversation.id}:system:takeover`,
          sender: 'system' as const,
          safeSummary: '咨询师已接管会话。',
          occurredAt: input.occurredAt,
        },
      ],
      timeline: [
        ...input.conversation.timeline,
        createTimelineEvent({
          id: `${input.conversation.id}:timeline:takeover`,
          title: '人工接管',
          safeSummary: `${safeActorId} 接管会话，后续动作仍不触发真实渠道。`,
          auditReason: 'ai_conversation_takeover',
          occurredAt: input.occurredAt,
        }),
        createRealChannelPreflightTimelineEvent({
          conversationId: input.conversation.id,
          preflight: realChannelPreflight,
          occurredAt: input.occurredAt,
        }),
        createWeComOfficialDryRunTimelineEvent({
          conversationId: input.conversation.id,
          config: weComOfficialDryRunConfig,
          occurredAt: input.occurredAt,
        }),
        createOfficialRouteDryRunTimelineEvent({
          conversationId: input.conversation.id,
          dryRun: weComOfficialDryRun,
          occurredAt: input.occurredAt,
        }),
      ],
    },
  };
}

export function applyAiConversationRecommendation(input: {
  conversation: AiConversationRecord;
  recommendationId: string;
  actorId: string;
  occurredAt: string;
}) {
  const recommendation = input.conversation.recommendations.find((item) => item.id === input.recommendationId);
  if (!recommendation) {
    return { kind: 'not_found' as const, conversation: input.conversation, draft: '' };
  }

  return {
    kind: 'used' as const,
    draft: recommendation.safeContent,
    conversation: {
      ...input.conversation,
      timeline: [
        ...input.conversation.timeline,
        createTimelineEvent({
          id: `${input.conversation.id}:timeline:recommendation:${recommendation.id}`,
          title: '使用 AI 推荐回复',
          safeSummary: `已使用「${recommendation.title}」生成发送前草稿，必须人工确认。`,
          auditReason: 'ai_conversation_recommendation_used',
          occurredAt: input.occurredAt,
        }),
      ],
    },
  };
}

export function evaluateAiConversationAutomationStrategy(input: {
  conversation: AiConversationRecord;
  context?: Partial<AiAutoStrategyContext>;
  occurredAt: string;
}) {
  const context: AiAutoStrategyContext = {
    ...input.conversation.automationStrategy.context,
    ...input.context,
    conversationId: input.conversation.id,
    customerMaskedRef: input.conversation.customerMaskedRef,
    conversationStatus: input.context?.conversationStatus ?? input.conversation.status,
    riskTags: input.context?.riskTags ?? input.conversation.riskTags,
    safetySwitchSummary: {
      ...input.conversation.automationStrategy.result.safetySwitchSummary,
      ...input.context?.safetySwitchSummary,
      allowRealSend: false,
      externalChannelEnabled: false,
    },
  };
  const automationStrategy = createAutomationStrategy(context);
  const realChannelPreflight = createPreflightForConversation({
    conversation: input.conversation,
    strategy: automationStrategy,
    hasManualConfirmation: input.conversation.status === 'human_takeover',
  });

  const weComOfficialDryRunConfig = createWeComDryRunConfigForConversation({
    preflight: realChannelPreflight,
    hasManualConfirmation: input.conversation.status === 'human_takeover',
  });
  const weComOfficialDryRun = createOfficialRouteDryRunForConversation({
    preflight: realChannelPreflight,
    config: weComOfficialDryRunConfig,
    hasManualConfirmation: input.conversation.status === 'human_takeover',
  });

  const kind = automationStrategy.result.blocked
    ? 'blocked'
    : automationStrategy.result.requiresHumanConfirmation
      ? 'requires_human_confirmation'
      : 'evaluated';

  return {
    kind,
    conversation: {
      ...input.conversation,
      automationStrategy,
      realChannelPreflight,
      weComOfficialDryRunConfig,
      weComOfficialDryRun,
      timeline: [
        ...input.conversation.timeline,
        createAutomationStrategyTimelineEvent({
          conversationId: input.conversation.id,
          strategy: automationStrategy,
          occurredAt: input.occurredAt,
        }),
        createRealChannelPreflightTimelineEvent({
          conversationId: input.conversation.id,
          preflight: realChannelPreflight,
          occurredAt: input.occurredAt,
        }),
        createWeComOfficialDryRunTimelineEvent({
          conversationId: input.conversation.id,
          config: weComOfficialDryRunConfig,
          occurredAt: input.occurredAt,
        }),
        createOfficialRouteDryRunTimelineEvent({
          conversationId: input.conversation.id,
          dryRun: weComOfficialDryRun,
          occurredAt: input.occurredAt,
        }),
      ],
    },
  };
}

export const simulateAiConversationAutoReplyStrategy = evaluateAiConversationAutomationStrategy;
export const simulateAiConversationAutoFollowupStrategy = evaluateAiConversationAutomationStrategy;

export function evaluateAiConversationRealChannelPreflight(input: {
  conversation: AiConversationRecord;
  hasManualConfirmation?: boolean;
  channelRoute?: RealChannelRoute;
  occurredAt: string;
}) {
  const realChannelPreflight = createPreflightForConversation({
    conversation: input.conversation,
    strategy: input.conversation.automationStrategy,
    hasManualConfirmation: input.hasManualConfirmation ?? input.conversation.status === 'human_takeover',
    channelRoute: input.channelRoute,
  });

  const weComOfficialDryRunConfig = createWeComDryRunConfigForConversation({
    preflight: realChannelPreflight,
    hasManualConfirmation: input.hasManualConfirmation ?? input.conversation.status === 'human_takeover',
    officialRoute: input.channelRoute,
  });
  const weComOfficialDryRun = createOfficialRouteDryRunForConversation({
    preflight: realChannelPreflight,
    config: weComOfficialDryRunConfig,
    hasManualConfirmation: input.hasManualConfirmation ?? input.conversation.status === 'human_takeover',
  });

  return {
    kind: realChannelPreflight.proofEligibleMock ? 'mock_eligible' as const : 'blocked' as const,
    conversation: {
      ...input.conversation,
      realChannelPreflight,
      weComOfficialDryRunConfig,
      weComOfficialDryRun,
      timeline: [
        ...input.conversation.timeline,
        createRealChannelPreflightTimelineEvent({
          conversationId: input.conversation.id,
          preflight: realChannelPreflight,
          occurredAt: input.occurredAt,
        }),
        createWeComOfficialDryRunTimelineEvent({
          conversationId: input.conversation.id,
          config: weComOfficialDryRunConfig,
          occurredAt: input.occurredAt,
        }),
        createOfficialRouteDryRunTimelineEvent({
          conversationId: input.conversation.id,
          dryRun: weComOfficialDryRun,
          occurredAt: input.occurredAt,
        }),
      ],
    },
  };
}

export function markAiConversationAutomationNeedsHuman(input: {
  conversation: AiConversationRecord;
  occurredAt: string;
}) {
  return evaluateAiConversationAutomationStrategy({
    conversation: input.conversation,
    context: {
      intentType: 'unknown',
      riskTags: [],
      isAftercareFollowup: false,
      isMarketing: false,
      isAddFriendIntent: false,
      isComplaint: false,
      isMedicalRisk: false,
      isPriceCommitmentRisk: false,
    },
    occurredAt: input.occurredAt,
  });
}

export function markAiConversationAutomationBlocked(input: {
  conversation: AiConversationRecord;
  occurredAt: string;
}) {
  return evaluateAiConversationAutomationStrategy({
    conversation: input.conversation,
    context: {
      isMarketing: true,
      intentType: 'marketing_campaign',
      riskTags: [],
      isAftercareFollowup: false,
      isAddFriendIntent: false,
      isComplaint: false,
      isMedicalRisk: false,
      isPriceCommitmentRisk: false,
    },
    occurredAt: input.occurredAt,
  });
}

export function detectAiConversationSendRisks(content: string) {
  return highRiskSendPatterns
    .filter((item) => item.pattern.test(content))
    .map((item) => item.tag);
}

function createApprovedConversationDraft(input: {
  conversation: AiConversationRecord;
  content: string;
  actorId: string;
  occurredAt: string;
}): FollowUpMessageDraft {
  const draft: FollowUpMessageDraft = {
    id: `ai-conv-draft:${input.conversation.id}`,
    tenantId: 'demo-tenant-001',
    institutionId: 'demo-institution-001',
    followUpTaskId: `ai-conv-followup:${input.conversation.id}`,
    enrollmentId: null,
    stageId: null,
    customerId: input.conversation.customerMaskedRef.replace(/\s+/gu, '-').toLowerCase(),
    customerDisplayName: input.conversation.customerDisplayName,
    templateId: null,
    channelType: 'manual',
    status: 'draft',
    draftContent: input.content,
    editedContent: null,
    safePreview: input.content.slice(0, 120),
    approvedBy: null,
    approvedAt: null,
    rejectedBy: null,
    rejectedAt: null,
    markedSentBy: null,
    markedSentAt: null,
    safeReasonCode: 'template_generated',
    metadataJson: {
      source: 'ai_conversation_workbench_mock',
      requiresHumanApproval: true,
      forbidAutoSend: true,
      externalChannelEnabled: false,
    },
    createdAt: input.occurredAt,
    updatedAt: input.occurredAt,
  };
  const approved = approveFollowUpMessageDraft({
    draft,
    actorId: input.actorId,
    occurredAt: input.occurredAt,
  });

  if (approved.kind !== 'approved') {
    return { ...draft, status: 'approved', approvedBy: input.actorId, approvedAt: input.occurredAt };
  }

  return approved.draft;
}

export const useAiConversationRecommendation = applyAiConversationRecommendation;

export function mockSendAiConversationMessage(input: {
  conversation: AiConversationRecord;
  content: string;
  actorId: string;
  occurredAt: string;
}) {
  if (input.conversation.status !== 'human_takeover') {
    return { kind: 'requires_takeover' as const, conversation: input.conversation };
  }

  const content = safeText(input.content, '低敏人工确认内容快照，未包含联系方式或外部渠道 payload。');
  const risks = detectAiConversationSendRisks(input.content);

  if (risks.length > 0 || content !== input.content.normalize('NFKC').replace(/\s+/gu, ' ').trim().slice(0, 500)) {
    return {
      kind: 'risk_blocked' as const,
      risks: risks.length > 0 ? risks : (['privacy_field_leakage_risk'] as AiConversationRiskTag[]),
      conversation: {
        ...input.conversation,
        hasRiskWarning: true,
        riskTags: Array.from(new Set([
          ...input.conversation.riskTags,
          ...(risks.length > 0 ? risks : (['privacy_field_leakage_risk'] as AiConversationRiskTag[])),
        ])),
        timeline: [
          ...input.conversation.timeline,
          createTimelineEvent({
            id: `${input.conversation.id}:timeline:risk-blocked:${input.occurredAt}`,
            title: '风险阻断',
            safeSummary: '发送前确认识别高风险内容，已阻断模拟发送。',
            auditReason: 'ai_conversation_risk_blocked',
            occurredAt: input.occurredAt,
          }),
        ],
      },
    };
  }

  const approvedDraft = createApprovedConversationDraft({
    conversation: input.conversation,
    content,
    actorId: input.actorId,
    occurredAt: input.occurredAt,
  });
  const deliveryResult = createMessageDeliveryFromApprovedDraft({
    draft: approvedDraft,
    actorId: input.actorId,
    occurredAt: input.occurredAt,
    options: {
      channelType: 'mock',
      deliveryMode: 'mock',
      status: 'mock_sent',
    },
  });

  if (deliveryResult.kind !== 'created') {
    return { kind: 'delivery_failed' as const, conversation: input.conversation };
  }

  const delivery = mapMessageDeliveryToDto(deliveryResult.delivery);
  return {
    kind: 'mock_sent' as const,
    delivery,
    conversation: {
      ...input.conversation,
      status: 'human_takeover' as const,
      aiProcessingLabel: '人工已接管',
      canTakeover: false,
      recentMessageSummary: '已生成模拟发送记录，未触发真实渠道。',
      messages: [
        ...input.conversation.messages,
        {
          id: `${input.conversation.id}:human:${delivery.deliveryId}`,
          sender: 'human' as const,
          safeSummary: content,
          occurredAt: input.occurredAt,
          delivery,
        },
      ],
      timeline: [
        ...input.conversation.timeline,
        createTimelineEvent({
          id: `${input.conversation.id}:timeline:mock-sent:${delivery.deliveryId}`,
          title: '模拟发送',
          safeSummary: '已复用 MessageDelivery 低敏链路生成 mock_sent 记录，不接真实渠道。',
          auditReason: 'ai_conversation_message_mock_sent',
          occurredAt: input.occurredAt,
          metadata: messageDeliveryToTimelineMetadata(deliveryResult.delivery),
        }),
      ],
    },
  };
}

export function closeAiConversation(input: {
  conversation: AiConversationRecord;
  actorId: string;
  occurredAt: string;
}) {
  if (input.conversation.status === 'closed') {
    return { kind: 'already_closed' as const, conversation: input.conversation };
  }

  return {
    kind: 'closed' as const,
    conversation: {
      ...input.conversation,
      status: 'closed' as const,
      aiProcessingLabel: '已结束',
      canTakeover: false,
      recentMessageSummary: '会话已结束，仅保留低敏审计和时间线。',
      messages: [
        ...input.conversation.messages,
        {
          id: `${input.conversation.id}:system:closed`,
          sender: 'system' as const,
          safeSummary: '会话已结束。',
          occurredAt: input.occurredAt,
        },
      ],
      timeline: [
        ...input.conversation.timeline,
        createTimelineEvent({
          id: `${input.conversation.id}:timeline:closed`,
          title: '会话结束',
          safeSummary: '人工结束会话，未触发真实渠道。',
          auditReason: 'ai_conversation_closed',
          occurredAt: input.occurredAt,
        }),
      ],
    },
  };
}

export function assertAiConversationLowSensitivePayload(input: unknown) {
  const visit = (value: unknown): boolean => {
    if (typeof value === 'string') {
      return assertLowSensitiveText(value);
    }

    if (Array.isArray(value)) {
      return value.every((item) => visit(item));
    }

    if (typeof value === 'object' && value !== null) {
      return Object.entries(value).every(([key, item]) => assertLowSensitiveText(key) && visit(item));
    }

    return true;
  };

  return visit(input);
}
