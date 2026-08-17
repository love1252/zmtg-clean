import type { ConversationQueueV1 } from '../application/conversation-queue-reader';

const identityLabels = Object.freeze({
  matched: '已匹配客户',
  pending_review: '待身份复核',
  unmatched: '未匹配',
  conflict: '身份冲突',
} as const);

const segmentLabels = Object.freeze({
  ai_handling: 'AI 处理中',
  awaiting_human: '等待人工',
  human_handling: '人工处理中',
  waiting_customer: '等待客户',
  closed: '已结束',
} as const);

function formatInstant(value: string | null): string {
  if (!value) return '暂无';
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Asia/Shanghai',
    }).format(new Date(value));
  } catch {
    return '时间不可用';
  }
}

export function ConversationQueueReadonlyShell({
  queue,
}: Readonly<{ queue: ConversationQueueV1 }>) {
  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-8">
      <header className="mb-6">
        <p className="text-sm font-medium text-slate-500">CONVERSATIONS</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-950">会话队列</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          当前页面仅展示正式机构作用域内的会话队列摘要。发送、接管、改派、结束、AI 接待和自动触达均未开放。
        </p>
      </header>

      {queue.dataState === 'empty' ? (
        <section
          data-testid="conversation-queue-empty"
          className="rounded-xl border border-slate-200 bg-white p-6"
        >
          <h2 className="text-base font-semibold text-slate-900">暂无正式会话事实</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            当前机构的正式 Conversation source、conversation 与 segment 均为空；不会使用 AiConversation、fixture、dry-run、mock_sent 或企业微信 proof 补成会话记录。
          </p>
        </section>
      ) : (
        <section aria-label="正式会话队列" className="space-y-3">
          {queue.records.map((item) => (
            <article
              key={item.conversationId}
              className="rounded-xl border border-slate-200 bg-white p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-950">
                    {item.conversationId}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    渠道：{item.channelType}
                  </p>
                </div>
                <span className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-700">
                  {identityLabels[item.identityState]}
                </span>
              </div>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-slate-500">当前阶段</dt>
                  <dd className="mt-1 text-slate-900">
                    {item.activeSegmentState
                      ? segmentLabels[item.activeSegmentState]
                      : '无活动会话段'}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">最近客户消息</dt>
                  <dd className="mt-1 text-slate-900">
                    {formatInstant(item.latestCustomerInboundAt)}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">最近更新</dt>
                  <dd className="mt-1 text-slate-900">
                    {formatInstant(item.updatedAt)}
                  </dd>
                </div>
              </dl>
            </article>
          ))}
          {queue.pageInfo.hasMore ? (
            <p className="text-xs text-slate-500">
              当前只读切片最多展示前 {queue.pageInfo.pageSize} 条正式会话记录。
            </p>
          ) : null}
        </section>
      )}
    </main>
  );
}
