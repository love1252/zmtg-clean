
'use client';

import Link from 'next/link';
import { Bot, CalendarDays, MessageSquareText, Sparkles } from 'lucide-react';
import { useState } from 'react';

import type { CustomerControlledDtoV1 } from '@/modules/customers/application/customer-controlled-view';
import {
  InstitutionV11CapabilityBanner,
  InstitutionV11EmptyState,
  InstitutionV11PageHeader,
  InstitutionV11Surface,
  InstitutionV11Tabs,
} from '@/modules/institution-v11/components/InstitutionV11Ui';

export function CustomerControlledDetailShell({
  record,
}: Readonly<{
  record: CustomerControlledDtoV1;
}>) {
  const [displayName, setDisplayName] = useState(record.displayName);
  const [lifecycle, setLifecycle] = useState(record.lifecycle);
  const [priority, setPriority] = useState(record.priority);
  const [ownerUserId, setOwnerUserId] = useState(record.ownerUserId);
  const [projectInterest, setProjectInterest] = useState(record.projectInterest);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const pageTabs = [
    { id: 'overview', label: '概览' },
    { id: 'profile', label: '客户画像' },
    { id: 'appointments', label: '预约与服务' },
    { id: 'followups', label: '随访记录' },
    { id: 'communications', label: '沟通记录' },
    { id: 'consumption', label: '消费记录' },
  ] as const;

  async function save() {
    setBusy(true);
    setError(null);

    try {
      const changes: Record<string, unknown> = {
        displayName,
        lifecycle,
        priority,
        projectInterest,
      };

      if (record.permissions.canReassignOwner) {
        changes.ownerUserId = ownerUserId;
      }

      const response = await fetch(
        `/api/v1/institution/customers/${encodeURIComponent(record.customerId)}`,
        {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            expectedUpdatedAt: record.updatedAt,
            changes,
          }),
        },
      );

      if (!response.ok) {
        setError('客户更新失败，请刷新后重试');
        return;
      }

      window.location.reload();
    } catch {
      setError('客户更新失败，请稍后重试');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-5" aria-labelledby="customer-detail-title">
      <div id="customer-detail-title">
        <InstitutionV11PageHeader
          eyebrow="CUSTOMER OBJECT"
          title={record.displayName}
          description={`客户对象 · ${record.customerId.slice(-4).padStart(4, '0')} · 更新于 ${record.updatedAt}`}
          breadcrumbs={[{ label: '机构端', href: '/hospital' }, { label: '客户中心', href: '/hospital/customers' }, { label: '客户详情' }]}
          state="LIVE"
          actions={(
            <>
              <Link href="/hospital/conversations" className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700"><MessageSquareText aria-hidden="true" className="h-4 w-4" />进入会话</Link>
              <Link href="/hospital/care/appointments" className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700"><CalendarDays aria-hidden="true" className="h-4 w-4" />查看预约</Link>
            </>
          )}
        />
      </div>

      <InstitutionV11Surface>
        <div className="overflow-x-auto"><InstitutionV11Tabs label="客户详情页面" items={pageTabs} activeId={activeTab} onChange={setActiveTab} /></div>
        <dl className="grid gap-px border-b border-slate-100 bg-slate-100 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ['负责人', record.ownerUserId || '未分配'],
            ['数据来源', '正式 Customer DTO'],
            ['当前阶段', lifecycle],
            ['风险', '无正式风险投影'],
            ['当前主随访方案', '未读取'],
            ['任务状态', '未读取'],
            ['下一随访', '未读取'],
            ['活跃随访数量', '未读取'],
          ].map(([label, value]) => <div key={label} className="bg-white px-4 py-3"><dt className="text-[11px] text-slate-500">{label}</dt><dd className="mt-1 truncate text-xs font-semibold text-slate-800">{value}</dd></div>)}
        </dl>
      </InstitutionV11Surface>

      {activeTab === 'overview' ? <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-slate-950">受控客户资料</h2>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="grid gap-1 text-sm text-slate-700">
            客户展示名
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              maxLength={120}
              className="rounded-xl border border-slate-200 px-3 py-2"
            />
          </label>

          <label className="grid gap-1 text-sm text-slate-700">
            负责人账号 ID
            <input
              value={ownerUserId}
              disabled={!record.permissions.canReassignOwner}
              onChange={(event) => setOwnerUserId(event.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2 disabled:bg-slate-50"
            />
          </label>

          <label className="grid gap-1 text-sm text-slate-700">
            生命周期
            <select
              value={lifecycle}
              onChange={(event) => setLifecycle(event.target.value as typeof lifecycle)}
              className="rounded-xl border border-slate-200 px-3 py-2"
            >
              <option value="consulting">咨询中</option>
              <option value="scheduled">已预约</option>
              <option value="post_care">术后关怀</option>
              <option value="repurchase_window">复购窗口</option>
              <option value="silent_reactivation">沉默唤醒</option>
            </select>
          </label>

          <label className="grid gap-1 text-sm text-slate-700">
            优先级
            <select
              value={priority}
              onChange={(event) => setPriority(event.target.value as typeof priority)}
              className="rounded-xl border border-slate-200 px-3 py-2"
            >
              <option value="high">高优先级</option>
              <option value="medium">中优先级</option>
              <option value="observe">持续观察</option>
            </select>
          </label>

          <label className="grid gap-1 text-sm text-slate-700 md:col-span-2">
            项目意向
            <input
              value={projectInterest}
              onChange={(event) => setProjectInterest(event.target.value)}
              maxLength={120}
              className="rounded-xl border border-slate-200 px-3 py-2"
            />
          </label>
        </div>

        {error ? (
          <p role="alert" className="mt-3 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || !record.permissions.canUpdate}
            onClick={() => void save()}
            className="rounded-xl bg-cyan-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? '保存中…' : '保存修改'}
          </button>
          <Link
            href="/hospital/customers"
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
          >
            返回客户列表
          </Link>
        </div>
      </div> : activeTab === 'profile' ? (
        <div className="space-y-4">
          <InstitutionV11CapabilityBanner title="AI 能力与 Evidence 契约未开放" description="客户事实、AI 推断和经营建议严格分区；当前不生成画像、套餐或经营建议。" state="CAPABILITY_OFF" source="Customer Canonical Owner / AI Evidence" />
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {[
              { title: '画像概览', Icon: Bot, description: 'AI Provider 未配置' },
              { title: '沟通洞察', Icon: MessageSquareText, description: '会话 Evidence 未开放' },
              { title: '经营建议', Icon: Sparkles, description: '策略模型未开放' },
              { title: '套餐建议', Icon: Sparkles, description: '消费与套餐事实未开放' },
              { title: '证据来源', Icon: Bot, description: 'Evidence 契约未开放' },
            ].map(({ title, Icon, description }) => (
              <InstitutionV11Surface key={title} title={title}><InstitutionV11EmptyState icon={Icon} title={description} description="页面结构已还原，不会使用演示内容冒充正式能力。" /></InstitutionV11Surface>
            ))}
          </div>
        </div>
      ) : (
        <InstitutionV11Surface>
          <InstitutionV11EmptyState
            icon={activeTab === 'appointments' ? CalendarDays : activeTab === 'communications' ? MessageSquareText : Sparkles}
            title={`${pageTabs.find((tab) => tab.id === activeTab)?.label ?? '对象事实'}未开放`}
            description="需要当前客户对象的正式 Reader、tenant + institution 隔离与对象权限；不会从其他页面状态推断业务事实。"
          />
        </InstitutionV11Surface>
      )}
    </section>
  );
}
