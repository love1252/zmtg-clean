'use client';

import Link from 'next/link';
import { Bot, MessageSquareText, MonitorSmartphone, Search, ShieldCheck, UserRoundCog, UsersRound, WifiOff } from 'lucide-react';

import type { ConversationQueueV1 } from '../application/conversation-queue-reader';
import {
  InstitutionV11Button,
  InstitutionV11EmptyState,
  InstitutionV11PageHeader,
} from '@/modules/institution-v11/components/InstitutionV11Ui';

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
  actionableConversationIds = [],
}: Readonly<{
  queue: ConversationQueueV1;
  actionableConversationIds?: readonly string[];
}>) {
  const actionable = new Set(actionableConversationIds);

  return (
    <section className="space-y-4" aria-label="会话工作台">
      <InstitutionV11PageHeader
        eyebrow="CONVERSATION WORKBENCH"
        title="会话队列"
        description="展示正式机构作用域内的低敏会话队列；消息发送、消息入站、AI 自动回复和自动触达均保持关闭。"
        breadcrumbs={[{ label: '机构端', href: '/hospital' }, { label: '会话工作台' }, { label: '会话队列' }]}
        state="LIVE"
        actions={<InstitutionV11Button icon={UserRoundCog} disabled disabledReason="请先打开具有对象权限的会话">人工接管</InstitutionV11Button>}
      />

      <section className="grid min-h-[610px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm xl:grid-cols-[170px_310px_minmax(390px,1fr)_280px]">
        <aside className="border-b border-slate-800 bg-slate-950 p-3 text-slate-200 xl:border-b-0 xl:border-r">
          <div className="flex items-center justify-between px-2 py-2"><h2 className="text-sm font-semibold text-white">微信账号</h2><span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] text-amber-200">未配置</span></div>
          <div className="mt-2 space-y-1">
            <div className="rounded-lg bg-white/[0.06] px-2 py-2.5"><span className="flex items-center gap-2 text-xs font-medium"><MonitorSmartphone aria-hidden="true" className="h-4 w-4 text-slate-400" />全部账号</span><span className="mt-1 block pl-6 text-[10px] text-slate-500">在线与未读数未知</span></div>
            <div className="rounded-lg px-2 py-2.5"><span className="flex items-center gap-2 text-xs font-medium"><WifiOff aria-hidden="true" className="h-4 w-4 text-slate-400" />个人微信</span><span className="mt-1 block pl-6 text-[10px] text-slate-500">供应商 Connector 未配置</span></div>
            <div className="rounded-lg px-2 py-2.5"><span className="flex items-center gap-2 text-xs font-medium"><ShieldCheck aria-hidden="true" className="h-4 w-4 text-slate-400" />企业微信</span><span className="mt-1 block pl-6 text-[10px] text-slate-500">正式授权未完成</span></div>
          </div>
        </aside>

        <aside className="min-h-0 border-b border-slate-200 xl:border-b-0 xl:border-r">
          <div className="border-b border-slate-100 p-3">
            <div className="relative"><Search aria-hidden="true" className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input disabled placeholder="搜索会话" className="h-9 w-full rounded-lg border border-slate-200 bg-slate-100 pl-9 pr-3 text-sm" /></div>
            <div className="mt-2 flex gap-1">{['全部', 'AI', '待接管', '人工'].map((label, index) => <span key={label} className={`rounded-full px-2.5 py-1 text-[11px] ${index === 0 ? 'bg-blue-50 font-semibold text-blue-700' : 'text-slate-500'}`}>{label}</span>)}</div>
          </div>
          {queue.dataState === 'empty' ? (
            <div data-testid="conversation-queue-empty"><InstitutionV11EmptyState icon={MessageSquareText} title="暂无正式会话事实" description="当前机构的正式 Conversation source、conversation 与 segment 均为空；不会使用 AiConversation、fixture、dry-run、mock_sent 或企业微信 proof 补成会话记录。" /></div>
          ) : (
            <div aria-label="正式会话队列" className="max-h-[530px] overflow-y-auto">
              {queue.records.map((item) => (
                <article key={item.conversationId} className="border-b border-slate-100 p-3 hover:bg-slate-50">
                  <div className="flex items-start justify-between gap-2"><p className="min-w-0 truncate text-xs font-semibold text-slate-900">{item.conversationId}</p><span className="shrink-0 rounded-full border border-slate-200 px-2 py-0.5 text-[10px] text-slate-600">{identityLabels[item.identityState]}</span></div>
                  <p className="mt-1 text-[11px] text-slate-500">{item.channelType} · {item.activeSegmentState ? segmentLabels[item.activeSegmentState] : '无活动会话段'}</p>
                  <p className="mt-1 text-[10px] text-slate-400">更新 {formatInstant(item.updatedAt)}</p>
                  {actionable.has(item.conversationId) ? <Link href={`/hospital/conversations/${encodeURIComponent(item.conversationId)}`} className="mt-2 inline-flex text-xs font-semibold text-blue-700">打开会话处置</Link> : null}
                </article>
              ))}
              {queue.pageInfo.hasMore ? <p className="p-3 text-[11px] text-slate-500">当前切片最多展示前 {queue.pageInfo.pageSize} 条正式记录。</p> : null}
            </div>
          )}
        </aside>

        <div className="flex min-h-[480px] flex-col border-b border-slate-200 xl:border-b-0 xl:border-r">
          <header className="flex h-14 items-center justify-between border-b border-slate-100 px-4"><div><h2 className="text-sm font-semibold text-slate-900">当前聊天</h2><p className="text-[11px] text-slate-500">打开会话对象后查看正式处置状态</p></div><Bot aria-hidden="true" className="h-4 w-4 text-violet-500" /></header>
          <div className="grid flex-1 place-items-center bg-slate-50/60"><InstitutionV11EmptyState icon={MessageSquareText} title="未选择会话对象" description="聊天正文 Reader 未在队列页开放；不会预读消息载荷。" /></div>
          <footer className="border-t border-slate-200 p-3"><div className="flex gap-2"><textarea disabled aria-label="消息输入" placeholder="真实消息发送未开放" className="min-h-16 flex-1 resize-none rounded-lg border border-slate-200 bg-slate-100 p-3 text-sm" /><InstitutionV11Button tone="primary" disabled disabledReason="MessageDelivery 未开放">发送</InstitutionV11Button></div></footer>
        </div>

        <aside><div className="flex border-b border-slate-100 px-2">{['档案', 'AI', '预约', '随访'].map((label, index) => <span key={label} className={`px-2 py-3 text-xs ${index === 0 ? 'border-b-2 border-blue-600 font-semibold text-blue-700' : 'text-slate-500'}`}>{label}</span>)}</div><InstitutionV11EmptyState icon={UsersRound} title="客户上下文未读取" description="需要会话对象与客户对象双重服务端授权。" /></aside>
      </section>
    </section>
  );
}
