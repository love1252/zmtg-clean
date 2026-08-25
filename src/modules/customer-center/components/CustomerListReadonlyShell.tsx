'use client';

import Link from 'next/link';
import { ChevronRight, Filter, Import, Plus, Search, SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';

import { CUSTOMER_LIST_MAX_PAGE_V1 } from '@/modules/customer-center/application/customer-list-pagination-contract';
import type { CustomerListReaderResultV1 } from '@/modules/customer-center/application/customer-list-reader';
import type {
  CustomerListLifecycleV1,
  CustomerListPriorityV1,
} from '@/modules/customer-center/ports/customer-list-source';
import {
  InstitutionV11Button,
  InstitutionV11Drawer,
  InstitutionV11PageHeader,
} from '@/modules/institution-v11/components/InstitutionV11Ui';

type CustomerListReadyResultV1 = Extract<
  CustomerListReaderResultV1,
  { kind: 'ready' }
>;

const lifecycleLabels = Object.freeze({
  consulting: '咨询中',
  scheduled: '已预约',
  post_care: '术后关怀',
  repurchase_window: '复购窗口',
  silent_reactivation: '沉默唤醒',
} as const);

const priorityLabels = Object.freeze({
  high: '高优先级',
  medium: '中优先级',
  observe: '持续观察',
} as const);

function pageHref(
  page: number,
  lifecycle: CustomerListLifecycleV1 | null,
  priority: CustomerListPriorityV1 | null,
) {
  const params = new URLSearchParams({ page: String(page) });
  if (lifecycle) params.set('lifecycle', lifecycle);
  if (priority) params.set('priority', priority);
  return `/hospital/customers?${params.toString()}`;
}

export function CustomerListReadonlyShell({
  lifecycle,
  priority,
  result,
  operational,
}: Readonly<{
  lifecycle: CustomerListLifecycleV1 | null;
  priority: CustomerListPriorityV1 | null;
  result: CustomerListReadyResultV1;
  operational: boolean;
}>) {
  const [drawer, setDrawer] = useState<'filter' | 'import' | null>(null);
  const [importStep, setImportStep] = useState(0);
  const importSteps = ['下载模板', '上传文件', '字段映射', '数据校验', '重复处理', '完成导入'] as const;

  return (
    <section className="space-y-5" aria-labelledby="customer-list-title">
      <div id="customer-list-title">
        <span className="sr-only">{operational ? 'CONTROLLED WRITE' : 'READ ONLY'}</span>
        <InstitutionV11PageHeader
          eyebrow="CUSTOMER CENTER"
          title="客户列表"
          description={operational
            ? `当前页展示 ${result.records.length} 条低敏客户记录；受控操作仍由服务端重新校验。`
            : `当前页展示 ${result.records.length} 条低敏客户记录，仅供查看。`}
          breadcrumbs={[{ label: '机构端', href: '/hospital' }, { label: '客户中心' }, { label: '客户列表' }]}
          state={operational ? 'LIVE' : 'READ_ONLY'}
          actions={(
            <>
              <InstitutionV11Button icon={Import} onClick={() => setDrawer('import')}>Excel 导入</InstitutionV11Button>
              <InstitutionV11Button icon={Plus} tone="primary" disabled={!operational} disabledReason="当前仅正式只读">人工新增</InstitutionV11Button>
            </>
          )}
        />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <div className="relative min-w-[240px] flex-1 xl:max-w-sm">
              <Search aria-hidden="true" className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input disabled aria-label="搜索客户" placeholder="关键词查询尚未进入正式 Reader" className="h-9 w-full rounded-lg border border-slate-200 bg-slate-100 pl-9 pr-3 text-sm placeholder:text-slate-400" />
            </div>
            <Link href="/hospital/customers" className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">全部</Link>
            <Link href="/hospital/customers?lifecycle=consulting&page=1" className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600">咨询中</Link>
            <Link href="/hospital/customers?priority=high&page=1" className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600">高优先级</Link>
          </div>
          <div className="flex flex-wrap gap-2">
            <InstitutionV11Button icon={Filter} onClick={() => setDrawer('filter')}>高级筛选</InstitutionV11Button>
            <InstitutionV11Button icon={SlidersHorizontal} disabled disabledReason="列偏好 Writer 未开放">列设置</InstitutionV11Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 text-xs">
          <span className="font-medium text-slate-500">当前筛选：</span>
          {lifecycle ? <span className="rounded-full bg-blue-50 px-2.5 py-1 text-blue-700">生命周期：{lifecycleLabels[lifecycle]}</span> : null}
          {priority ? <span className="rounded-full bg-blue-50 px-2.5 py-1 text-blue-700">优先级：{priorityLabels[priority]}</span> : null}
          {!lifecycle && !priority ? <span className="text-slate-400">正式机构范围内全部记录</span> : null}
        </div>
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex min-h-11 items-center justify-between border-b border-slate-200 px-4">
          <div className="flex items-center gap-5 text-xs">
            <span className="border-b-2 border-blue-600 py-3 font-semibold text-blue-700">全部客户</span>
            <span className="py-3 text-slate-500">我负责的</span>
            <span className="py-3 text-slate-500">近期活跃</span>
            <span className="py-3 text-slate-500">待跟进</span>
          </div>
          <span className="text-[11px] text-slate-400">共 {result.records.length} 条当前页记录</span>
        </div>
        {result.records.length === 0 ? (
          <div className="border border-dashed border-transparent px-6 py-14 text-center text-sm text-slate-500">
            当前页暂无客户记录
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left" aria-label={operational ? '客户记录' : '客户只读记录'}>
              <thead className="bg-slate-50/80 text-[11px] font-medium text-slate-500">
                <tr>
                  <th className="w-12 px-4 py-3"><span className="sr-only">选择</span><span aria-hidden="true" className="block h-3.5 w-3.5 rounded border border-slate-300 bg-white" /></th>
                  <th className="px-3 py-3">客户</th>
                  <th className="px-3 py-3">客户阶段</th>
                  <th className="px-3 py-3">优先级</th>
                  <th className="px-3 py-3">最近更新</th>
                  <th className="w-32 px-4 py-3 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {result.records.map((record) => (
                  <tr key={record.customerId} className="group transition-colors hover:bg-blue-50/30">
                    <td className="px-4 py-3"><span aria-hidden="true" className="block h-3.5 w-3.5 rounded border border-slate-300 bg-white" /></td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-3">
                        <span aria-hidden="true" className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-blue-50 text-xs font-semibold text-blue-700">{record.displayName.slice(0, 1)}</span>
                        <div className="min-w-0"><p className="truncate font-semibold text-slate-900">{record.displayName}</p><p className="mt-0.5 text-[11px] text-slate-400">正式客户投影</p></div>
                      </div>
                    </td>
                    <td className="px-3 py-3"><span className="rounded-full bg-cyan-50 px-2 py-1 text-xs font-medium text-cyan-700">{lifecycleLabels[record.lifecycle]}</span></td>
                    <td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-xs font-medium ${record.priority === 'high' ? 'bg-red-50 text-red-700' : record.priority === 'medium' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{priorityLabels[record.priority]}</span></td>
                    <td className="px-3 py-3"><time className="text-xs text-slate-500" dateTime={record.updatedAt}>更新于 {record.updatedAt}</time></td>
                    <td className="px-4 py-3 text-right">
                      {operational ? (
                        <Link href={`/hospital/customers/${encodeURIComponent(record.customerId)}`} className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-800">查看 / 操作<ChevronRight aria-hidden="true" className="h-3.5 w-3.5" /></Link>
                      ) : <span className="text-xs text-slate-400">仅查看</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <nav aria-label="客户列表分页" className="flex items-center justify-between gap-3">
        {result.pageInfo.page > 1 ? (
          <Link
            href={pageHref(
              result.pageInfo.page - 1,
              lifecycle,
              priority,
            )}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
          >
            上一页
          </Link>
        ) : (
          <span />
        )}
        <span className="text-sm text-slate-500">第 {result.pageInfo.page} 页</span>
        {result.pageInfo.hasMore &&
        result.pageInfo.page < CUSTOMER_LIST_MAX_PAGE_V1 ? (
          <Link
            href={pageHref(
              result.pageInfo.page + 1,
              lifecycle,
              priority,
            )}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
          >
            下一页
          </Link>
        ) : (
          <span />
        )}
      </nav>

      <InstitutionV11Drawer
        open={drawer === 'filter'}
        onClose={() => setDrawer(null)}
        title="高级筛选"
        description="正式 Reader 当前仅接受生命周期与优先级条件；其他分组保持禁用。"
        footer={<div className="flex justify-end gap-2"><InstitutionV11Button onClick={() => setDrawer(null)}>重置</InstitutionV11Button><InstitutionV11Button tone="primary" onClick={() => setDrawer(null)}>查询</InstitutionV11Button></div>}
      >
        <div className="space-y-3">
          <section className="rounded-xl border border-slate-200 p-4"><h3 className="text-sm font-semibold text-slate-900">基础资料</h3><p className="mt-2 text-xs text-slate-500">关键词、联系方式与来源筛选当前不支持。</p></section>
          <section className="rounded-xl border border-blue-200 bg-blue-50/50 p-4">
            <h3 className="text-sm font-semibold text-slate-900">客户阶段</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1.5 text-xs text-slate-600">生命周期<select defaultValue={lifecycle ?? ''} className="h-9 rounded-lg border border-slate-200 bg-white px-3"><option value="">全部</option>{Object.entries(lifecycleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label className="grid gap-1.5 text-xs text-slate-600">优先级<select defaultValue={priority ?? ''} className="h-9 rounded-lg border border-slate-200 bg-white px-3"><option value="">全部</option>{Object.entries(priorityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            </div>
            <p className="mt-3 text-[11px] leading-5 text-slate-500">查询仍会经过当前服务端 URL 解析与白名单校验。</p>
          </section>
          {['客户归属', '数据来源与质量', '预约与治疗', '消费与套餐', '随访状态', '沟通与渠道', 'AI 与经营机会'].map((group) => (
            <section key={group} className="rounded-xl border border-slate-200 bg-slate-50 p-4"><h3 className="text-sm font-semibold text-slate-700">{group}</h3><p className="mt-1 text-xs text-slate-400">当前 Reader 没有对应字段，不执行客户端筛选。</p></section>
          ))}
        </div>
      </InstitutionV11Drawer>

      <InstitutionV11Drawer
        open={drawer === 'import'}
        onClose={() => setDrawer(null)}
        title="Excel 导入"
        description="六步流程已还原；正式 Import / Validation / Mapping Writer 未开放。"
        footer={<div className="flex items-center justify-between"><InstitutionV11Button onClick={() => setImportStep((step) => Math.max(0, step - 1))}>上一步</InstitutionV11Button><span className="text-xs text-slate-500">{importStep + 1} / 6</span><InstitutionV11Button tone="primary" onClick={() => setImportStep((step) => Math.min(5, step + 1))}>下一步</InstitutionV11Button></div>}
      >
        <div className="grid gap-2 sm:grid-cols-2">
          {importSteps.map((step, index) => (
            <button key={step} type="button" onClick={() => setImportStep(index)} className={`rounded-lg border px-3 py-3 text-left text-xs ${index === importStep ? 'border-blue-300 bg-blue-50 font-semibold text-blue-800' : 'border-slate-200 text-slate-500'}`}>{index + 1}. {step}</button>
          ))}
        </div>
        <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center"><Import aria-hidden="true" className="mx-auto h-6 w-6 text-slate-400" /><h3 className="mt-2 text-sm font-semibold text-slate-900">{importSteps[importStep]}</h3><p className="mt-1 text-xs leading-5 text-slate-500">当前不会读取文件、保存字段映射或写入客户数据。</p></div>
      </InstitutionV11Drawer>
    </section>
  );
}
