'use client';

import { useState } from 'react';

import type { ConversationControlledDtoV1 } from '@/modules/institution-conversations/application/conversation-controlled-view';

const stateLabels = Object.freeze({
  ai_handling: 'AI 状态（自动回复仍关闭）',
  awaiting_human: '等待人工',
  human_handling: '人工处理中',
  waiting_customer: '等待客户',
  closed: '已结束',
} as const);

function requestId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return `cw_${Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('')}`;
}

export function ConversationControlledDetailShell({
  record: initialRecord,
}: Readonly<{ record: ConversationControlledDtoV1 }>) {
  const [record, setRecord] = useState(initialRecord);
  const [assigneeUserId, setAssigneeUserId] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function mutate(operation: Record<string, unknown>) {
    if (!record.activeSegment) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(
        `/api/v1/institution/conversations/${encodeURIComponent(record.conversationId)}`,
        {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            expectedConversationRevision: record.conversationRevision,
            expectedSegmentRevision: record.activeSegment.revision,
            expectedAssignmentRevision: record.activeSegment.assignmentRevision,
            requestId: requestId(),
            operation,
          }),
        },
      );
      const payload = await response.json() as {
        kind?: string;
        code?: string;
        record?: ConversationControlledDtoV1;
      };
      if (!response.ok || payload.kind !== 'ready' || !payload.record) {
        setMessage(payload.code ?? '会话状态已变化，请刷新后重试。');
        return;
      }
      setRecord(payload.record);
      setMessage('操作已完成。');
    } catch {
      setMessage('当前无法完成操作，请刷新后重试。');
    } finally {
      setBusy(false);
    }
  }

  const segment = record.activeSegment;

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-8">
      <header className="mb-6">
        <p className="text-sm font-medium text-slate-500">CONVERSATION CONTROLLED WRITE</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-950">会话处置</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          仅开放机构内受控分配、改派、人工接管、解除接管和状态处置。消息发送、消息接收、AI 自动回复与自动触达均保持关闭。
        </p>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">Conversation</dt>
            <dd className="mt-1 break-all text-slate-950">{record.conversationId}</dd>
          </div>
          <div>
            <dt className="text-slate-500">当前状态</dt>
            <dd className="mt-1 text-slate-950">
              {segment ? stateLabels[segment.state] : '无活动会话段'}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">当前处理人</dt>
            <dd className="mt-1 break-all text-slate-950">
              {segment?.currentHandlerId ?? '暂无'}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">当前分配</dt>
            <dd className="mt-1 break-all text-slate-950">
              {segment?.assignment
                ? `${segment.assignment.assigneeUserId} / ${segment.assignment.status}`
                : '暂无'}
            </dd>
          </div>
        </dl>
      </section>

      {segment ? (
        <section className="mt-5 rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-base font-semibold text-slate-950">受控操作</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {record.permissions.canRequestHuman ? (
              <button disabled={busy} onClick={() => mutate({ kind: 'request_human' })} className="rounded-lg border px-3 py-2 text-sm">
                转人工队列
              </button>
            ) : null}
            {record.permissions.canTakeover ? (
              <button disabled={busy} onClick={() => mutate({ kind: 'takeover' })} className="rounded-lg border px-3 py-2 text-sm">
                接管会话
              </button>
            ) : null}
            {record.permissions.canReleaseTakeover ? (
              <button disabled={busy} onClick={() => mutate({ kind: 'release_takeover' })} className="rounded-lg border px-3 py-2 text-sm">
                解除接管
              </button>
            ) : null}
            {record.permissions.canMarkWaitingCustomer ? (
              <button disabled={busy} onClick={() => mutate({ kind: 'waiting_customer' })} className="rounded-lg border px-3 py-2 text-sm">
                标记等待客户
              </button>
            ) : null}
            {record.permissions.canClose ? (
              <button
                disabled={busy}
                onClick={() => mutate({
                  kind: 'close',
                  closeResultCode: segment.resolutionState === 'resolved' ? 'resolved' : 'unresolved',
                })}
                className="rounded-lg border px-3 py-2 text-sm"
              >
                结束会话
              </button>
            ) : null}
          </div>

          {record.permissions.canAssign || record.permissions.canReassign ? (
            <div className="mt-5 flex max-w-xl flex-col gap-2 sm:flex-row">
              <input
                value={assigneeUserId}
                onChange={(event) => setAssigneeUserId(event.target.value.trim())}
                placeholder="当前机构 Membership accountId"
                className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <button
                disabled={busy || assigneeUserId.length === 0}
                onClick={() => mutate({
                  kind: record.permissions.canReassign ? 'reassign' : 'assign',
                  assigneeUserId,
                })}
                className="rounded-lg border px-3 py-2 text-sm"
              >
                {record.permissions.canReassign ? '改派' : '分配'}
              </button>
            </div>
          ) : null}

          {message ? (
            <p role="status" className="mt-4 text-sm text-slate-600">{message}</p>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
