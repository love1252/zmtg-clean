import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AiConversationWorkbenchShell } from '@/modules/institution/components/AiConversationWorkbenchShell';
import {
  aiConversationAuditReasons,
  aiConversationBoundaryLabels,
  aiConversationReferenceLabels,
  assertAiConversationLowSensitivePayload,
  buildAiConversationWorkbenchStats,
  closeAiConversation,
  detectAiConversationSendRisks,
  filterAiConversations,
  getAiConversationWorkbenchFixture,
  mockSendAiConversationMessage,
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
  for (const term of unsafeTerms) {
    expect(text).not.toContain(term);
  }
}

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
    expect(result.conversation.timeline.at(-1)?.auditReason).toBe('ai_conversation_takeover');
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

    expect(detectAiConversationSendRisks('我们保证永久有效，也可以锁定最低价。')).toEqual([
      'efficacy_commitment_risk',
      'price_commitment_risk',
    ]);

    const result = mockSendAiConversationMessage({
      conversation,
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

  it('覆盖 AI 会话工作台 audit reason 并保持低敏 payload', () => {
    expect(aiConversationAuditReasons).toEqual([
      'ai_conversation_viewed',
      'ai_conversation_takeover',
      'ai_conversation_recommendation_used',
      'ai_conversation_message_mock_sent',
      'ai_conversation_risk_blocked',
      'ai_conversation_closed',
    ]);
    expect(assertAiConversationLowSensitivePayload(getAiConversationWorkbenchFixture())).toBe(true);
    expect(assertAiConversationLowSensitivePayload({ phoneNumber: '13800000000' })).toBe(false);
    expect(assertAiConversationLowSensitivePayload({ source: '机器编号真实端口' })).toBe(false);
  });
});

describe('AI 会话工作台模拟版 UI', () => {
  it('展示会话列表、聊天窗口、AI / 档案面板、风险预警、推荐项目和低敏用户画像', () => {
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
    expect(screen.getByText('AI 推荐回复')).toBeInTheDocument();
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

    fireEvent.change(screen.getByLabelText('AI 会话工作台模拟消息输入'), {
      target: { value: '我们保证永久有效，也可以锁定最低价。' },
    });
    fireEvent.click(screen.getByRole('button', { name: '确认并模拟发送' }));

    expect(screen.getByText('高风险内容已阻断：疗效承诺风险、价格承诺风险。')).toBeInTheDocument();
    expect(screen.getAllByText(/ai_conversation_risk_blocked/u).length).toBeGreaterThan(0);
    expect(screen.queryByText(/消息发送记录：mock_sent/u)).not.toBeInTheDocument();
    expectNoUnsafeText(container.textContent ?? '');
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
