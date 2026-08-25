'use client';

import Link from 'next/link';
import { CalendarClock, Plus } from 'lucide-react';
import { useRef, useState } from 'react';

import type { FormalFollowUpDtoV1 } from '@/modules/care/application/formal-follow-up-view';
import {
  InstitutionV11PageHeader,
  InstitutionV11Surface,
} from '@/modules/institution-v11/components/InstitutionV11Ui';

type Props = Readonly<{
  records: readonly FormalFollowUpDtoV1[];
  canCreate: boolean;
  selectedTaskId?: string | null;
}>;

async function patchTask(
  taskId: string,
  body: unknown,
) {
  const response = await fetch(
    `/api/v1/institution/followups/${encodeURIComponent(taskId)}`,
    {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  );

  if (!response.ok) {
    throw new Error(
      'follow_up_mutation_failed',
    );
  }
}

export function CareFollowUpControlledShell({
  records,
  canCreate,
  selectedTaskId = null,
}: Props) {
  const [
    error,
    setError,
  ] = useState<string | null>(null);
  const idempotencyKeyRef =
    useRef<string | null>(null);

  const selected =
    selectedTaskId === null
      ? null
      : records.find(
          (record) =>
            record.taskId === selectedTaskId,
        ) ?? null;
  const visibleRecords =
    selected ? [selected] : records;

  async function createTask(
    formData: FormData,
  ) {
    setError(null);

    try {
      if (
        idempotencyKeyRef.current === null
      ) {
        idempotencyKeyRef.current =
          `manual-${crypto.randomUUID()}`;
      }

      const assignmentKind = String(
        formData.get('assignmentKind')
          ?? 'role_pool',
      );
      const assignment =
        assignmentKind === 'user'
          ? {
              kind: 'user',
              userId: String(
                formData.get('userId')
                  ?? '',
              ),
            }
          : {
              kind: 'role_pool',
              role: String(
                formData.get('role')
                  ?? 'customer_service',
              ),
            };
      const dueAtLocal = String(formData.get('dueAt') ?? '');
      const dueAt = new Date(`${dueAtLocal}:00+08:00`).toISOString();

      const response = await fetch(
        '/api/v1/institution/followups',
        {
          method: 'POST',
          headers: {
            'content-type':
              'application/json',
          },
          body: JSON.stringify({
            idempotencyKey:
              idempotencyKeyRef.current,
            customerId: String(
              formData.get('customerId')
                ?? '',
            ),
            stageCode:
              'manual_followup',
            actionCode:
              'manual_contact',
            dueAt,
            assignment,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(
          'follow_up_create_failed',
        );
      }

      window.location.reload();
    } catch {
      setError(
        '创建随访任务失败，请检查客户、UTC 计划时间、分配对象与当前权限。',
      );
    }
  }

  async function run(
    taskId: string,
    body: unknown,
  ) {
    setError(null);

    try {
      await patchTask(taskId, body);
      window.location.reload();
    } catch {
      setError(
        '随访操作未完成，可能已由其他操作更新，请刷新后重试。',
      );
    }
  }

  async function reassignTask(
    taskId: string,
    expectedRevision: number,
    formData: FormData,
  ) {
    const targetKind = String(
      formData.get('targetKind')
        ?? 'role_pool',
    );
    const target =
      targetKind === 'user'
        ? {
            kind: 'user',
            userId: String(
              formData.get('targetUserId')
                ?? '',
            ),
          }
        : {
            kind: 'role_pool',
            role: String(
              formData.get('targetRole')
                ?? 'customer_service',
            ),
          };

    await run(taskId, {
      command: 'reassign',
      expectedRevision,
      target,
      reason: 'workload_rebalance',
    });
  }

  return (
    <main className="space-y-5">
      <h1 className="sr-only">人工随访任务</h1>
      <InstitutionV11PageHeader
        eyebrow="FOLLOW-UP MANAGEMENT"
        title="随访管理"
        description="正式机构范围内的人工联系任务支持受控创建、认领、改派、状态流转、结构化完成与风险升级；真实消息发送和 HIS 操作仍关闭。"
        breadcrumbs={[{ label: '机构端', href: '/hospital' }, { label: '预约与随访' }, { label: '随访管理' }]}
        state="LIVE"
        actions={canCreate && selectedTaskId === null ? <a href="#followup-create" className="inline-flex h-9 items-center gap-2 rounded-lg border border-blue-700 bg-blue-700 px-3 text-sm font-semibold text-white"><Plus aria-hidden="true" className="h-4 w-4" />新建随访</a> : null}
      />

      <InstitutionV11Surface>
        <div className="flex flex-wrap items-center gap-1 border-b border-slate-100 px-3 py-2">
          {['待执行', '进行中', '待人工', '已完成', '异常'].map((label, index) => <span key={label} className={`rounded-full px-3 py-1.5 text-xs ${index === 0 ? 'bg-blue-50 font-semibold text-blue-700' : 'text-slate-500'}`}>{label}</span>)}
          <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] text-slate-500"><CalendarClock aria-hidden="true" className="h-3.5 w-3.5" />任务状态与消息状态分离</span>
        </div>
        <div className="grid gap-px bg-slate-100 sm:grid-cols-4">
          {['任务状态：正式', '消息状态：未发送', '渠道匹配：按任务事实', '风险：按正式事件'].map((label) => <div key={label} className="bg-white px-4 py-3 text-xs text-slate-600">{label}</div>)}
        </div>
      </InstitutionV11Surface>

      {error ? (
        <div
          role="alert"
          className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"
        >
          {error}
        </div>
      ) : null}

      {canCreate
      && selectedTaskId === null ? (
        <form
          id="followup-create"
          action={(formData) =>
            void createTask(formData)
          }
          className="grid gap-3 rounded-3xl border border-slate-200 bg-white p-5 md:grid-cols-2"
        >
          <h2 className="text-lg font-semibold md:col-span-2">
            新建人工联系任务
          </h2>

          <input
            required
            name="customerId"
            placeholder="客户 ID"
            className="rounded-xl border p-3"
          />

          <label className="grid gap-1.5 text-xs text-slate-600">
            计划时间（机构时区 Asia/Shanghai）
          <input
            required
            name="dueAt"
            type="datetime-local"
            className="rounded-xl border p-3"
          />
          </label>

          <select
            name="assignmentKind"
            className="rounded-xl border p-3"
            defaultValue="role_pool"
          >
            <option value="role_pool">
              角色池
            </option>
            <option value="user">
              指定员工
            </option>
          </select>

          <select
            name="role"
            className="rounded-xl border p-3"
            defaultValue="customer_service"
          >
            <option value="customer_service">
              客服角色池
            </option>
            <option value="consultant">
              咨询师角色池
            </option>
            <option value="tenant_operator">
              运营角色池
            </option>
            <option value="tenant_admin">
              管理员角色池
            </option>
          </select>

          <input
            name="userId"
            placeholder="指定员工 userId（选择指定员工时填写）"
            className="rounded-xl border p-3 md:col-span-2"
          />

          <p className="text-xs leading-5 text-slate-500 md:col-span-2">
            首个 Controlled Write 只接受受控阶段
            manual_followup 与受控动作
            manual_contact，不接受自由动作文本。
          </p>

          <button className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white md:col-span-2">
            创建任务
          </button>
        </form>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-2">
        {visibleRecords.map((record) => (
          <article
            key={record.taskId}
            className="rounded-3xl border border-slate-200 bg-white p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-slate-950">
                  {record.customer.displayName}
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  {record.stageCode}
                  {' · '}
                  {record.actionCode}
                </p>
              </div>

              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                {record.state}
              </span>
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-slate-500">
                  计划时间
                </dt>
                <dd>{record.dueAt}</dd>
              </div>
              <div>
                <dt className="text-slate-500">
                  版本
                </dt>
                <dd>v{record.revision}</dd>
              </div>
              <div>
                <dt className="text-slate-500">
                  分配
                </dt>
                <dd>
                  {record.assignment.kind
                    === 'role_pool'
                    ? record.assignment.role
                    : record.assignment.displayName}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">
                  风险
                </dt>
                <dd>{record.riskLevel}</dd>
              </div>
            </dl>

            <div className="mt-5 flex flex-wrap gap-2">
              {record.permissions.canClaim ? (
                <button
                  type="button"
                  onClick={() =>
                    void run(
                      record.taskId,
                      {
                        command: 'claim',
                        expectedRevision:
                          record.revision,
                      },
                    )
                  }
                  className="rounded-lg border px-3 py-2 text-sm"
                >
                  认领
                </button>
              ) : null}

              {record.permissions.canOperate
              && record.state === 'pending' ? (
                <button
                  type="button"
                  onClick={() =>
                    void run(
                      record.taskId,
                      {
                        command:
                          'transition',
                        expectedRevision:
                          record.revision,
                        targetState:
                          'in_progress',
                      },
                    )
                  }
                  className="rounded-lg border px-3 py-2 text-sm"
                >
                  开始处理
                </button>
              ) : null}

              {record.permissions.canOperate
              && record.state
                === 'in_progress' ? (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      void run(
                        record.taskId,
                        {
                          command:
                            'transition',
                          expectedRevision:
                            record.revision,
                          targetState:
                            'waiting_customer',
                        },
                      )
                    }
                    className="rounded-lg border px-3 py-2 text-sm"
                  >
                    等待客户
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      void run(
                        record.taskId,
                        {
                          command:
                            'complete',
                          expectedRevision:
                            record.revision,
                          code:
                            'contact_completed',
                          feedback: null,
                        },
                      )
                    }
                    className="rounded-lg border px-3 py-2 text-sm"
                  >
                    结构化完成
                  </button>
                </>
              ) : null}

              {record.permissions.canOperate
              && record.state
                === 'waiting_customer' ? (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      void run(
                        record.taskId,
                        {
                          command:
                            'transition',
                          expectedRevision:
                            record.revision,
                          targetState:
                            'in_progress',
                        },
                      )
                    }
                    className="rounded-lg border px-3 py-2 text-sm"
                  >
                    恢复处理
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      void run(
                        record.taskId,
                        {
                          command:
                            'complete',
                          expectedRevision:
                            record.revision,
                          code:
                            'no_response_closed',
                          feedback: null,
                        },
                      )
                    }
                    className="rounded-lg border px-3 py-2 text-sm"
                  >
                    无响应关闭
                  </button>
                </>
              ) : null}

              {record.permissions.canOperate
              && ![
                'completed',
                'cancelled',
                'escalated',
              ].includes(record.state) ? (
                <button
                  type="button"
                  onClick={() =>
                    void run(
                      record.taskId,
                      {
                        command:
                          'escalate',
                        expectedRevision:
                          record.revision,
                        kind: 'complaint',
                      },
                    )
                  }
                  className="rounded-lg border border-amber-300 px-3 py-2 text-sm text-amber-800"
                >
                  风险升级
                </button>
              ) : null}

              {record.permissions.canCancel
              && ![
                'completed',
                'cancelled',
                'escalated',
              ].includes(record.state) ? (
                <button
                  type="button"
                  onClick={() =>
                    void run(
                      record.taskId,
                      {
                        command: 'cancel',
                        expectedRevision:
                          record.revision,
                        reason:
                          'created_in_error',
                      },
                    )
                  }
                  className="rounded-lg border border-rose-200 px-3 py-2 text-sm text-rose-700"
                >
                  取消
                </button>
              ) : null}

              {record.permissions.canUnclaim ? (
                <button
                  type="button"
                  onClick={() =>
                    void run(
                      record.taskId,
                      {
                        command: 'unclaim',
                        expectedRevision:
                          record.revision,
                        reason:
                          'workload_rebalance',
                      },
                    )
                  }
                  className="rounded-lg border px-3 py-2 text-sm"
                >
                  撤销认领
                </button>
              ) : null}

              {selectedTaskId === null ? (
                <Link
                  href={
                    `/hospital/care/followups/${encodeURIComponent(record.taskId)}`
                  }
                  className="rounded-lg border px-3 py-2 text-sm"
                >
                  详情
                </Link>
              ) : (
                <Link
                  href="/hospital/care/followups"
                  className="rounded-lg border px-3 py-2 text-sm"
                >
                  返回列表
                </Link>
              )}
            </div>

            {record.permissions.canReassign ? (
              <form
                action={(formData) =>
                  void reassignTask(
                    record.taskId,
                    record.revision,
                    formData,
                  )
                }
                className="mt-4 grid gap-2 rounded-2xl bg-slate-50 p-3 md:grid-cols-2"
              >
                <select
                  name="targetKind"
                  defaultValue="role_pool"
                  className="rounded-lg border bg-white p-2 text-sm"
                >
                  <option value="role_pool">
                    改派角色池
                  </option>
                  <option value="user">
                    改派指定员工
                  </option>
                </select>

                <select
                  name="targetRole"
                  defaultValue="customer_service"
                  className="rounded-lg border bg-white p-2 text-sm"
                >
                  <option value="customer_service">
                    客服角色池
                  </option>
                  <option value="consultant">
                    咨询师角色池
                  </option>
                  <option value="tenant_operator">
                    运营角色池
                  </option>
                  <option value="tenant_admin">
                    管理员角色池
                  </option>
                </select>

                <input
                  name="targetUserId"
                  placeholder="指定员工 userId"
                  className="rounded-lg border bg-white p-2 text-sm md:col-span-2"
                />

                <button className="rounded-lg border bg-white px-3 py-2 text-sm md:col-span-2">
                  执行改派
                </button>
              </form>
            ) : null}
          </article>
        ))}
      </section>

      {visibleRecords.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          当前正式机构范围内暂无人工随访任务。
        </div>
      ) : null}
    </main>
  );
}
