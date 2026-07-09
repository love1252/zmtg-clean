'use client';

import { useMemo, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  Bot,
  FileText,
  MessageCircle,
  Send,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Users,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import {
  aiConversationBoundaryLabels,
  aiConversationReferenceLabels,
  aiConversationRiskTagLabels,
  aiConversationStatusLabels,
  buildAiConversationWorkbenchStats,
  closeAiConversation,
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
  applyAiConversationRecommendation,
  type AiConversationFilter,
  type AiConversationRecord,
} from '@/modules/institution/domain/ai-conversation-workbench';
import {
  aiAutoStrategyIntentLabels,
  aiAutoStrategyLevelDefinitions,
} from '@/modules/institution/domain/ai-auto-strategy';
import { cn } from '@/shared/utils/cn';

const filterItems = [
  { key: 'all', label: '全部' },
  { key: 'ai', label: 'AI' },
  { key: 'waiting_human', label: '待接管' },
  { key: 'human_takeover', label: '人工' },
] as const satisfies readonly { key: AiConversationFilter; label: string }[];

const statItems = [
  { key: 'totalCount', label: '会话总数' },
  { key: 'aiHandlingCount', label: 'AI 处理中数量' },
  { key: 'waitingHumanCount', label: '待接管数量' },
  { key: 'humanTakeoverCount', label: '人工会话数量' },
  { key: 'riskWarningCount', label: '风险预警数量' },
  { key: 'recommendationCount', label: '推荐回复数量' },
  { key: 'mockSentCount', label: '模拟发送数量' },
  { key: 'closedCount', label: '已结束会话数量' },
  { key: 'strategyEvaluatedCount', label: '策略评估数量' },
  { key: 'aiRecommendOnlyCount', label: 'AI 推荐数量' },
  { key: 'humanConfirmationRequiredCount', label: '需要人工确认数量' },
  { key: 'mockAutoReplyAllowedCount', label: '模拟自动回复允许数量' },
  { key: 'mockAutoFollowupAllowedCount', label: '模拟自动随访允许数量' },
  { key: 'highRiskBlockedCount', label: '高风险阻断数量' },
  { key: 'marketingAutomationBlockedCount', label: '营销自动化阻断数量' },
  { key: 'addFriendBlockedCount', label: '加好友阻断数量' },
  { key: 'preflightCheckCount', label: '前置检查数量' },
  { key: 'preflightMockEligibleCount', label: '模拟 proof 可进入数量' },
  { key: 'preflightRealSendBlockedCount', label: '真实发送阻断数量' },
  { key: 'preflightSensitiveConfigBlockedCount', label: '敏感配置阻断数量' },
  { key: 'preflightAccountCustodyRouteBlockedCount', label: '账号托管路线阻断数量' },
  { key: 'preflightMissingManualConfirmationBlockedCount', label: '未人工确认阻断数量' },
  { key: 'preflightSafetySwitchBlockedCount', label: '安全开关阻断数量' },
  { key: 'dryRunConfigCheckCount', label: 'dry-run 配置检查数量' },
  { key: 'dryRunReadyCount', label: 'dry-run ready 数量' },
  { key: 'dryRunSecretInputBlockedCount', label: 'secret 输入阻断数量' },
  { key: 'dryRunRealNetworkBlockedCount', label: '真实出网阻断数量' },
  { key: 'dryRunRealSendBlockedCount', label: '真实发送阻断数量' },
  { key: 'dryRunCallbackPlaceholderMissingCount', label: 'callback 占位缺失数量' },
  { key: 'dryRunManualConfirmationMissingCount', label: '人工确认缺失数量' },
  { key: 'officialDryRunCheckCount', label: '官方 dry-run 检查数量' },
  { key: 'officialDryRunPlanReadyCount', label: 'dry-run plan ready 数量' },
  { key: 'officialDryRunMockCompletedCount', label: 'mock dry-run completed 数量' },
  { key: 'officialDryRunRealNetworkBlockedCount', label: '官方真实网络阻断数量' },
  { key: 'officialDryRunRealSendBlockedCount', label: '官方真实发送阻断数量' },
  { key: 'officialDryRunSensitivePayloadBlockedCount', label: '官方敏感 payload 阻断数量' },
  { key: 'officialDryRunMissingManualConfirmationBlockedCount', label: '官方人工确认缺失阻断数量' },
] as const;

const messageBubbleClasses = {
  customer: 'border-blue-100 bg-blue-50 text-blue-950',
  ai: 'border-violet-100 bg-violet-50 text-violet-950',
  human: 'border-emerald-100 bg-emerald-50 text-emerald-950',
  system: 'border-slate-200 bg-slate-50 text-slate-700',
} as const;

const senderLabels = {
  customer: '客户消息',
  ai: 'AI 回复 / AI 建议',
  human: '人工消息',
  system: '系统事件',
} as const;

const nowForMock = '2026-07-08T10:00:00.000+08:00';

export function AiConversationWorkbenchShell() {
  const [conversations, setConversations] = useState<AiConversationRecord[]>(() =>
    getAiConversationWorkbenchFixture(),
  );
  const [activeFilter, setActiveFilter] = useState<AiConversationFilter>('all');
  const [activeConversationId, setActiveConversationId] = useState('ai-conv-001');
  const [activePanel, setActivePanel] = useState<'profile' | 'ai'>('ai');
  const [draft, setDraft] = useState('');
  const [notice, setNotice] = useState('当前为模拟版：不接真实企业微信 / 微信，不真实发送。');

  const filteredConversations = useMemo(
    () => filterAiConversations(conversations, activeFilter),
    [activeFilter, conversations],
  );
  const stats = useMemo(() => buildAiConversationWorkbenchStats(conversations), [conversations]);
  const activeConversation =
    conversations.find((conversation) => conversation.id === activeConversationId) ?? conversations[0];

  function updateConversation(nextConversation: AiConversationRecord) {
    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === nextConversation.id ? nextConversation : conversation,
      ),
    );
    setActiveConversationId(nextConversation.id);
  }

  function handleTakeover() {
    const result = takeoverAiConversation({
      conversation: activeConversation,
      actorId: 'consultant-mock-001',
      occurredAt: nowForMock,
    });
    updateConversation(result.conversation);
    setNotice(
      result.kind === 'taken_over'
        ? '人工已接管：已记录低敏 audit 和时间线，仍不真实发送。'
        : '已结束会话不能接管。',
    );
  }

  function handleUseRecommendation(recommendationId: string) {
    const result = applyAiConversationRecommendation({
      conversation: activeConversation,
      recommendationId,
      actorId: 'consultant-mock-001',
      occurredAt: nowForMock,
    });
    updateConversation(result.conversation);
    setDraft(result.draft);
    setNotice(
      result.kind === 'used'
        ? '已一键使用推荐回复：已填入输入框，发送前仍需人工确认。'
        : '未找到可用推荐回复。',
    );
  }

  function handleMockSend() {
    const result = mockSendAiConversationMessage({
      conversation: activeConversation,
      content: draft,
      actorId: 'consultant-mock-001',
      occurredAt: nowForMock,
    });
    updateConversation(result.conversation);
    if (result.kind === 'mock_sent') {
      setDraft('');
      setNotice('已模拟发送：生成 MessageDelivery mock_sent 记录，未触发真实渠道。');
      return;
    }

    if (result.kind === 'risk_blocked') {
      setNotice(`高风险内容已阻断：${result.risks.map((risk) => aiConversationRiskTagLabels[risk]).join('、')}。`);
      return;
    }

    if (result.kind === 'requires_takeover') {
      setNotice('请先接管会话：接管后才允许人工确认并生成模拟发送记录。');
      return;
    }

    setNotice('模拟发送未完成，请检查会话状态。');
  }

  function handleClose() {
    const result = closeAiConversation({
      conversation: activeConversation,
      actorId: 'consultant-mock-001',
      occurredAt: nowForMock,
    });
    updateConversation(result.conversation);
    setNotice(
      result.kind === 'closed'
        ? '会话已结束：已记录低敏 audit 和时间线。'
        : '会话已经处于已结束状态。',
    );
  }

  function handleEvaluateStrategy() {
    const result = evaluateAiConversationAutomationStrategy({
      conversation: activeConversation,
      occurredAt: nowForMock,
    });
    updateConversation(result.conversation);
    setNotice('已模拟生成自动化策略：只写入低敏时间线和 audit reason，不真实发送。');
  }

  function handleSimulateAutoReplyStrategy() {
    const result = simulateAiConversationAutoReplyStrategy({
      conversation: activeConversation,
      context: {
        intentType: 'basic_faq',
        riskTags: [],
        isComplaint: false,
        isMedicalRisk: false,
        isPriceCommitmentRisk: false,
        isAftercareFollowup: false,
      },
      occurredAt: nowForMock,
    });
    updateConversation(result.conversation);
    setNotice('已模拟生成自动回复策略：低风险场景只允许 mock，不接真实渠道。');
  }

  function handleSimulateAutoFollowupStrategy() {
    const result = simulateAiConversationAutoFollowupStrategy({
      conversation: activeConversation,
      context: {
        intentType: 'aftercare_question',
        riskTags: [],
        hasConsent: true,
        hasOptOut: false,
        frequencyCapPassed: true,
        isAftercareFollowup: true,
        isComplaint: false,
        isMedicalRisk: false,
        isPriceCommitmentRisk: false,
      },
      occurredAt: nowForMock,
    });
    updateConversation(result.conversation);
    setNotice('已模拟生成自动随访策略：授权、未退订、频控通过且低风险才允许 mock。');
  }

  function handleMarkHumanConfirmation() {
    const result = markAiConversationAutomationNeedsHuman({
      conversation: activeConversation,
      occurredAt: nowForMock,
    });
    updateConversation(result.conversation);
    setNotice('已模拟标记需要人工确认：自动化策略不发送客户。');
  }

  function handleMarkBlocked() {
    const result = markAiConversationAutomationBlocked({
      conversation: activeConversation,
      occurredAt: nowForMock,
    });
    updateConversation(result.conversation);
    setNotice('已模拟标记已阻断：L4 营销自动化默认关闭。');
  }

  function handleEvaluateRealChannelPreflight() {
    const result = evaluateAiConversationRealChannelPreflight({
      conversation: activeConversation,
      hasManualConfirmation: activeConversation.status === 'human_takeover',
      occurredAt: nowForMock,
    });
    updateConversation(result.conversation);
    setNotice(
      result.kind === 'mock_eligible'
        ? '真实通道前置检查完成：仅允许进入模拟 proof，不允许真实发送。'
        : '真实通道前置检查完成：已按安全门禁阻断。',
    );
  }

  return (
    <section className="space-y-5" aria-label="AI 会话工作台模拟版">
      <header className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-white/82 p-5 shadow-[0_24px_80px_rgba(32,61,104,0.12)] backdrop-blur-xl lg:p-6">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-4xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3.5 py-1.5 text-xs font-semibold text-violet-700">
              <Sparkles className="h-4 w-4" />
              当前为模拟版
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-normal text-slate-950 sm:text-4xl">
              AI 会话工作台
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
              参考补充截图与青焱 SCRM 教程中的客服中心、消息接入、分流详情和素材管理口径，模拟医美咨询账号、会话列表、聊天窗口、AI 推荐回复、风险预警、推荐项目、用户画像、人工接管、发送前确认、消息发送记录、时间线 / 审计 / 看板低敏沉淀。
            </p>
          </div>
          <div className="grid gap-2 text-xs font-semibold text-emerald-800 sm:grid-cols-2 xl:grid-cols-3">
            {aiConversationBoundaryLabels.map((label) => (
              <span key={label} className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2">
                {label}
              </span>
            ))}
          </div>
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-4 xl:grid-cols-8" aria-label="AI 会话工作台低敏统计">
        {statItems.map((item) => (
          <article key={item.key} className="rounded-2xl border border-white/80 bg-white/82 p-4 shadow-sm">
            <div className="text-xs font-semibold text-slate-500">{item.label}</div>
            <div className="mt-2 text-3xl font-semibold text-slate-950">{stats[item.key]}</div>
          </article>
        ))}
      </section>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
        {notice}
      </div>

      <section
        className="grid gap-2 rounded-2xl border border-slate-200 bg-white/82 p-4 text-sm font-semibold text-slate-700 shadow-sm sm:grid-cols-2 xl:grid-cols-3"
        aria-label="补充材料映射"
      >
        {aiConversationReferenceLabels.map((label) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            {label}
          </div>
        ))}
      </section>

      <section className="grid min-h-[760px] gap-4 xl:grid-cols-[330px_minmax(0,1fr)_390px]">
        <aside className="rounded-[24px] border border-white/80 bg-white/84 p-4 shadow-[0_20px_70px_rgba(32,61,104,0.10)] backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold tracking-normal text-slate-950">会话列表</h2>
              <p className="mt-1 text-xs text-slate-500">客户名称和员工标识均低敏展示</p>
            </div>
            <MessageCircle className="h-5 w-5 text-blue-500" />
          </div>
          <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-semibold leading-5 text-blue-800">
            医美咨询账号 · AI 接待中；接管前输入区只可准备草稿，不生成模拟发送记录。
          </div>
          <div className="mt-4 grid grid-cols-4 gap-2" aria-label="会话状态筛选">
            {filterItems.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setActiveFilter(item.key)}
                className={cn(
                  'rounded-xl border px-2 py-2 text-xs font-semibold',
                  activeFilter === item.key
                    ? 'border-blue-200 bg-blue-600 text-white'
                    : 'border-slate-200 bg-slate-50 text-slate-600',
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="mt-4 space-y-3">
            {filteredConversations.map((conversation) => (
              <button
                key={conversation.id}
                type="button"
                onClick={() => setActiveConversationId(conversation.id)}
                className={cn(
                  'w-full rounded-2xl border p-4 text-left transition',
                  activeConversation.id === conversation.id
                    ? 'border-blue-300 bg-blue-50 shadow-sm'
                    : 'border-slate-200 bg-white hover:border-blue-200',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-950">{conversation.customerDisplayName}</div>
                    <div className="mt-1 text-xs font-semibold text-slate-500">{conversation.customerMaskedRef}</div>
                  </div>
                  <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600">
                    {aiConversationStatusLabels[conversation.status]}
                  </span>
                </div>
                <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">
                  {conversation.recentMessageSummary}
                </p>
                <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold">
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-slate-600">
                    {conversation.ownerMaskedRef}
                  </span>
                  {conversation.hasRiskWarning ? (
                    <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-1 text-rose-600">风险预警</span>
                  ) : null}
                  {conversation.hasRecommendation ? (
                    <span className="rounded-full border border-violet-200 bg-violet-50 px-2 py-1 text-violet-600">已有推荐回复</span>
                  ) : null}
                  {conversation.canTakeover ? (
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-600">可接管</span>
                  ) : null}
                </div>
              </button>
            ))}
          </div>
        </aside>

        <main className="flex min-w-0 flex-col rounded-[24px] border border-white/80 bg-white/84 shadow-[0_20px_70px_rgba(32,61,104,0.10)] backdrop-blur-xl">
          <div className="border-b border-slate-200/80 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold tracking-normal text-slate-950">
                  {activeConversation.customerDisplayName} · {activeConversation.customerMaskedRef}
                </h2>
                <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
                  <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-blue-700">
                    {activeConversation.aiProcessingLabel}
                  </span>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-600">
                    {activeConversation.ownerMaskedRef}
                  </span>
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700">
                    外部通道未启用
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleTakeover}
                  disabled={!activeConversation.canTakeover}
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-blue-200 bg-blue-600 px-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                >
                  <UserCheck className="h-4 w-4" />
                  接管会话
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={activeConversation.status === 'closed'}
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-rose-200 bg-white px-3 text-sm font-semibold text-rose-600 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
                >
                  <XCircle className="h-4 w-4" />
                  结束会话
                </button>
              </div>
            </div>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {activeConversation.messages.map((message) => (
              <article
                key={message.id}
                className={cn(
                  'max-w-[780px] rounded-2xl border px-4 py-3',
                  message.sender === 'customer' ? 'mr-auto' : 'ml-auto',
                  messageBubbleClasses[message.sender],
                )}
              >
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                  <span>{senderLabels[message.sender]}</span>
                  <span className="text-slate-400">{message.occurredAt}</span>
                </div>
                <p className="mt-2 text-sm leading-6">{message.safeSummary}</p>
                {message.delivery ? (
                  <div className="mt-2 rounded-xl border border-emerald-200 bg-white/80 px-3 py-2 text-xs font-semibold text-emerald-700">
                    消息发送记录：{message.delivery.status} / {message.delivery.deliveryMode} / 不真实发送
                  </div>
                ) : null}
              </article>
            ))}
          </div>

          <div className="border-t border-slate-200/80 p-4">
            <div className="mb-3 flex flex-wrap gap-2">
              {activeConversation.recommendedQuestions.map((question) => (
                <button
                  key={question}
                  type="button"
                  onClick={() => setDraft((current) => current ? `${current} ${question}` : question)}
                  className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-semibold text-cyan-700"
                >
                  推荐提问：{question}
                </button>
              ))}
            </div>
            <label className="block">
              <span className="text-xs font-semibold text-slate-500">底部输入区域 / 发送前确认</span>
              <textarea
                aria-label="AI 会话工作台模拟消息输入"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                className="mt-2 min-h-24 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700 outline-none focus:border-blue-300"
                placeholder="点击「接管会话」后即可发送消息；推荐回复只生成草稿，发送前必须人工确认。"
              />
            </label>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs font-semibold text-slate-500">
                当前不接真实企业微信 / 微信；未接管不生成发送记录；高风险内容会提示或阻断。
              </div>
              <button
                type="button"
                onClick={handleMockSend}
                disabled={!draft.trim() || activeConversation.status !== 'human_takeover'}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
              >
                <Send className="h-4 w-4" />
                确认并模拟发送
              </button>
            </div>
          </div>
        </main>

        <aside className="rounded-[24px] border border-white/80 bg-white/84 p-4 shadow-[0_20px_70px_rgba(32,61,104,0.10)] backdrop-blur-xl">
          <div className="grid grid-cols-2 gap-2" aria-label="档案 / AI 面板">
            <button
              type="button"
              onClick={() => setActivePanel('profile')}
              className={cn(
                'rounded-xl border px-3 py-2 text-sm font-semibold',
                activePanel === 'profile'
                  ? 'border-blue-200 bg-blue-600 text-white'
                  : 'border-slate-200 bg-slate-50 text-slate-600',
              )}
            >
              档案 tab
            </button>
            <button
              type="button"
              onClick={() => setActivePanel('ai')}
              className={cn(
                'rounded-xl border px-3 py-2 text-sm font-semibold',
                activePanel === 'ai'
                  ? 'border-violet-200 bg-violet-600 text-white'
                  : 'border-slate-200 bg-slate-50 text-slate-600',
              )}
            >
              AI tab
            </button>
          </div>

          {activePanel === 'ai' ? (
            <AiPanel
              conversation={activeConversation}
              onUseRecommendation={handleUseRecommendation}
              onEvaluateStrategy={handleEvaluateStrategy}
              onSimulateAutoReplyStrategy={handleSimulateAutoReplyStrategy}
              onSimulateAutoFollowupStrategy={handleSimulateAutoFollowupStrategy}
              onMarkHumanConfirmation={handleMarkHumanConfirmation}
              onMarkBlocked={handleMarkBlocked}
              onEvaluateRealChannelPreflight={handleEvaluateRealChannelPreflight}
            />
          ) : (
            <ProfilePanel conversation={activeConversation} />
          )}
        </aside>
      </section>
    </section>
  );
}

function AiPanel({
  conversation,
  onUseRecommendation,
  onEvaluateStrategy,
  onSimulateAutoReplyStrategy,
  onSimulateAutoFollowupStrategy,
  onMarkHumanConfirmation,
  onMarkBlocked,
  onEvaluateRealChannelPreflight,
}: {
  conversation: AiConversationRecord;
  onUseRecommendation: (recommendationId: string) => void;
  onEvaluateStrategy: () => void;
  onSimulateAutoReplyStrategy: () => void;
  onSimulateAutoFollowupStrategy: () => void;
  onMarkHumanConfirmation: () => void;
  onMarkBlocked: () => void;
  onEvaluateRealChannelPreflight: () => void;
}) {
  const strategy = conversation.automationStrategy.result;
  const preflight = conversation.realChannelPreflight;
  const dryRunConfig = conversation.weComOfficialDryRunConfig;
  const officialDryRun = conversation.weComOfficialDryRun;

  return (
    <div className="mt-4 space-y-4">
      <PanelBlock icon={ShieldCheck} title="真实通道前置检查" tone="emerald">
        <div className="space-y-3">
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-emerald-700">
                当前通道路线：{preflight.routeLabel}
              </span>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                proof 准入状态：{preflight.preflightStatusLabel}
              </span>
            </div>
            <div className="mt-3 grid gap-2 text-xs font-semibold text-slate-700 sm:grid-cols-2">
              <span>是否允许真实发送：否</span>
              <span>是否允许模拟 proof：{preflight.proofEligibleMock ? '是' : '否'}</span>
              <span>allowRealSend=false</span>
              <span>externalChannelEnabled=false</span>
              <span>emergency stop：{preflight.emergencyStopEnabled ? '已开启' : '未开启'}</span>
              <span>audit reason：{preflight.auditReason}</span>
            </div>
            <p className="mt-3 text-sm leading-6 text-emerald-900">{preflight.lowSensitiveExplanation}</p>
          </div>

          <div className="grid gap-2 text-xs font-semibold sm:grid-cols-2">
            <button type="button" onClick={onEvaluateRealChannelPreflight} className="rounded-xl border border-emerald-200 bg-white px-3 py-2 text-emerald-700 sm:col-span-2">
              模拟评估真实通道前置检查
            </button>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-sm font-semibold text-slate-950">阻断原因</div>
            {preflight.blockReasons.length > 0 ? (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-slate-600">
                {preflight.blockReasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm font-semibold text-slate-500">当前无业务阻断；真实发送仍为否。</p>
            )}
          </div>

          <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-3">
            <div className="text-sm font-semibold text-blue-950">需要人工完成的动作</div>
            {preflight.requiredHumanActions.length > 0 ? (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-blue-900">
                {preflight.requiredHumanActions.map((action) => (
                  <li key={action}>{action}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm font-semibold text-blue-800">当前仅允许模拟 proof 前置进入，后续真实接入仍需单独授权。</p>
            )}
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold leading-6 text-amber-900">
            当前仅前置检查，不接真实企业微信 / 微信；不配置 secret / token；不真实发送。
          </div>
        </div>
      </PanelBlock>
      <PanelBlock icon={ShieldCheck} title="官方企业微信 dry-run 配置" tone="blue">
        <div className="space-y-3">
          <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-blue-700">
                当前官方路线：{dryRunConfig.routeLabel}
              </span>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                dry-run 状态：{dryRunConfig.configStatusLabel}
              </span>
            </div>
            <div className="mt-3 grid gap-2 text-xs font-semibold text-slate-700 sm:grid-cols-2">
              <span>测试机构低敏引用：{dryRunConfig.proofInstitutionRef ?? '未配置'}</span>
              <span>callback URL 占位：{dryRunConfig.callbackUrlPlaceholder ?? '未配置'}</span>
              <span>secret 保管方式：{dryRunConfig.configStatus === 'not_configured' ? '未确认' : '已确认 / 待复核'}</span>
              <span>dry-run ready：{dryRunConfig.dryRunReady ? '是' : '否'}</span>
              <span>是否允许真实出网：否</span>
              <span>是否允许真实发送：否</span>
              <span>allowRealSend=false</span>
              <span>externalChannelEnabled=false</span>
              <span>realSendAllowed=false</span>
              <span>noSecretStored=true</span>
              <span>noSecretRead=true</span>
              <span>audit reason：{dryRunConfig.auditReason}</span>
            </div>
            <p className="mt-3 text-sm leading-6 text-blue-900">{dryRunConfig.lowSensitiveExplanation}</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-sm font-semibold text-slate-950">阻断原因</div>
            {dryRunConfig.blockReasons.length > 0 ? (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-slate-600">
                {dryRunConfig.blockReasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm font-semibold text-slate-500">当前仅 dry-run 低敏占位可进入；真实发送仍为否。</p>
            )}
          </div>

          <div className="rounded-2xl border border-cyan-100 bg-cyan-50/70 p-3">
            <div className="text-sm font-semibold text-cyan-950">需要人工完成的动作</div>
            {dryRunConfig.requiredHumanActions.length > 0 ? (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-cyan-900">
                {dryRunConfig.requiredHumanActions.map((action) => (
                  <li key={action}>{action}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm font-semibold text-cyan-800">保持低敏占位，后续真实接入需独立授权。</p>
            )}
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold leading-6 text-amber-900">
            本任务不读取 secret；本任务不配置真实企业微信；不接 callback / webhook；不真实出网；不真实发送。
          </div>
        </div>
      </PanelBlock>
      <PanelBlock icon={ShieldCheck} title="官方路线 dry-run" tone="emerald">
        <div className="space-y-3">
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-emerald-700">
                当前官方路线：{officialDryRun.routeLabel}
              </span>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                dry-run 状态：{officialDryRun.dryRunStatusLabel}
              </span>
            </div>
            <div className="mt-3 grid gap-2 text-xs font-semibold text-slate-700 sm:grid-cols-2">
              <span>networkMode：{officialDryRun.networkMode}</span>
              <span>dry-run plan ready：{officialDryRun.dryRunPlanReady ? '是' : '否'}</span>
              <span>mock dry-run completed：{officialDryRun.mockDryRunCompleted ? '是' : '否'}</span>
              <span>noRealSend=true</span>
              <span>noRealNetwork=true</span>
              <span>noSecretRead=true</span>
              <span>noSecretOutput=true</span>
              <span>allowRealSend=false</span>
              <span>externalChannelEnabled=false</span>
              <span>realSendAllowed=false</span>
              <span>当前仅 dry-run，不真实发送</span>
              <span>当前不执行真实企业微信出网</span>
              <span>audit reason：{officialDryRun.auditReason}</span>
            </div>
            <p className="mt-3 text-sm leading-6 text-emerald-900">{officialDryRun.lowSensitiveExplanation}</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-sm font-semibold text-slate-950">dry-run 步骤</div>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-slate-600">
              {officialDryRun.dryRunSteps.map((step) => (
                <li key={step.id}>{step.label}（{step.status}）</li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-sm font-semibold text-slate-950">阻断原因</div>
            {officialDryRun.blockReasons.length > 0 ? (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-slate-600">
                {officialDryRun.blockReasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm font-semibold text-slate-500">当前无 dry-run 阻断；真实发送和真实出网仍为否。</p>
            )}
          </div>

          <div className="rounded-2xl border border-cyan-100 bg-cyan-50/70 p-3">
            <div className="text-sm font-semibold text-cyan-950">需要人工完成的动作</div>
            {officialDryRun.requiredHumanActions.length > 0 ? (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-cyan-900">
                {officialDryRun.requiredHumanActions.map((action) => (
                  <li key={action}>{action}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm font-semibold text-cyan-800">dry-run 仅限本地模拟；真实网络和真实发送需后续独立授权。</p>
            )}
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold leading-6 text-amber-900">
            live_dry_run_requested 仅预留状态，本任务不执行真实 fetch；不读取密钥；不输出密钥；不真实发送。
          </div>
        </div>
      </PanelBlock>
      <PanelBlock icon={ShieldCheck} title="自动化策略" tone="blue">
        <div className="space-y-3">
          <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-blue-700">
                当前会话建议等级：{strategy.recommendedLevel}
              </span>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                当前策略结果：{strategy.decisionLabel}
              </span>
            </div>
            <div className="mt-3 grid gap-2 text-xs font-semibold text-slate-700 sm:grid-cols-2">
              <span>意图：{aiAutoStrategyIntentLabels[conversation.automationStrategy.context.intentType]}</span>
              <span>是否可模拟自动回复：{strategy.canAutoReplyMock ? '是' : '否'}</span>
              <span>是否可模拟自动随访：{strategy.canAutoFollowupMock ? '是' : '否'}</span>
              <span>是否需要人工确认：{strategy.requiresHumanConfirmation ? '是' : '否'}</span>
              <span>是否已阻断：{strategy.blocked ? '是' : '否'}</span>
              <span>真实通道：allowRealSend=false / externalChannelEnabled=false</span>
            </div>
            <p className="mt-3 text-sm leading-6 text-blue-900">{strategy.lowSensitiveExplanation}</p>
          </div>

          <div className="grid gap-2 text-xs font-semibold sm:grid-cols-2">
            <button type="button" onClick={onEvaluateStrategy} className="rounded-xl border border-blue-200 bg-white px-3 py-2 text-blue-700">
              模拟生成自动化策略
            </button>
            <button type="button" onClick={onSimulateAutoReplyStrategy} className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700">
              模拟生成自动回复策略
            </button>
            <button type="button" onClick={onSimulateAutoFollowupStrategy} className="rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2 text-cyan-700">
              模拟生成自动随访策略
            </button>
            <button type="button" onClick={onMarkHumanConfirmation} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">
              模拟标记需要人工确认
            </button>
            <button type="button" onClick={onMarkBlocked} className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700 sm:col-span-2">
              模拟标记已阻断
            </button>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-sm font-semibold text-slate-950">阻断原因</div>
            {strategy.blockReasons.length > 0 ? (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-slate-600">
                {strategy.blockReasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm font-semibold text-slate-500">当前无业务阻断；真实渠道仍默认关闭。</p>
            )}
          </div>

          <div className="rounded-2xl border border-violet-100 bg-violet-50/70 p-3">
            <div className="text-sm font-semibold text-violet-950">低敏回复草稿</div>
            <p className="mt-2 text-sm leading-6 text-violet-900">{strategy.safeReplyDraft}</p>
          </div>

          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-3">
            <div className="text-sm font-semibold text-emerald-950">低敏随访计划：{strategy.safeFollowupPlan.title}</div>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-emerald-900">
              {strategy.safeFollowupPlan.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ul>
            <div className="mt-2 text-xs font-semibold text-emerald-700">{strategy.safeFollowupPlan.channelBoundary}</div>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-semibold text-slate-950">L0-L4 等级说明</div>
            {aiAutoStrategyLevelDefinitions.map((level) => (
              <article key={level.level} className="rounded-2xl border border-slate-200 bg-white px-3 py-2">
                <div className="text-sm font-semibold text-slate-950">{level.title}</div>
                <p className="mt-1 text-xs leading-5 text-slate-600">{level.summary}</p>
                <div className="mt-2 flex flex-wrap gap-1 text-[11px] font-semibold text-slate-500">
                  <span className="rounded-full bg-slate-50 px-2 py-1">客户可见：{level.customerVisible ? '是' : '否'}</span>
                  <span className="rounded-full bg-slate-50 px-2 py-1">人工确认：{level.requiresHumanConfirmation ? '是' : '否'}</span>
                  <span className="rounded-full bg-slate-50 px-2 py-1">模拟执行：{level.mockExecutionAllowed ? '允许' : '不允许'}</span>
                  <span className="rounded-full bg-slate-50 px-2 py-1">真实通道：不允许</span>
                  <span className="rounded-full bg-slate-50 px-2 py-1">频率限制：{level.requiresFrequencyCap ? '需要' : '建议'}</span>
                  <span className="rounded-full bg-slate-50 px-2 py-1">退订检查：{level.requiresOptOutCheck ? '需要' : '不涉及发送'}</span>
                  <span className="rounded-full bg-slate-50 px-2 py-1">必须写审计</span>
                  <span className="rounded-full bg-slate-50 px-2 py-1">默认关闭：{level.defaultClosed ? '是' : '否'}</span>
                </div>
              </article>
            ))}
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold leading-6 text-amber-900">
            当前为模拟版；不接真实企业微信 / 微信；不真实发送；自动回复和自动随访当前仅策略模拟。
          </div>
        </div>
      </PanelBlock>
      <PanelBlock icon={Bot} title="AI 推荐回复" tone="violet">
        {conversation.recommendations.length > 0 ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-violet-100 bg-white/80 px-3 py-2 text-xs font-semibold text-violet-700">
              <span>推荐回复由低敏知识库和快捷回复样式生成</span>
              <button type="button" className="rounded-xl bg-violet-600 px-3 py-1.5 text-white">
                生成模拟建议
              </button>
            </div>
            {conversation.recommendations.map((recommendation) => (
              <article key={recommendation.id} className="rounded-2xl border border-violet-100 bg-violet-50/70 p-3">
                <div className="text-sm font-semibold text-violet-950">{recommendation.title}</div>
                <p className="mt-2 text-sm leading-6 text-violet-900">{recommendation.safeContent}</p>
                <div className="mt-2 text-xs font-semibold text-violet-700">{recommendation.sourceSummary}</div>
                <button
                  type="button"
                  onClick={() => onUseRecommendation(recommendation.id)}
                  className="mt-3 rounded-xl bg-violet-600 px-3 py-2 text-xs font-semibold text-white"
                >
                  一键使用推荐回复
                </button>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-5 text-center text-sm font-semibold text-slate-500">
            暂无 AI 推荐回复
          </div>
        )}
      </PanelBlock>

      <PanelBlock icon={AlertTriangle} title="风险预警" tone="rose">
        {conversation.riskTags.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {conversation.riskTags.map((tag) => (
              <span key={tag} className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700">
                {aiConversationRiskTagLabels[tag]}
              </span>
            ))}
          </div>
        ) : (
          <div className="text-sm font-semibold text-slate-500">暂无风险预警</div>
        )}
      </PanelBlock>

      <PanelBlock icon={Sparkles} title="推荐项目" tone="emerald">
        <div className="space-y-3">
          {conversation.projectRecommendations.map((project) => (
            <article key={project.id} className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-emerald-950">{project.name}</span>
                <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-emerald-700">{project.matchLabel}</span>
              </div>
              <p className="mt-2 text-sm leading-6 text-emerald-900">{project.safeReason}</p>
              <div className="mt-2 text-xs font-semibold text-emerald-700">{project.priceBand}</div>
            </article>
          ))}
        </div>
      </PanelBlock>

      <PanelBlock icon={FileText} title="时间线 / 审计" tone="slate">
        <div className="space-y-3">
          {conversation.timeline.map((event, index) => (
            <article key={`${event.id}:${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-sm font-semibold text-slate-950">{event.title}</div>
              <p className="mt-1 text-sm leading-6 text-slate-600">{event.safeSummary}</p>
              <div className="mt-2 text-xs font-semibold text-slate-500">
                {event.auditReason} · {event.occurredAt}
              </div>
            </article>
          ))}
        </div>
      </PanelBlock>
    </div>
  );
}

function ProfilePanel({ conversation }: { conversation: AiConversationRecord }) {
  const profileItems = [
    ['低敏客户摘要', conversation.profile.lowSensitiveCustomerSummary],
    ['低敏消息摘要', conversation.profile.lowSensitiveMessageSummary],
    ['消费能力', conversation.profile.consumptionPower],
    ['项目偏好', conversation.profile.projectPreference],
    ['复购意向', conversation.profile.repurchaseIntent],
    ['最近到院', conversation.profile.recentVisit],
    ['最近访问', conversation.profile.recentAccess],
    ['随访任务摘要', conversation.profile.followUpTaskSummary],
    ['知识库依据摘要', conversation.profile.knowledgeSourceSummary],
  ];

  return (
    <div className="mt-4 space-y-4">
      <PanelBlock icon={Users} title="用户画像" tone="blue">
        <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-3">
          <div className="text-base font-semibold text-blue-950">{conversation.profile.customerDisplayName}</div>
          <div className="mt-1 text-xs font-semibold text-blue-700">{conversation.profile.customerMaskedRef}</div>
          <div className="mt-1 text-xs font-semibold text-blue-700">{conversation.profile.ownerMaskedRef}</div>
        </div>
        <div className="mt-3 space-y-2">
          {profileItems.map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-slate-200 bg-white px-3 py-2">
              <div className="text-xs font-semibold text-slate-400">{label}</div>
              <div className="mt-1 text-sm font-semibold leading-6 text-slate-700">{value}</div>
            </div>
          ))}
        </div>
      </PanelBlock>

      <PanelBlock icon={ShieldCheck} title="低敏边界" tone="emerald">
        <div className="space-y-2 text-sm leading-6 text-emerald-800">
          <p>不展示手机号、身份证号、病历编号、真实微信标识、外部联系人原始标识、员工原始标识。</p>
          <p>不展示聊天原始敏感内容、院内系统原始数据、凭证或密钥。</p>
        </div>
      </PanelBlock>
    </div>
  );
}

function PanelBlock({
  children,
  icon: Icon,
  title,
  tone,
}: {
  children: ReactNode;
  icon: LucideIcon;
  title: string;
  tone: 'blue' | 'emerald' | 'rose' | 'slate' | 'violet';
}) {
  const iconClasses = {
    blue: 'bg-blue-600 text-white',
    emerald: 'bg-emerald-600 text-white',
    rose: 'bg-rose-600 text-white',
    slate: 'bg-slate-700 text-white',
    violet: 'bg-violet-600 text-white',
  }[tone];

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white/86 p-4">
      <div className="mb-3 flex items-center gap-2">
        <div className={cn('grid h-8 w-8 place-items-center rounded-xl', iconClasses)}>
          <Icon className="h-4 w-4" />
        </div>
        <h3 className="text-base font-semibold tracking-normal text-slate-950">{title}</h3>
      </div>
      {children}
    </section>
  );
}
