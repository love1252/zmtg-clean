import { fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  aiAutoStrategyAuditReasons,
  aiAutoStrategyLevelDefinitions,
  assertAiAutoStrategyLowSensitivePayload,
  evaluateAiAutoStrategy,
  type AiAutoStrategyContext,
} from '@/modules/institution/domain/ai-auto-strategy';
import { AiConversationWorkbenchShell } from '@/modules/institution/components/AiConversationWorkbenchShell';
import {
  aiConversationAuditReasons,
  aiConversationBoundaryLabels,
  aiConversationReferenceLabels,
  assertAiConversationLowSensitivePayload,
  buildAiConversationWorkbenchStats,
  closeAiConversation,
  detectAiConversationSendRisks,
  evaluateAiConversationAutomationStrategy,
  evaluateAiConversationRealChannelPreflight,
  filterAiConversations,
  getAiConversationWorkbenchFixture,
  markAiConversationAutomationBlocked,
  markAiConversationAutomationNeedsHuman,
  mockSendAiConversationMessage,
  simulateAiConversationAutoFollowupStrategy,
  simulateAiConversationAutoReplyStrategy,
  takeoverAiConversation,
  useAiConversationRecommendation,
} from '@/modules/institution/domain/ai-conversation-workbench';

const unsafeTerms = [
  '13800000000',
  '110101199001010011',
  'MR-RAW-001',
  '完整病历',
  '咨询全文',
  '聊天原文',
  'external_userid',
  'userid',
  'corpId',
  'DATABASE_URL',
  'postgres://',
  'secret',
  'token',
  'api key',
  'HIS payload',
  'webhook payload',
  '机器编号',
  '扫码托管',
  '端口托管',
  'uip',
];

function expectNoUnsafeText(text: string) {
  const normalized = text
    .replaceAll('不配置 secret / token', '')
    .replaceAll('secret / token', '')
    .replaceAll('secret 输入阻断数量', '')
    .replaceAll('secret 保管方式', '')
    .replaceAll('不读取 secret', '')
    .replaceAll('不保存 secret', '')
    .replaceAll('secret 保管人', '')
    .replaceAll('secret 输入阻断数量', '')
    .replaceAll('noSecretRead=true', '')
    .replaceAll('noSecretOutput=true', '')
    .replaceAll('noSecretStored=true', '')
    .replaceAll('secret', '');
  for (const term of unsafeTerms) {
    expect(normalized).not.toContain(term);
  }
}

const mappingPanelResponse = {
  mapping: {
    proofContactId: 'live-contact-proof-01',
    proofEmployeeId: 'live-employee-proof-01',
    sourceMode: 'real_readonly_proof',
    status: 'unreviewed',
    customerId: null,
  },
  candidates: [],
  currentCustomer: null,
  canWrite: true,
};

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      new Response(JSON.stringify(mappingPanelResponse), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    ),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const baseStrategyContext: AiAutoStrategyContext = {
  conversationId: 'ai-conv-test',
  tenantId: 'tenant-low-sensitive-001',
  institutionId: 'institution-low-sensitive-001',
  customerMaskedRef: '客户 ZM****T01',
  conversationStatus: 'ai_handling',
  intentType: 'basic_faq',
  riskTags: [],
  hasConsent: true,
  hasOptOut: false,
  frequencyCapPassed: true,
  isAftercareFollowup: false,
  isMarketing: false,
  isAddFriendIntent: false,
  isComplaint: false,
  isMedicalRisk: false,
  isPriceCommitmentRisk: false,
  safetySwitchSummary: {
    emergencyStopEnabled: true,
    allowRealSend: false,
    externalChannelEnabled: false,
  },
  operatorRole: 'customer_service',
};

function evaluateStrategy(overrides: Partial<AiAutoStrategyContext> = {}) {
  return evaluateAiAutoStrategy({ ...baseStrategyContext, ...overrides });
}

describe('自动回复与自动随访策略模拟 domain', () => {
  it('定义 L0-L4 自动化等级模型并全部禁止真实通道', () => {
    expect(aiAutoStrategyLevelDefinitions.map((level) => level.level)).toEqual(['L0', 'L1', 'L2', 'L3', 'L4']);
    expect(aiAutoStrategyLevelDefinitions.map((level) => level.title)).toEqual([
      'L0 AI 推荐',
      'L1 AI 草稿 + 人工确认',
      'L2 低风险自动回复',
      'L3 受控自动随访',
      'L4 营销自动化 / 群发 / 加好友 / 裂变',
    ]);
    for (const level of aiAutoStrategyLevelDefinitions) {
      expect(level.realChannelAllowed).toBe(false);
      expect(level.auditRequired).toBe(true);
    }
    expect(aiAutoStrategyLevelDefinitions.find((level) => level.level === 'L0')?.defaultClosed).toBe(false);
    expect(aiAutoStrategyLevelDefinitions.find((level) => level.level === 'L1')?.requiresHumanConfirmation).toBe(true);
    expect(aiAutoStrategyLevelDefinitions.find((level) => level.level === 'L2')?.mockExecutionAllowed).toBe(true);
    expect(aiAutoStrategyLevelDefinitions.find((level) => level.level === 'L3')?.requiresOptOutCheck).toBe(true);
    expect(aiAutoStrategyLevelDefinitions.find((level) => level.level === 'L4')?.defaultClosed).toBe(true);
  });

  it('L0 AI 推荐不自动发送，L1 AI 草稿需要人工确认', () => {
    const recommendOnly = evaluateStrategy({ intentType: 'aftercare_question', isAftercareFollowup: false });
    expect(recommendOnly.recommendedLevel).toBe('L0');
    expect(recommendOnly.decision).toBe('recommend_only');
    expect(recommendOnly.canAutoReplyMock).toBe(false);
    expect(recommendOnly.canAutoFollowupMock).toBe(false);
    expect(recommendOnly.requiresHumanConfirmation).toBe(true);

    const draftRequiresHuman = evaluateStrategy({ intentType: 'price_question', isPriceCommitmentRisk: true });
    expect(draftRequiresHuman.recommendedLevel).toBe('L1');
    expect(draftRequiresHuman.decision).toBe('draft_requires_human');
    expect(draftRequiresHuman.requiresHumanConfirmation).toBe(true);
    expect(draftRequiresHuman.canAutoReplyMock).toBe(false);
  });

  it('L2 低风险基础问答或预约问题允许模拟自动回复', () => {
    const faq = evaluateStrategy({ intentType: 'basic_faq' });
    expect(faq.recommendedLevel).toBe('L2');
    expect(faq.decision).toBe('mock_auto_reply_allowed');
    expect(faq.canAutoReplyMock).toBe(true);
    expect(faq.requiresHumanConfirmation).toBe(false);
    expect(faq.allowRealSend).toBe(false);
    expect(faq.externalChannelEnabled).toBe(false);

    const appointment = evaluateStrategy({ intentType: 'appointment_question' });
    expect(appointment.decision).toBe('mock_auto_reply_allowed');
    expect(appointment.canAutoReplyMock).toBe(true);
  });

  it('L3 合规术后随访允许模拟自动随访', () => {
    const result = evaluateStrategy({
      intentType: 'aftercare_question',
      isAftercareFollowup: true,
      hasConsent: true,
      hasOptOut: false,
      frequencyCapPassed: true,
    });

    expect(result.recommendedLevel).toBe('L3');
    expect(result.decision).toBe('mock_followup_allowed');
    expect(result.canAutoFollowupMock).toBe(true);
    expect(result.requiresHumanConfirmation).toBe(false);
    expect(result.safeFollowupPlan.channelBoundary).toContain('仅模拟自动随访');
  });

  it('L4 营销自动化和自动加好友默认阻断', () => {
    const marketing = evaluateStrategy({ intentType: 'marketing_campaign', isMarketing: true });
    expect(marketing.recommendedLevel).toBe('L4');
    expect(marketing.decision).toBe('blocked_marketing_automation');
    expect(marketing.blocked).toBe(true);
    expect(marketing.auditReason).toBe('ai_marketing_automation_blocked');

    const addFriend = evaluateStrategy({
      intentType: 'add_friend',
      isAddFriendIntent: true,
      isMedicalRisk: false,
      isComplaint: false,
      isPriceCommitmentRisk: false,
    });
    expect(addFriend.recommendedLevel).toBe('L4');
    expect(addFriend.decision).toBe('blocked_add_friend');
    expect(addFriend.blocked).toBe(true);
    expect(addFriend.auditReason).toBe('ai_add_friend_blocked');
  });

  it('投诉、医疗风险和价格承诺风险必须人工确认或阻断', () => {
    expect(evaluateStrategy({ intentType: 'complaint', isComplaint: true }).decision).toBe('blocked_high_risk');
    expect(evaluateStrategy({ intentType: 'medical_risk', isMedicalRisk: true }).decision).toBe('blocked_high_risk');
    const price = evaluateStrategy({ intentType: 'price_question', isPriceCommitmentRisk: true });
    expect(price.decision).toBe('draft_requires_human');
    expect(price.requiresHumanConfirmation).toBe(true);
  });

  it('opt-out、频率限制、未授权、未知意图和 emergency stop 守卫按保守规则处理', () => {
    expect(evaluateStrategy({ hasOptOut: true }).decision).toBe('blocked_opt_out');
    expect(evaluateStrategy({ frequencyCapPassed: false }).decision).toBe('blocked_frequency_cap');
    expect(evaluateStrategy({ intentType: 'aftercare_question', isAftercareFollowup: true, hasConsent: false }).decision).toBe('blocked_missing_consent');
    expect(evaluateStrategy({ intentType: 'unknown' }).decision).toBe('blocked_unknown_intent');

    const result = evaluateStrategy({
      safetySwitchSummary: {
        emergencyStopEnabled: true,
        allowRealSend: true,
        externalChannelEnabled: true,
      },
    });
    expect(result.decision).toBe('blocked_real_channel_disabled');
    expect(result.allowRealSend).toBe(false);
    expect(result.externalChannelEnabled).toBe(false);
    expect(result.realChannelBlocked).toBe(true);
    expect(result.safetySwitchSummary.emergencyStopEnabled).toBe(true);
    expect(result.safetySwitchSummary.allowRealSend).toBe(false);
    expect(result.safetySwitchSummary.externalChannelEnabled).toBe(false);
    expect(result.blockReasons).toEqual(expect.arrayContaining([
      '真实渠道阻断：emergency_stop_enabled',
      '真实渠道阻断：allow_real_send_forced_false',
      '真实渠道阻断：external_channel_forced_false',
    ]));

    const sensitive = evaluateStrategy({ customerMaskedRef: '13800000000' });
    expect(sensitive.decision).toBe('blocked_sensitive_output');
    expect(sensitive.blocked).toBe(true);
  });

  it('输出低敏策略结果、audit reason、时间线 metadata 和模拟动作', () => {
    expect(aiAutoStrategyAuditReasons).toEqual([
      'ai_auto_strategy_evaluated',
      'ai_auto_reply_mock_allowed',
      'ai_auto_followup_mock_allowed',
      'ai_auto_reply_human_confirmation_required',
      'ai_auto_followup_human_confirmation_required',
      'ai_auto_reply_blocked',
      'ai_auto_followup_blocked',
      'ai_marketing_automation_blocked',
      'ai_add_friend_blocked',
    ]);

    const [conversation] = getAiConversationWorkbenchFixture();
    const autoReply = simulateAiConversationAutoReplyStrategy({
      conversation,
      context: { intentType: 'basic_faq', riskTags: [], isMedicalRisk: false, isComplaint: false },
      occurredAt: '2026-07-08T10:00:00.000+08:00',
    });
    expect(autoReply.kind).toBe('evaluated');
    expect(autoReply.conversation.timeline.at(-4)?.auditReason).toBe('ai_auto_reply_mock_allowed');
    expect(autoReply.conversation.timeline.at(-4)?.metadata?.allowRealSend).toBe('false');

    const autoFollowup = simulateAiConversationAutoFollowupStrategy({
      conversation,
      context: { intentType: 'aftercare_question', riskTags: [], isAftercareFollowup: true, isMedicalRisk: false },
      occurredAt: '2026-07-08T10:01:00.000+08:00',
    });
    expect(autoFollowup.conversation.timeline.at(-4)?.auditReason).toBe('ai_auto_followup_mock_allowed');

    expect(markAiConversationAutomationNeedsHuman({ conversation: autoReply.conversation, occurredAt: '2026-07-08T10:02:00.000+08:00' }).kind).toBe('requires_human_confirmation');
    expect(markAiConversationAutomationBlocked({ conversation, occurredAt: '2026-07-08T10:03:00.000+08:00' }).kind).toBe('blocked');

    const result = evaluateAiConversationAutomationStrategy({ conversation, occurredAt: '2026-07-08T10:04:00.000+08:00' });
    expect(assertAiAutoStrategyLowSensitivePayload(result.conversation.automationStrategy)).toBe(true);
    expect(assertAiAutoStrategyLowSensitivePayload({ raw: '13800000000' })).toBe(false);
  });
});

describe('AI 会话工作台模拟版 domain', () => {
  it('支持会话列表状态筛选与四种会话状态', () => {
    const conversations = getAiConversationWorkbenchFixture();

    expect(filterAiConversations(conversations, 'all')).toHaveLength(4);
    expect(filterAiConversations(conversations, 'ai').map((item) => item.status)).toEqual(['ai_handling']);
    expect(filterAiConversations(conversations, 'waiting_human').map((item) => item.status)).toEqual(['waiting_human']);
    expect(filterAiConversations(conversations, 'human_takeover').map((item) => item.status)).toEqual(['human_takeover']);
    expect(conversations.map((item) => item.status)).toContain('closed');
  });

  it('聚合工作台低敏统计', () => {
    const stats = buildAiConversationWorkbenchStats(getAiConversationWorkbenchFixture());

    expect(stats).toEqual({
      totalCount: 4,
      aiHandlingCount: 1,
      waitingHumanCount: 1,
      humanTakeoverCount: 1,
      riskWarningCount: 2,
      recommendationCount: 3,
      mockSentCount: 0,
      closedCount: 1,
      strategyEvaluatedCount: 4,
      aiRecommendOnlyCount: 0,
      humanConfirmationRequiredCount: 3,
      mockAutoReplyAllowedCount: 1,
      mockAutoFollowupAllowedCount: 0,
      highRiskBlockedCount: 2,
      marketingAutomationBlockedCount: 0,
      addFriendBlockedCount: 0,
      preflightCheckCount: 4,
      preflightMockEligibleCount: 1,
      preflightRealSendBlockedCount: 4,
      preflightSensitiveConfigBlockedCount: 0,
      preflightAccountCustodyRouteBlockedCount: 0,
      preflightMissingManualConfirmationBlockedCount: 3,
      preflightSafetySwitchBlockedCount: 4,
      dryRunConfigCheckCount: 4,
      dryRunReadyCount: 0,
      dryRunSecretInputBlockedCount: 0,
      dryRunRealNetworkBlockedCount: 0,
      dryRunRealSendBlockedCount: 4,
      dryRunCallbackPlaceholderMissingCount: 0,
      dryRunManualConfirmationMissingCount: 3,
      officialDryRunCheckCount: 4,
      officialDryRunPlanReadyCount: 0,
      officialDryRunMockCompletedCount: 0,
      officialDryRunRealNetworkBlockedCount: 0,
      officialDryRunRealSendBlockedCount: 0,
      officialDryRunSensitivePayloadBlockedCount: 0,
      officialDryRunMissingManualConfirmationBlockedCount: 3,
    });
  });

  it('支持人工接管并记录时间线和 audit reason', () => {
    const [conversation] = getAiConversationWorkbenchFixture();
    const result = takeoverAiConversation({
      conversation,
      actorId: 'consultant-mock-001',
      occurredAt: '2026-07-08T10:00:00.000+08:00',
    });

    expect(result.kind).toBe('taken_over');
    expect(result.conversation.status).toBe('human_takeover');
    expect(result.conversation.aiProcessingLabel).toBe('人工已接管');
    expect(result.conversation.canTakeover).toBe(false);
    expect(result.conversation.messages.at(-1)?.safeSummary).toBe('咨询师已接管会话。');
    expect(result.conversation.timeline.at(-4)?.auditReason).toBe('ai_conversation_takeover');
  });

  it('支持一键使用推荐回复生成发送前草稿', () => {
    const [conversation] = getAiConversationWorkbenchFixture();
    const recommendation = conversation.recommendations[0];
    const result = useAiConversationRecommendation({
      conversation,
      recommendationId: recommendation.id,
      actorId: 'consultant-mock-001',
      occurredAt: '2026-07-08T10:00:00.000+08:00',
    });

    expect(result.kind).toBe('used');
    expect(result.draft).toBe(recommendation.safeContent);
    expect(result.conversation.timeline.at(-1)?.auditReason).toBe('ai_conversation_recommendation_used');
  });

  it('发送前确认后生成 MessageDelivery mock_sent 记录且不接真实渠道', () => {
    const [conversation] = getAiConversationWorkbenchFixture();
    const notTakenOver = mockSendAiConversationMessage({
      conversation,
      content: '您好，已收到您的反馈，后续由人工为您确认到院复核安排。',
      actorId: 'consultant-mock-001',
      occurredAt: '2026-07-08T10:00:30.000+08:00',
    });
    expect(notTakenOver.kind).toBe('requires_takeover');

    const takenOver = takeoverAiConversation({
      conversation,
      actorId: 'consultant-mock-001',
      occurredAt: '2026-07-08T10:00:00.000+08:00',
    }).conversation;
    const result = mockSendAiConversationMessage({
      conversation: takenOver,
      content: '您好，已收到您的反馈，后续由人工为您确认到院复核安排。',
      actorId: 'consultant-mock-001',
      occurredAt: '2026-07-08T10:01:00.000+08:00',
    });

    expect(result.kind).toBe('mock_sent');
    if (result.kind !== 'mock_sent') return;
    expect(result.delivery.status).toBe('mock_sent');
    expect(result.delivery.channelType).toBe('mock');
    expect(result.delivery.deliveryMode).toBe('mock');
    expect(result.delivery.boundaryLabel).toContain('不自动发送');
    expect(result.conversation.messages.at(-1)?.delivery?.status).toBe('mock_sent');
    expect(result.conversation.timeline.at(-1)?.auditReason).toBe('ai_conversation_message_mock_sent');
    expect(result.conversation.timeline.at(-1)?.metadata?.externalChannelEnabled).toBe('false');
    expect(result.conversation.timeline.at(-1)?.metadata?.forbidAutoSend).toBe('true');
    expect(result.conversation.timeline.at(-1)?.metadata?.requiresHumanApproval).toBe('true');
  });

  it('高风险内容会阻断或提示并写风险审计', () => {
    const [conversation] = getAiConversationWorkbenchFixture();
    const takenOver = takeoverAiConversation({
      conversation,
      actorId: 'consultant-mock-001',
      occurredAt: '2026-07-08T10:01:00.000+08:00',
    }).conversation;

    expect(detectAiConversationSendRisks('我们保证永久有效，也可以锁定最低价。')).toEqual([
      'efficacy_commitment_risk',
      'price_commitment_risk',
    ]);

    const result = mockSendAiConversationMessage({
      conversation: takenOver,
      content: '我们保证永久有效，也可以锁定最低价。',
      actorId: 'consultant-mock-001',
      occurredAt: '2026-07-08T10:02:00.000+08:00',
    });

    expect(result.kind).toBe('risk_blocked');
    if (result.kind !== 'risk_blocked') return;
    expect(result.conversation.timeline.at(-1)?.auditReason).toBe('ai_conversation_risk_blocked');
    expect(result.conversation.hasRiskWarning).toBe(true);
  });

  it('支持结束会话状态与 audit reason', () => {
    const [conversation] = getAiConversationWorkbenchFixture();
    const result = closeAiConversation({
      conversation,
      actorId: 'consultant-mock-001',
      occurredAt: '2026-07-08T10:03:00.000+08:00',
    });

    expect(result.kind).toBe('closed');
    expect(result.conversation.status).toBe('closed');
    expect(result.conversation.timeline.at(-1)?.auditReason).toBe('ai_conversation_closed');
  });

  it('支持真实通道前置检查、时间线事件和模拟 proof 准入状态', () => {
    const [conversation] = getAiConversationWorkbenchFixture();
    expect(conversation.realChannelPreflight.preflightStatus).toBe('blocked_safety_switch');
    expect(conversation.timeline.some((event) => event.auditReason === 'real_channel_preflight_blocked')).toBe(true);

    const takenOver = takeoverAiConversation({
      conversation,
      actorId: 'consultant-mock-001',
      occurredAt: '2026-07-08T10:00:00.000+08:00',
    }).conversation;
    const result = evaluateAiConversationRealChannelPreflight({
      conversation: takenOver,
      hasManualConfirmation: true,
      occurredAt: '2026-07-08T10:05:00.000+08:00',
    });

    expect(result.kind).toBe('blocked');
    expect(result.conversation.realChannelPreflight.realSendAllowed).toBe(false);
    expect(result.conversation.realChannelPreflight.allowRealSend).toBe(false);
    expect(result.conversation.realChannelPreflight.externalChannelEnabled).toBe(false);
    expect(result.conversation.timeline.at(-3)?.title).toBe('真实通道前置检查');
    expect(result.conversation.timeline.at(-3)?.metadata?.allowRealSend).toBe('false');
    expect(result.conversation.timeline.at(-2)?.title).toBe('企微 dry-run 配置');
    expect(result.conversation.timeline.at(-2)?.metadata?.weComDryRunNoSecretRead).toBe('true');
  });

  it('覆盖 AI 会话工作台 audit reason 并保持低敏 payload', () => {
    expect(aiConversationAuditReasons).toEqual([
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
    ]);
    expect(assertAiConversationLowSensitivePayload(getAiConversationWorkbenchFixture())).toBe(true);
    expect(assertAiConversationLowSensitivePayload({ phoneNumber: '13800000000' })).toBe(false);
    expect(assertAiConversationLowSensitivePayload({ source: '机器编号真实端口' })).toBe(false);
  });
});

describe('AI 会话工作台模拟版 UI', () => {
  it('展示会话列表、聊天窗口、AI / 档案面板、风险预警、推荐项目和低敏用户画像', async () => {
    const { container } = render(<AiConversationWorkbenchShell />);

    expect(screen.getByRole('heading', { name: 'AI 会话工作台' })).toBeInTheDocument();
    for (const label of aiConversationBoundaryLabels) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    for (const label of aiConversationReferenceLabels) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: '全部' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'AI' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '待接管' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '人工' })).toBeInTheDocument();
    expect(screen.getAllByText('AI 处理中').length).toBeGreaterThan(0);
    expect(screen.getByText('王女士')).toBeInTheDocument();
    expect(screen.getAllByText('风险预警').length).toBeGreaterThan(0);
    expect(screen.getAllByText('已有推荐回复').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: '接管会话' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '结束会话' })).toBeInTheDocument();
    expect(screen.getByText(/医美咨询账号 · AI 接待中/u)).toBeInTheDocument();
    expect(screen.getByText(/接管前输入区只可准备草稿/u)).toBeInTheDocument();
    expect(screen.getByText(/未接管不生成发送记录/u)).toBeInTheDocument();
    expect(screen.getByText('AI 推荐回复')).toBeInTheDocument();
    expect(screen.getByText('自动化策略')).toBeInTheDocument();
    expect(screen.getAllByText('真实通道前置检查').length).toBeGreaterThan(0);
    expect(screen.getByText(/当前通道路线/u)).toBeInTheDocument();
    expect(screen.getByText(/proof 准入状态/u)).toBeInTheDocument();
    expect(screen.getAllByText('是否允许真实发送：否').length).toBeGreaterThan(0);
    expect(screen.getByText(/是否允许模拟 proof/u)).toBeInTheDocument();
    expect(screen.getAllByText('allowRealSend=false').length).toBeGreaterThan(0);
    expect(screen.getAllByText('externalChannelEnabled=false').length).toBeGreaterThan(0);
    expect(screen.getAllByText('realSendAllowed=false').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/需要人工完成的动作/u).length).toBeGreaterThan(0);
    expect(screen.getByText(/不接真实企业微信 \/ 微信；不配置 secret \/ token；不真实发送/u)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '模拟评估真实通道前置检查' })).toBeInTheDocument();
    expect(screen.getAllByText('官方企业微信 dry-run 配置').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/当前官方路线/u).length).toBeGreaterThan(0);
    expect(screen.getByText(/测试机构低敏引用/u)).toBeInTheDocument();
    expect(screen.getByText(/callback URL 占位/u)).toBeInTheDocument();
    expect(screen.getAllByText(/secret 保管方式/u).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/dry-run 状态/u).length).toBeGreaterThan(0);
    expect(screen.getByText('是否允许真实出网：否')).toBeInTheDocument();
    expect(screen.getByText('noSecretStored=true')).toBeInTheDocument();
    expect(screen.getAllByText('noSecretRead=true').length).toBeGreaterThan(0);
    expect(screen.getByText(/本任务不读取 secret/u)).toBeInTheDocument();
    expect(screen.getByText(/本任务不配置真实企业微信/u)).toBeInTheDocument();
    expect(screen.getAllByText('官方路线 dry-run').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/networkMode/u).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/dry-run plan ready/u).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/mock dry-run completed/u).length).toBeGreaterThan(0);
    expect(screen.getByText('noRealSend=true')).toBeInTheDocument();
    expect(screen.getByText('noRealNetwork=true')).toBeInTheDocument();
    expect(screen.getByText('noSecretOutput=true')).toBeInTheDocument();
    expect(screen.getByText('当前仅 dry-run，不真实发送')).toBeInTheDocument();
    expect(screen.getByText('当前不执行真实企业微信出网')).toBeInTheDocument();
    expect(screen.getByText('dry-run 步骤')).toBeInTheDocument();
    expect(screen.getByText('L0-L4 等级说明')).toBeInTheDocument();
    expect(screen.getByText('L0 AI 推荐')).toBeInTheDocument();
    expect(screen.getByText('L1 AI 草稿 + 人工确认')).toBeInTheDocument();
    expect(screen.getByText('L2 低风险自动回复')).toBeInTheDocument();
    expect(screen.getByText('L3 受控自动随访')).toBeInTheDocument();
    expect(screen.getByText('L4 营销自动化 / 群发 / 加好友 / 裂变')).toBeInTheDocument();
    expect(screen.getByText(/当前策略结果/u)).toBeInTheDocument();
    expect(screen.getByText(/是否需要人工确认/u)).toBeInTheDocument();
    expect(screen.getAllByText('阻断原因').length).toBeGreaterThan(0);
    expect(screen.getByText('低敏回复草稿')).toBeInTheDocument();
    expect(screen.getByText(/低敏随访计划/u)).toBeInTheDocument();
    expect(screen.getByText(/自动回复和自动随访当前仅策略模拟/u)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '生成模拟建议' })).toBeInTheDocument();
    expect(screen.getByText('推荐项目')).toBeInTheDocument();
    expect(screen.getByText('水光恢复期低敏回复')).toBeInTheDocument();
    expect(screen.getByText('医疗建议风险')).toBeInTheDocument();
    expect(screen.getByText('过敏 / 术后异常风险')).toBeInTheDocument();
    expect(screen.getByText('光子嫩肤 + 水光护理组合')).toBeInTheDocument();
    expect(screen.getByText('时间线 / 审计')).toBeInTheDocument();
    expect(screen.getByText('ai_conversation_viewed · 2026-07-08T09:05:00.000+08:00')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '档案 tab' }));
    expect(screen.getByText('用户画像')).toBeInTheDocument();
    expect(screen.getByText('企业微信客户关联')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('当前状态：')).toBeInTheDocument());
    expect(screen.getByText('仅人工关联')).toBeInTheDocument();
    expect(screen.getByText('不自动匹配')).toBeInTheDocument();
    expect(screen.getByText('不自动创建或合并客户')).toBeInTheDocument();
    expect(screen.getByText('关联不代表允许触达')).toBeInTheDocument();
    expect(screen.getByText('当前不调用真实企业微信')).toBeInTheDocument();
    expect(screen.getByText('消费能力')).toBeInTheDocument();
    expect(screen.getByText('项目偏好')).toBeInTheDocument();
    expect(screen.getByText('复购意向')).toBeInTheDocument();
    expect(screen.getByText('最近到院')).toBeInTheDocument();
    expect(screen.getByText('最近访问')).toBeInTheDocument();
    expect(screen.getByText('随访任务摘要')).toBeInTheDocument();
    expect(screen.getByText('知识库依据摘要')).toBeInTheDocument();

    expectNoUnsafeText(container.textContent ?? '');
  });

  it('支持状态筛选、人工接管、一键使用推荐回复、模拟发送和结束会话', () => {
    render(<AiConversationWorkbenchShell />);

    fireEvent.click(screen.getByRole('button', { name: '待接管' }));
    expect(screen.getByText('林女士')).toBeInTheDocument();
    expect(screen.queryByText('王女士')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'AI' }));
    expect(screen.getByText('王女士')).toBeInTheDocument();
    expect(screen.queryByText('林女士')).not.toBeInTheDocument();

    expect(screen.getByRole('button', { name: '确认并模拟发送' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '接管会话' }));
    expect(screen.getByText('人工已接管：已记录低敏 audit 和时间线，仍不真实发送。')).toBeInTheDocument();
    expect(screen.getByText('咨询师已接管会话。')).toBeInTheDocument();
    expect(screen.getAllByText(/ai_conversation_takeover/u).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: '一键使用推荐回复' }));
    const input = screen.getByLabelText('AI 会话工作台模拟消息输入');
    expect(input).toHaveValue('您好，轻微泛红属于常见恢复反馈，请先加强保湿和观察；如果不适持续加重，我会帮您转人工跟进。');
    expect(screen.getByText('已一键使用推荐回复：已填入输入框，发送前仍需人工确认。')).toBeInTheDocument();

    fireEvent.change(input, { target: { value: '您好，已收到您的反馈，后续由人工为您确认到院复核安排。' } });
    fireEvent.click(screen.getByRole('button', { name: '确认并模拟发送' }));
    expect(screen.getByText('已模拟发送：生成 MessageDelivery mock_sent 记录，未触发真实渠道。')).toBeInTheDocument();
    expect(screen.getByText(/消息发送记录：mock_sent \/ mock \/ 不真实发送/u)).toBeInTheDocument();
    expect(screen.getAllByText(/ai_conversation_message_mock_sent/u).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: '结束会话' }));
    expect(screen.getByText('会话已结束：已记录低敏 audit 和时间线。')).toBeInTheDocument();
    expect(screen.getAllByText(/ai_conversation_closed/u).length).toBeGreaterThan(0);
  });

  it('高风险模拟发送会阻断并展示风险预警，不创建发送记录', () => {
    const { container } = render(<AiConversationWorkbenchShell />);

    fireEvent.click(screen.getByRole('button', { name: '接管会话' }));
    fireEvent.change(screen.getByLabelText('AI 会话工作台模拟消息输入'), {
      target: { value: '我们保证永久有效，也可以锁定最低价。' },
    });
    fireEvent.click(screen.getByRole('button', { name: '确认并模拟发送' }));

    expect(screen.getByText('高风险内容已阻断：疗效承诺风险、价格承诺风险。')).toBeInTheDocument();
    expect(screen.getAllByText(/ai_conversation_risk_blocked/u).length).toBeGreaterThan(0);
    expect(screen.queryByText(/消息发送记录：mock_sent/u)).not.toBeInTheDocument();
    expectNoUnsafeText(container.textContent ?? '');
  });

  it('支持自动化策略模拟动作并更新低敏时间线与统计', () => {
    render(<AiConversationWorkbenchShell />);
    const statsRegion = screen.getByLabelText('AI 会话工作台低敏统计');
    const autoReplyCard = within(statsRegion).getByText('模拟自动回复允许数量').closest('article');
    const followupCard = within(statsRegion).getByText('模拟自动随访允许数量').closest('article');
    const marketingCard = within(statsRegion).getByText('营销自动化阻断数量').closest('article');

    expect(autoReplyCard).not.toBeNull();
    expect(followupCard).not.toBeNull();
    expect(marketingCard).not.toBeNull();
    expect(within(autoReplyCard as HTMLElement).getByText('1')).toBeInTheDocument();
    expect(within(followupCard as HTMLElement).getByText('0')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '模拟生成自动回复策略' }));
    expect(screen.getByText('已模拟生成自动回复策略：低风险场景只允许 mock，不接真实渠道。')).toBeInTheDocument();
    expect(screen.getByText(/当前策略结果：允许低风险模拟自动回复/u)).toBeInTheDocument();
    expect(screen.getAllByText(/ai_auto_reply_mock_allowed/u).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: '模拟生成自动随访策略' }));
    expect(screen.getByText('已模拟生成自动随访策略：授权、未退订、频控通过且低风险才允许 mock。')).toBeInTheDocument();
    expect(screen.getByText(/当前策略结果：允许受控模拟自动随访/u, { selector: 'span' })).toBeInTheDocument();
    expect(screen.getAllByText(/ai_auto_followup_mock_allowed/u).length).toBeGreaterThan(0);
    expect(within(followupCard as HTMLElement).getByText('1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '模拟标记需要人工确认' }));
    expect(screen.getByText('已模拟标记需要人工确认：自动化策略不发送客户。')).toBeInTheDocument();
    expect(screen.getByText(/当前策略结果：未知意图需人工确认/u, { selector: 'span' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '模拟标记已阻断' }));
    expect(screen.getByText('已模拟标记已阻断：L4 营销自动化默认关闭。')).toBeInTheDocument();
    expect(screen.getByText(/当前策略结果：营销自动化默认阻断/u)).toBeInTheDocument();
    expect(screen.getAllByText(/ai_marketing_automation_blocked/u).length).toBeGreaterThan(0);
    expect(within(marketingCard as HTMLElement).getByText('1')).toBeInTheDocument();
  });

  it('看板统计会随模拟发送增加，且只沉淀低敏统计', () => {
    render(<AiConversationWorkbenchShell />);
    const statsRegion = screen.getByLabelText('AI 会话工作台低敏统计');

    expect(within(statsRegion).getByText('会话总数')).toBeInTheDocument();
    expect(within(statsRegion).getByText('AI 处理中数量')).toBeInTheDocument();
    expect(within(statsRegion).getByText('待接管数量')).toBeInTheDocument();
    expect(within(statsRegion).getByText('人工会话数量')).toBeInTheDocument();
    expect(within(statsRegion).getByText('风险预警数量')).toBeInTheDocument();
    expect(within(statsRegion).getByText('推荐回复数量')).toBeInTheDocument();
    expect(within(statsRegion).getByText('模拟发送数量')).toBeInTheDocument();
    expect(within(statsRegion).getByText('已结束会话数量')).toBeInTheDocument();
    expect(within(statsRegion).getByText('策略评估数量')).toBeInTheDocument();
    expect(within(statsRegion).getByText('AI 推荐数量')).toBeInTheDocument();
    expect(within(statsRegion).getByText('需要人工确认数量')).toBeInTheDocument();
    expect(within(statsRegion).getByText('模拟自动回复允许数量')).toBeInTheDocument();
    expect(within(statsRegion).getByText('模拟自动随访允许数量')).toBeInTheDocument();
    expect(within(statsRegion).getByText('高风险阻断数量')).toBeInTheDocument();
    expect(within(statsRegion).getByText('营销自动化阻断数量')).toBeInTheDocument();
    expect(within(statsRegion).getByText('加好友阻断数量')).toBeInTheDocument();
    expect(within(statsRegion).getByText('前置检查数量')).toBeInTheDocument();
    expect(within(statsRegion).getByText('模拟 proof 可进入数量')).toBeInTheDocument();
    const realSendCards = within(statsRegion).getAllByText('真实发送阻断数量');
    expect(realSendCards.length).toBeGreaterThan(0);
    expect(within(statsRegion).getByText('敏感配置阻断数量')).toBeInTheDocument();
    expect(within(statsRegion).getByText('账号托管路线阻断数量')).toBeInTheDocument();
    expect(within(statsRegion).getByText('未人工确认阻断数量')).toBeInTheDocument();
    expect(within(statsRegion).getByText('安全开关阻断数量')).toBeInTheDocument();
    expect(within(statsRegion).getByText('dry-run 配置检查数量')).toBeInTheDocument();
    expect(within(statsRegion).getByText('dry-run ready 数量')).toBeInTheDocument();
    expect(within(statsRegion).getByText('secret 输入阻断数量')).toBeInTheDocument();
    expect(within(statsRegion).getByText('真实出网阻断数量')).toBeInTheDocument();
    expect(within(statsRegion).getByText('callback 占位缺失数量')).toBeInTheDocument();
    expect(within(statsRegion).getByText('人工确认缺失数量')).toBeInTheDocument();
    expect(within(statsRegion).getByText('官方 dry-run 检查数量')).toBeInTheDocument();
    expect(within(statsRegion).getByText('dry-run plan ready 数量')).toBeInTheDocument();
    expect(within(statsRegion).getByText('mock dry-run completed 数量')).toBeInTheDocument();
    expect(within(statsRegion).getByText('官方真实网络阻断数量')).toBeInTheDocument();
    expect(within(statsRegion).getByText('官方真实发送阻断数量')).toBeInTheDocument();
    expect(within(statsRegion).getByText('官方敏感 payload 阻断数量')).toBeInTheDocument();
    expect(within(statsRegion).getByText('官方人工确认缺失阻断数量')).toBeInTheDocument();

    const mockSentCard = within(statsRegion).getByText('模拟发送数量').closest('article');
    expect(mockSentCard).not.toBeNull();
    expect(within(mockSentCard as HTMLElement).getByText('0')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '接管会话' }));
    fireEvent.change(screen.getByLabelText('AI 会话工作台模拟消息输入'), {
      target: { value: '您好，已收到您的反馈，后续由人工为您确认到院复核安排。' },
    });
    fireEvent.click(screen.getByRole('button', { name: '确认并模拟发送' }));

    expect(within(mockSentCard as HTMLElement).getByText('1')).toBeInTheDocument();
  });
});
