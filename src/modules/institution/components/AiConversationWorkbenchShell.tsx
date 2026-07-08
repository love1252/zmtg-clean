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
  filterAiConversations,
  getAiConversationWorkbenchFixture,
  mockSendAiConversationMessage,
  takeoverAiConversation,
  applyAiConversationRecommendation,
  type AiConversationFilter,
  type AiConversationRecord,
} from '@/modules/institution/domain/ai-conversation-workbench';
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
              参考补充截图与客服中心材料，模拟账号列、会话列表、聊天窗口、AI 推荐回复、风险预警、推荐项目、用户画像、人工接管、发送前确认、消息发送记录、时间线 / 审计 / 看板低敏沉淀。
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
                placeholder="点击一键使用推荐回复后生成草稿；发送前必须人工确认。"
              />
            </label>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs font-semibold text-slate-500">
                当前不接真实企业微信 / 微信；不真实发送；高风险内容会提示或阻断。
              </div>
              <button
                type="button"
                onClick={handleMockSend}
                disabled={!draft.trim() || activeConversation.status === 'closed'}
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
            <AiPanel conversation={activeConversation} onUseRecommendation={handleUseRecommendation} />
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
}: {
  conversation: AiConversationRecord;
  onUseRecommendation: (recommendationId: string) => void;
}) {
  return (
    <div className="mt-4 space-y-4">
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
          {conversation.timeline.map((event) => (
            <article key={event.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
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
