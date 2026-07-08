import type { AuditReason } from '@/modules/audit/domain/audit-events';
import type { AiConversationRiskTag, AiConversationStatus } from '@/modules/institution/domain/ai-conversation-workbench';
import {
  defaultSafetySwitchState,
  deriveSafetySwitchViewModel,
  hasRealChannelEnableAttempt,
  type SafetySwitchState,
  type SafetySwitchViewModel,
} from '@/modules/security/domain/safety-switch';

export const aiAutoStrategyLevels = ['L0', 'L1', 'L2', 'L3', 'L4'] as const;
export type AiAutoStrategyLevel = (typeof aiAutoStrategyLevels)[number];

export type AiAutoStrategyLevelDefinition = {
  level: AiAutoStrategyLevel;
  title: string;
  summary: string;
  customerVisible: boolean;
  requiresHumanConfirmation: boolean;
  mockExecutionAllowed: boolean;
  realChannelAllowed: false;
  requiresFrequencyCap: boolean;
  requiresOptOutCheck: boolean;
  auditRequired: true;
  defaultClosed: boolean;
};

export const aiAutoStrategyLevelDefinitions = [
  {
    level: 'L0',
    title: 'L0 AI 推荐',
    summary: 'AI 推荐，不自动发送，仅辅助客服判断。',
    customerVisible: false,
    requiresHumanConfirmation: true,
    mockExecutionAllowed: false,
    realChannelAllowed: false,
    requiresFrequencyCap: false,
    requiresOptOutCheck: false,
    auditRequired: true,
    defaultClosed: false,
  },
  {
    level: 'L1',
    title: 'L1 AI 草稿 + 人工确认',
    summary: '生成低敏草稿，人工确认后才可进入模拟发送链路。',
    customerVisible: false,
    requiresHumanConfirmation: true,
    mockExecutionAllowed: false,
    realChannelAllowed: false,
    requiresFrequencyCap: true,
    requiresOptOutCheck: true,
    auditRequired: true,
    defaultClosed: false,
  },
  {
    level: 'L2',
    title: 'L2 低风险自动回复',
    summary: '仅低风险基础问答或预约类问题允许模拟自动回复。',
    customerVisible: true,
    requiresHumanConfirmation: false,
    mockExecutionAllowed: true,
    realChannelAllowed: false,
    requiresFrequencyCap: true,
    requiresOptOutCheck: true,
    auditRequired: true,
    defaultClosed: true,
  },
  {
    level: 'L3',
    title: 'L3 受控自动随访',
    summary: '仅已授权、未退订、频控通过、低风险术后随访允许模拟执行。',
    customerVisible: true,
    requiresHumanConfirmation: false,
    mockExecutionAllowed: true,
    realChannelAllowed: false,
    requiresFrequencyCap: true,
    requiresOptOutCheck: true,
    auditRequired: true,
    defaultClosed: true,
  },
  {
    level: 'L4',
    title: 'L4 营销自动化 / 群发 / 加好友 / 裂变',
    summary: '只允许规划展示，当前默认阻断，不进入真实通道。',
    customerVisible: false,
    requiresHumanConfirmation: true,
    mockExecutionAllowed: false,
    realChannelAllowed: false,
    requiresFrequencyCap: true,
    requiresOptOutCheck: true,
    auditRequired: true,
    defaultClosed: true,
  },
] as const satisfies readonly AiAutoStrategyLevelDefinition[];

export const aiAutoStrategyIntentTypes = [
  'basic_faq',
  'aftercare_question',
  'appointment_question',
  'price_question',
  'complaint',
  'medical_risk',
  'marketing_campaign',
  'add_friend',
  'unknown',
] as const;

export type AiAutoStrategyIntentType = (typeof aiAutoStrategyIntentTypes)[number];

export const aiAutoStrategyIntentLabels = {
  basic_faq: '基础问答',
  aftercare_question: '术后护理问题',
  appointment_question: '预约问题',
  price_question: '价格问题',
  complaint: '投诉 / 不满',
  medical_risk: '医疗风险',
  marketing_campaign: '营销活动',
  add_friend: '加好友',
  unknown: '未知',
} as const satisfies Record<AiAutoStrategyIntentType, string>;

export const aiAutoStrategyDecisions = [
  'recommend_only',
  'draft_requires_human',
  'mock_auto_reply_allowed',
  'mock_followup_allowed',
  'blocked_high_risk',
  'blocked_missing_consent',
  'blocked_opt_out',
  'blocked_frequency_cap',
  'blocked_marketing_automation',
  'blocked_add_friend',
  'blocked_real_channel_disabled',
  'blocked_sensitive_output',
  'blocked_unknown_intent',
] as const;

export type AiAutoStrategyDecision = (typeof aiAutoStrategyDecisions)[number];

export const aiAutoStrategyDecisionLabels = {
  recommend_only: '仅 AI 推荐，不自动发送',
  draft_requires_human: 'AI 草稿需人工确认',
  mock_auto_reply_allowed: '允许低风险模拟自动回复',
  mock_followup_allowed: '允许受控模拟自动随访',
  blocked_high_risk: '高风险阻断',
  blocked_missing_consent: '缺少授权，阻断自动触达',
  blocked_opt_out: '客户退订，阻断自动触达',
  blocked_frequency_cap: '频率限制未通过，阻断自动触达',
  blocked_marketing_automation: '营销自动化默认阻断',
  blocked_add_friend: '自动加好友默认阻断',
  blocked_real_channel_disabled: '真实渠道关闭，阻断真实发送',
  blocked_sensitive_output: '敏感输出阻断',
  blocked_unknown_intent: '未知意图需人工确认',
} as const satisfies Record<AiAutoStrategyDecision, string>;

export const aiAutoStrategyAuditReasons = [
  'ai_auto_strategy_evaluated',
  'ai_auto_reply_mock_allowed',
  'ai_auto_followup_mock_allowed',
  'ai_auto_reply_human_confirmation_required',
  'ai_auto_followup_human_confirmation_required',
  'ai_auto_reply_blocked',
  'ai_auto_followup_blocked',
  'ai_marketing_automation_blocked',
  'ai_add_friend_blocked',
] as const satisfies readonly AuditReason[];

export type AiAutoStrategyAuditReason = (typeof aiAutoStrategyAuditReasons)[number];

export type AiAutoStrategyOperatorRole = 'consultant' | 'customer_service' | 'manager' | 'system';

export type AiAutoStrategyContext = {
  conversationId: string;
  tenantId: string;
  institutionId: string | null;
  customerMaskedRef: string;
  conversationStatus: AiConversationStatus;
  intentType: AiAutoStrategyIntentType;
  riskTags: readonly AiConversationRiskTag[];
  hasConsent: boolean;
  hasOptOut: boolean;
  frequencyCapPassed: boolean;
  isAftercareFollowup: boolean;
  isMarketing: boolean;
  isAddFriendIntent: boolean;
  isComplaint: boolean;
  isMedicalRisk: boolean;
  isPriceCommitmentRisk: boolean;
  safetySwitchSummary?: Partial<SafetySwitchState> | SafetySwitchViewModel;
  operatorRole: AiAutoStrategyOperatorRole;
};

export type AiAutoStrategyFollowupPlan = {
  title: string;
  steps: string[];
  channelBoundary: string;
};

export type AiAutoStrategyResult = {
  recommendedLevel: AiAutoStrategyLevel;
  decision: AiAutoStrategyDecision;
  decisionLabel: string;
  canAutoReplyMock: boolean;
  canAutoFollowupMock: boolean;
  requiresHumanConfirmation: boolean;
  blocked: boolean;
  blockReasons: string[];
  safeReplyDraft: string;
  safeFollowupPlan: AiAutoStrategyFollowupPlan;
  auditReason: AiAutoStrategyAuditReason;
  timelineSummary: string;
  lowSensitiveExplanation: string;
  allowRealSend: false;
  externalChannelEnabled: false;
  realChannelBlocked: true;
  safetySwitchSummary: SafetySwitchViewModel;
};

const highRiskTags = new Set<AiConversationRiskTag>([
  'medical_advice_risk',
  'efficacy_commitment_risk',
  'allergy_or_postoperative_abnormal_risk',
  'complaint_or_dissatisfaction_risk',
]);

const priceRiskTags = new Set<AiConversationRiskTag>(['price_commitment_risk']);

const forbiddenStrategyTextPatterns = [
  /1[3-9]\d{9}/u,
  /\d{6}(?:19|20)\d{2}\d{2}\d{2}\d{3}[\dXx]/u,
  /\bMR[-_A-Z0-9]{3,}\b/iu,
  /完整病历|病历号|身份证|手机号原文|真实微信|external_userid|userid|corpId|聊天原文|咨询全文/u,
  /机器编号|扫码托管|端口托管|uip|真实端口|真实扫码/u,
  /\bHIS\b payload|his payload|webhook payload|webhook_secret|access_token|secret|api key|DATABASE_URL/iu,
];

function isLowSensitiveText(value: string) {
  return !forbiddenStrategyTextPatterns.some((pattern) => pattern.test(value));
}

function sanitizeStrategyText(value: string, fallback: string) {
  const normalized = value.normalize('NFKC').replace(/\s+/gu, ' ').trim().slice(0, 500);
  return normalized && isLowSensitiveText(normalized) ? normalized : fallback;
}

function buildSafetySwitchSummary(input?: Partial<SafetySwitchState> | SafetySwitchViewModel) {
  return deriveSafetySwitchViewModel(input ?? defaultSafetySwitchState);
}

function hasHighRisk(input: AiAutoStrategyContext) {
  return (
    input.isComplaint ||
    input.isMedicalRisk ||
    input.riskTags.some((tag) => highRiskTags.has(tag))
  );
}

function hasPriceCommitmentRisk(input: AiAutoStrategyContext) {
  return input.isPriceCommitmentRisk || input.riskTags.some((tag) => priceRiskTags.has(tag));
}

function safeReplyDraftFor(input: AiAutoStrategyContext, decision: AiAutoStrategyDecision) {
  if (decision === 'mock_auto_reply_allowed') {
    if (input.intentType === 'appointment_question') {
      return '已生成低敏预约回复草稿：可说明预约流程、到院前准备和人工确认边界，不承诺价格或效果。';
    }

    return '已生成低敏基础问答草稿：仅回答通用服务说明，遇到异常、投诉、价格或医疗风险立即转人工。';
  }

  if (decision === 'mock_followup_allowed') {
    return '已生成低敏术后随访草稿：提醒按医嘱护理、观察恢复反馈，如不适加重请联系人工客服。';
  }

  if (decision === 'draft_requires_human') {
    return '已生成低敏人工确认草稿：请客服核实上下文后再决定是否使用，当前不自动发送。';
  }

  return '当前仅保留低敏策略说明，不生成客户可见自动回复。';
}

function safeFollowupPlanFor(input: AiAutoStrategyContext, decision: AiAutoStrategyDecision): AiAutoStrategyFollowupPlan {
  if (decision === 'mock_followup_allowed') {
    return {
      title: '受控术后随访模拟计划',
      steps: [
        '确认客户已授权且未退订。',
        '确认频率限制通过。',
        '生成单条低敏关怀提醒。',
        '写入低敏时间线和 audit reason，不进入真实渠道。',
      ],
      channelBoundary: '仅模拟自动随访，不接企业微信 / 微信 / 短信 / HIS / webhook。',
    };
  }

  if (decision === 'blocked_marketing_automation') {
    return {
      title: '营销自动化规划已阻断',
      steps: ['仅展示规划风险。', '不得群发、裂变或绕过退订。', '后续需单独评估真实通道。'],
      channelBoundary: 'L4 默认关闭，不进入真实渠道。',
    };
  }

  if (decision === 'blocked_add_friend') {
    return {
      title: '自动加好友规划已阻断',
      steps: ['只允许生成低敏人工任务说明。', '不得主加触达。', '不得使用托管路线。'],
      channelBoundary: '自动加好友默认阻断，不进入真实渠道。',
    };
  }

  return {
    title: '随访模拟计划需人工确认',
    steps: ['保留低敏策略结果。', '如需触达，先由人工确认授权、退订和频率限制。'],
    channelBoundary: '不真实发送，不真实出网。',
  };
}

function result(input: {
  context: AiAutoStrategyContext;
  level: AiAutoStrategyLevel;
  decision: AiAutoStrategyDecision;
  canAutoReplyMock?: boolean;
  canAutoFollowupMock?: boolean;
  requiresHumanConfirmation: boolean;
  blocked: boolean;
  blockReasons?: string[];
  auditReason: AiAutoStrategyAuditReason;
  explanation: string;
}) : AiAutoStrategyResult {
  const safetySwitchSummary = buildSafetySwitchSummary(input.context.safetySwitchSummary);
  const safeReplyDraft = sanitizeStrategyText(
    safeReplyDraftFor(input.context, input.decision),
    '低敏策略草稿已隐藏，需人工确认。',
  );
  const safeFollowupPlan = safeFollowupPlanFor(input.context, input.decision);
  const blockReasons = [
    ...(input.blockReasons ?? []),
    ...safetySwitchSummary.blockReasons.map((reason) => `真实渠道阻断：${reason}`),
  ];

  const payloadText = [
    safeReplyDraft,
    safeFollowupPlan.title,
    safeFollowupPlan.steps.join(' '),
    safeFollowupPlan.channelBoundary,
    input.explanation,
  ].join(' ');

  if (!isLowSensitiveText(payloadText)) {
    return result({
      context: { ...input.context, safetySwitchSummary },
      level: 'L1',
      decision: 'blocked_sensitive_output',
      requiresHumanConfirmation: true,
      blocked: true,
      blockReasons: ['策略结果包含敏感输出，已阻断展示。'],
      auditReason: input.context.isAftercareFollowup ? 'ai_auto_followup_blocked' : 'ai_auto_reply_blocked',
      explanation: '策略输出触发低敏守卫，已替换为安全摘要。',
    });
  }

  return {
    recommendedLevel: input.level,
    decision: input.decision,
    decisionLabel: aiAutoStrategyDecisionLabels[input.decision],
    canAutoReplyMock: input.canAutoReplyMock ?? false,
    canAutoFollowupMock: input.canAutoFollowupMock ?? false,
    requiresHumanConfirmation: input.requiresHumanConfirmation,
    blocked: input.blocked,
    blockReasons,
    safeReplyDraft,
    safeFollowupPlan,
    auditReason: input.auditReason,
    timelineSummary: sanitizeStrategyText(
      `自动化策略已评估：${aiAutoStrategyDecisionLabels[input.decision]}；真实渠道保持关闭，仅记录低敏时间线。`,
      '自动化策略已评估，仅记录低敏时间线。',
    ),
    lowSensitiveExplanation: sanitizeStrategyText(input.explanation, '低敏策略说明已隐藏。'),
    allowRealSend: false,
    externalChannelEnabled: false,
    realChannelBlocked: true,
    safetySwitchSummary,
  };
}

export function evaluateAiAutoStrategy(input: AiAutoStrategyContext): AiAutoStrategyResult {
  if (!assertAiAutoStrategyLowSensitivePayload(input)) {
    return result({
      context: {
        ...input,
        customerMaskedRef: '客户 ****',
      },
      level: 'L1',
      decision: 'blocked_sensitive_output',
      requiresHumanConfirmation: true,
      blocked: true,
      blockReasons: ['策略输入包含敏感字段，已阻断自动化策略。'],
      auditReason: input.isAftercareFollowup ? 'ai_auto_followup_blocked' : 'ai_auto_reply_blocked',
      explanation: '策略输入或上下文触发低敏守卫，不进入自动回复或自动随访。',
    });
  }

  if (input.hasOptOut) {
    return result({
      context: input,
      level: input.isAftercareFollowup ? 'L3' : 'L1',
      decision: 'blocked_opt_out',
      requiresHumanConfirmation: true,
      blocked: true,
      blockReasons: ['客户已退订或停止触达，自动回复 / 自动随访均阻断。'],
      auditReason: input.isAftercareFollowup ? 'ai_auto_followup_blocked' : 'ai_auto_reply_blocked',
      explanation: 'opt-out 优先级最高，不能自动触达客户。',
    });
  }

  if (!input.frequencyCapPassed) {
    return result({
      context: input,
      level: input.isAftercareFollowup ? 'L3' : 'L1',
      decision: 'blocked_frequency_cap',
      requiresHumanConfirmation: true,
      blocked: true,
      blockReasons: ['频率限制未通过，已阻断自动触达。'],
      auditReason: input.isAftercareFollowup ? 'ai_auto_followup_blocked' : 'ai_auto_reply_blocked',
      explanation: '频率限制未通过时，只能保留人工确认和低敏审计。',
    });
  }

  if (input.isMarketing || input.intentType === 'marketing_campaign') {
    return result({
      context: input,
      level: 'L4',
      decision: 'blocked_marketing_automation',
      requiresHumanConfirmation: true,
      blocked: true,
      blockReasons: ['L4 营销自动化 / 群发 / 裂变当前默认阻断。'],
      auditReason: 'ai_marketing_automation_blocked',
      explanation: '营销自动化当前只允许规划展示，不允许模拟执行或真实发送。',
    });
  }

  if (input.isAddFriendIntent || input.intentType === 'add_friend') {
    return result({
      context: input,
      level: 'L4',
      decision: 'blocked_add_friend',
      requiresHumanConfirmation: true,
      blocked: true,
      blockReasons: ['自动加好友 / 主加触达当前默认阻断。'],
      auditReason: 'ai_add_friend_blocked',
      explanation: '加好友涉及授权、账号风控和投诉风险，当前不得自动执行。',
    });
  }

  if (hasRealChannelEnableAttempt(input.safetySwitchSummary ?? {})) {
    return result({
      context: input,
      level: input.isAftercareFollowup ? 'L3' : 'L2',
      decision: 'blocked_real_channel_disabled',
      requiresHumanConfirmation: true,
      blocked: true,
      blockReasons: ['检测到真实渠道启用尝试，安全开关已阻断真实发送。'],
      auditReason: input.isAftercareFollowup ? 'ai_auto_followup_blocked' : 'ai_auto_reply_blocked',
      explanation: '当前仅允许策略模拟，真实渠道、真实发送和真实出网均保持关闭。',
    });
  }

  if (hasHighRisk(input)) {
    return result({
      context: input,
      level: 'L1',
      decision: 'blocked_high_risk',
      requiresHumanConfirmation: true,
      blocked: true,
      blockReasons: ['投诉、医疗风险、疗效承诺、过敏或术后异常风险需人工处理。'],
      auditReason: input.isAftercareFollowup ? 'ai_auto_followup_blocked' : 'ai_auto_reply_blocked',
      explanation: '高风险会话不能自动回复或自动随访，必须转人工确认。',
    });
  }

  if (hasPriceCommitmentRisk(input) || input.intentType === 'price_question') {
    return result({
      context: input,
      level: 'L1',
      decision: 'draft_requires_human',
      requiresHumanConfirmation: true,
      blocked: false,
      blockReasons: ['价格问题或价格承诺风险需人工确认，不自动承诺价格。'],
      auditReason: input.isAftercareFollowup
        ? 'ai_auto_followup_human_confirmation_required'
        : 'ai_auto_reply_human_confirmation_required',
      explanation: '价格边界必须由人工核实，只能生成低敏草稿。',
    });
  }

  if (input.intentType === 'unknown') {
    return result({
      context: input,
      level: 'L1',
      decision: 'blocked_unknown_intent',
      requiresHumanConfirmation: true,
      blocked: false,
      blockReasons: ['未知意图默认转人工确认。'],
      auditReason: input.isAftercareFollowup
        ? 'ai_auto_followup_human_confirmation_required'
        : 'ai_auto_reply_human_confirmation_required',
      explanation: '未知意图不进入自动回复或自动随访，只保留人工确认草稿。',
    });
  }

  if (input.isAftercareFollowup) {
    if (!input.hasConsent) {
      return result({
        context: input,
        level: 'L3',
        decision: 'blocked_missing_consent',
        requiresHumanConfirmation: true,
        blocked: true,
        blockReasons: ['缺少客户授权，阻断自动随访。'],
        auditReason: 'ai_auto_followup_blocked',
        explanation: '受控自动随访必须先满足授权、退订和频控条件。',
      });
    }

    if (input.intentType === 'aftercare_question') {
      return result({
        context: input,
        level: 'L3',
        decision: 'mock_followup_allowed',
        canAutoFollowupMock: true,
        requiresHumanConfirmation: false,
        blocked: false,
        auditReason: 'ai_auto_followup_mock_allowed',
        explanation: '已授权、未退订、频控通过且低风险的术后随访，允许本地模拟自动执行。',
      });
    }
  }

  if (input.intentType === 'basic_faq' || input.intentType === 'appointment_question') {
    return result({
      context: input,
      level: 'L2',
      decision: 'mock_auto_reply_allowed',
      canAutoReplyMock: true,
      requiresHumanConfirmation: false,
      blocked: false,
      auditReason: 'ai_auto_reply_mock_allowed',
      explanation: '低风险基础问答或预约问题允许模拟自动回复；真实通道仍保持关闭。',
    });
  }

  return result({
    context: input,
    level: 'L0',
    decision: 'recommend_only',
    requiresHumanConfirmation: true,
    blocked: false,
    auditReason: 'ai_auto_strategy_evaluated',
    explanation: '当前仅生成 AI 推荐，不自动发送，不进入真实渠道。',
  });
}

export function createAiAutoStrategyTimelineMetadata(
  result: AiAutoStrategyResult,
): Record<string, string | null> {
  return {
    aiAutoStrategyLevel: result.recommendedLevel,
    aiAutoStrategyDecision: result.decision,
    aiAutoStrategyDecisionLabel: result.decisionLabel,
    aiAutoStrategyCanAutoReplyMock: String(result.canAutoReplyMock),
    aiAutoStrategyCanAutoFollowupMock: String(result.canAutoFollowupMock),
    aiAutoStrategyRequiresHumanConfirmation: String(result.requiresHumanConfirmation),
    aiAutoStrategyBlocked: String(result.blocked),
    aiAutoStrategyAuditReason: result.auditReason,
    allowRealSend: String(result.allowRealSend),
    externalChannelEnabled: String(result.externalChannelEnabled),
    realChannelBlocked: String(result.realChannelBlocked),
  };
}

export function assertAiAutoStrategyLowSensitivePayload(input: unknown) {
  const visit = (value: unknown): boolean => {
    if (typeof value === 'string') return isLowSensitiveText(value);
    if (Array.isArray(value)) return value.every((item) => visit(item));
    if (typeof value === 'object' && value !== null) {
      return Object.entries(value).every(([key, item]) => isLowSensitiveText(key) && visit(item));
    }

    return true;
  };

  return visit(input);
}
