'use client';

import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  BookOpenText,
  Bot,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDashed,
  ClipboardList,
  CloudCog,
  Clock3,
  Database,
  FileInput,
  FileText,
  Filter,
  GitBranch,
  History,
  Import,
  KeyRound,
  Link2,
  ListFilter,
  LockKeyhole,
  MessageSquareText,
  MonitorSmartphone,
  MoreHorizontal,
  Network,
  PanelRightOpen,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Upload,
  UserRoundCog,
  UsersRound,
  Waypoints,
  WifiOff,
  Workflow,
  X,
} from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';

import type { InstitutionCanonicalRouteIdV1 } from '@/modules/institution-contracts/v1/institution-routes';
import {
  InstitutionV11Button,
  InstitutionV11CapabilityBanner,
  InstitutionV11DateRangeControl,
  InstitutionV11Drawer,
  InstitutionV11EmptyState,
  InstitutionV11Freshness,
  InstitutionV11Modal,
  InstitutionV11PageHeader,
  InstitutionV11Surface,
  InstitutionV11Tabs,
  InstitutionV11UnavailableValue,
  type InstitutionCapabilityVisualStateV11,
} from '@/modules/institution-v11/components/InstitutionV11Ui';
import { cn } from '@/shared/utils/cn';

type CapabilityOffRouteIdV11 = Exclude<InstitutionCanonicalRouteIdV1, 'workbench'>;

const routeCapabilityState: Partial<Record<CapabilityOffRouteIdV11, InstitutionCapabilityVisualStateV11>> = {
  conversation_queue: 'NOT_CONFIGURED',
  conversation_automations: 'CAPABILITY_OFF',
  conversation_automation_detail: 'CAPABILITY_OFF',
  conversation_detail: 'NOT_CONFIGURED',
  care_appointments: 'CAPABILITY_OFF',
  care_appointment_detail: 'CAPABILITY_OFF',
  care_followups: 'CAPABILITY_OFF',
  care_followup_detail: 'CAPABILITY_OFF',
  care_paths: 'CAPABILITY_OFF',
  care_path_detail: 'CAPABILITY_OFF',
  knowledge_library: 'CAPABILITY_OFF',
  knowledge_search: 'EXTERNAL_CONTRACT_REQUIRED',
  knowledge_qa: 'EXTERNAL_CONTRACT_REQUIRED',
  knowledge_qa_audit_detail: 'CAPABILITY_OFF',
  knowledge_jobs: 'CAPABILITY_OFF',
  knowledge_item_detail: 'CAPABILITY_OFF',
  analytics_overview: 'CAPABILITY_OFF',
  analytics_consumption: 'CAPABILITY_OFF',
  analytics_consumption_detail: 'CAPABILITY_OFF',
  analytics_projects: 'CAPABILITY_OFF',
  analytics_project_detail: 'CAPABILITY_OFF',
  analytics_opportunities: 'CAPABILITY_OFF',
  analytics_opportunity_detail: 'CAPABILITY_OFF',
  analytics_reports: 'CAPABILITY_OFF',
  analytics_report_detail: 'CAPABILITY_OFF',
  system_channels: 'NOT_CONFIGURED',
  system_channel_connection_detail: 'NOT_CONFIGURED',
  system_channel_mappings: 'NOT_CONFIGURED',
  system_channel_mapping_detail: 'NOT_CONFIGURED',
  system_data: 'EXTERNAL_CONTRACT_REQUIRED',
  system_data_source_detail: 'EXTERNAL_CONTRACT_REQUIRED',
  system_data_import_detail: 'CAPABILITY_OFF',
  system_ai_usage: 'CAPABILITY_OFF',
  system_ai_usage_service_detail: 'CAPABILITY_OFF',
};

const unsupportedFilterGroups = [
  '基础资料',
  '客户归属',
  '数据来源与质量',
  '预约与治疗',
  '消费与套餐',
  '随访状态',
  '沟通与渠道',
  'AI 与经营机会',
] as const;

function CapabilityFootnote() {
  return (
    <div className="border-t border-slate-100 bg-slate-50/80 px-4 py-2.5 text-[11px] leading-5 text-slate-500">
      页面结构已经还原；未知数据不会解释为零记录。任何正式读取、写入或外部调用仍须通过当前服务端 Capability、机构授权与对象权限。
    </div>
  );
}

function DisabledField({ label, value = '当前不支持' }: Readonly<{ label: string; value?: string }>) {
  return (
    <label className="grid gap-1.5 text-xs font-medium text-slate-600">
      {label}
      <span className="flex h-9 items-center rounded-lg border border-slate-200 bg-slate-100 px-3 font-normal text-slate-400">
        {value}
      </span>
    </label>
  );
}

function SkeletonRows({ columns = 4, rows = 5 }: Readonly<{ columns?: number; rows?: number }>) {
  return (
    <div aria-label="不可用数据表格" className="overflow-x-auto">
      <div className="min-w-[720px]">
        <div className="grid border-b border-slate-200 bg-slate-50 px-4 py-2.5" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
          {Array.from({ length: columns }, (_, index) => (
            <span key={index} className="text-xs font-semibold text-slate-500">{['对象', '状态', '负责人', '更新时间', '来源'][index] ?? `字段 ${index + 1}`}</span>
          ))}
        </div>
        {Array.from({ length: rows }, (_, row) => (
          <div key={row} className="grid items-center border-b border-slate-100 px-4 py-3 last:border-b-0" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
            {Array.from({ length: columns }, (_, column) => (
              <span key={column} className={cn('h-2.5 rounded-full bg-slate-100', column === 0 ? 'w-3/5' : 'w-2/5')} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function CustomerDetailCapabilityPage() {
  const [activeTab, setActiveTab] = useState('portrait');
  const [insightTab, setInsightTab] = useState('communication');
  const pageTabs = [
    { id: 'overview', label: '概览' }, { id: 'portrait', label: '客户画像' },
    { id: 'appointments', label: '预约与服务' }, { id: 'followups', label: '随访记录' },
    { id: 'conversations', label: '沟通记录' }, { id: 'consumption', label: '消费记录' },
  ] as const;
  const insightTabs = [
    { id: 'summary', label: '画像概览' }, { id: 'communication', label: '沟通洞察' },
    { id: 'business', label: '经营建议' }, { id: 'package', label: '套餐建议' }, { id: 'evidence', label: '证据来源' },
  ] as const;
  return (
    <div className="space-y-4">
      <InstitutionV11PageHeader eyebrow="CUSTOMER DETAIL" title="客户详情" description="对象级 Workspace；客户事实、AI 推断与经营建议严格分区。" breadcrumbs={[{ label: '机构端', href: '/hospital' }, { label: '客户中心' }, { label: '客户详情' }]} state="CAPABILITY_OFF" actions={<><InstitutionV11Button icon={MessageSquareText} disabled disabledReason="对象与 MessageDelivery 权限未开放">联系客户</InstitutionV11Button><InstitutionV11Button icon={ClipboardList} disabled disabledReason="Follow-up Writer 未开放">创建随访</InstitutionV11Button><InstitutionV11Button icon={MoreHorizontal}>更多</InstitutionV11Button></>} />
      <InstitutionV11Surface className="px-5 py-5">
        <div className="flex items-center gap-4">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-blue-300 to-blue-600 text-xl font-semibold text-white">客</span>
          <div className="min-w-0"><div className="flex items-center gap-2"><h2 className="text-xl font-bold text-slate-900">客户 · 未授权</h2><span className="rounded-md bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700">对象权限待校验</span></div><p className="mt-1 text-xs text-slate-400">姓名、手机号、负责人等客户事实未读取</p><div className="mt-2 flex gap-1.5">{['标签未读取', '偏好未知', '潜力未知'].map((tag) => <span key={tag} className="rounded bg-slate-100 px-2 py-1 text-[11px] text-slate-500">{tag}</span>)}</div></div>
          <div className="ml-2 h-16 border-l border-slate-200" />
          <div><p className="text-[11px] text-slate-400">当前随访</p><p className="mt-1 text-sm font-semibold text-slate-700">Follow-up Projection 未开放</p><p className="mt-1 text-[11px] text-slate-400">计划时间与节点状态不可用</p></div>
          <span className="ml-auto rounded-md bg-slate-100 px-2 py-1 text-[11px] text-slate-500">渠道状态未验证</span>
        </div>
      </InstitutionV11Surface>
      <InstitutionV11Surface>
        <InstitutionV11Tabs label="客户详情页面" items={pageTabs} activeId={activeTab} onChange={setActiveTab} />
        <div className="p-4"><div className="rounded-xl border border-slate-200"><InstitutionV11Tabs label="客户画像页面" items={insightTabs} activeId={insightTab} onChange={setInsightTab} /></div></div>
        <div className="grid gap-4 px-4 pb-4 lg:grid-cols-[1.35fr_1fr]">
          <InstitutionV11Surface title="沟通内容摘要"><div className="p-4"><div className="rounded-xl border border-slate-200 p-4"><div className="flex items-center justify-between"><p className="text-sm font-semibold text-slate-700">最近沟通 · 未读取</p><span className="rounded bg-violet-50 px-2 py-1 text-[11px] text-violet-600">AI 辅助关闭</span></div><p className="mt-4 text-sm leading-6 text-slate-500">没有获得经过授权的会话正文，因此不会生成沟通摘要、需求判断或客户标签。</p><p className="mt-4 text-[11px] text-slate-400">证据：无可验证来源</p></div></div></InstitutionV11Surface>
          <InstitutionV11Surface title="沟通洞察"><dl className="space-y-4 p-4 text-sm">{['主要需求', '预算敏感度', '沟通偏好', '未解决问题', '情绪'].map((label) => <div key={label} className="flex items-start justify-between gap-4"><dt className="text-slate-500">{label}</dt><dd className="text-right font-semibold text-slate-400">未获得可信判断</dd></div>)}</dl><div className="mx-4 mb-4 rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-400">AI 判断必须经人工确认后才可写入正式画像标签。</div></InstitutionV11Surface>
        </div>
      </InstitutionV11Surface>
    </div>
  );
}

function CustomerCapabilityPage({ pageLabel, routeId }: Readonly<{ pageLabel: string; routeId: CapabilityOffRouteIdV11 }>) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('list');
  const [importStep, setImportStep] = useState(0);
  if (routeId === 'customer_detail') return <CustomerDetailCapabilityPage />;
  const tabs = [
    { id: 'list', label: '客户列表' },
    { id: 'segments', label: '客户分群' },
    { id: 'opportunities', label: '经营机会' },
    { id: 'import', label: 'Excel 导入' },
  ] as const;
  const importSteps = ['下载模板', '上传文件', '字段映射', '数据校验', '重复处理', '完成导入'] as const;

  return (
    <div className="space-y-4">
      <InstitutionV11PageHeader
        eyebrow="CUSTOMER CENTER"
        title={pageLabel}
        description="客户事实、AI 推断与经营建议分区呈现；当前页面不会在客户端加载全量客户后自行筛选。"
        breadcrumbs={[{ label: '机构端', href: '/hospital' }, { label: '客户中心' }, { label: pageLabel }]}
        state="CAPABILITY_OFF"
        actions={(
          <>
            <InstitutionV11Button icon={Import} onClick={() => setActiveTab('import')}>Excel 导入</InstitutionV11Button>
            <InstitutionV11Button icon={Plus} tone="primary" disabled disabledReason="客户写入 Capability 未开放">人工新增</InstitutionV11Button>
          </>
        )}
      />

      <InstitutionV11CapabilityBanner
        title="当前为 V1.1 批准原型：筛选条件、AI画像和 Connector 配置均为可实现交互示意，正式数据能力按机构授权开放"
        description="高级筛选中仅 lifecycle 与 priority 有正式服务端查询契约；其他条件保持禁用，不会进行客户端伪筛选。"
        state="CAPABILITY_OFF"
        source="Customer Canonical Owner / Capability Authority"
      />

      <InstitutionV11Surface>
        <div className="sr-only"><InstitutionV11Tabs label="客户中心页面" items={tabs} activeId={activeTab} onChange={setActiveTab} /></div>
        {activeTab === 'list' ? (
          <>
            <div className="flex h-12 items-center gap-2 border-b border-slate-100 bg-blue-50/40 px-4 text-xs text-slate-600"><Database className="h-4 w-4" /><span>数据最近同步：</span><strong className="text-slate-800">未获得可信时间</strong><span>；HIS / 数据库 / Excel 来源状态由 Connector Authority 判定。</span></div>
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3 text-xs"><span className="font-semibold text-slate-600">保存视图</span>{['全部客户', '我的客户', '随访处理中', '高风险待人工', '未匹配微信'].map((label, index) => <button key={label} type="button" className={cn('rounded-full border px-3 py-1.5', index === 0 ? 'border-blue-200 bg-blue-50 font-semibold text-blue-700' : 'border-slate-200 text-slate-500')}>{label}</button>)}<button disabled className="rounded-full border border-slate-200 px-3 py-1.5 text-slate-300">＋ 保存当前视图</button></div>
            <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                <div className="relative min-w-[240px] flex-1 lg:max-w-sm">
                  <Search aria-hidden="true" className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input disabled aria-label="搜索客户" placeholder="搜索姓名、手机号或客户编号" className="h-9 w-full rounded-lg border border-slate-200 bg-slate-100 pl-9 pr-3 text-sm placeholder:text-slate-400" />
                </div>
                <select disabled aria-label="院区" className="h-9 rounded-lg border border-slate-200 bg-slate-100 px-3 text-xs text-slate-400"><option>全部院区</option></select>
                <select disabled aria-label="负责人" className="h-9 rounded-lg border border-slate-200 bg-slate-100 px-3 text-xs text-slate-400"><option>全部负责人</option></select>
              </div>
              <div className="flex flex-wrap gap-2">
                <InstitutionV11Button ariaLabel="高级筛选" icon={Filter} onClick={() => setDrawerOpen(true)}>更多筛选</InstitutionV11Button>
                <InstitutionV11Button icon={SlidersHorizontal} disabled disabledReason="列偏好持久化未开放">列设置</InstitutionV11Button>
                <InstitutionV11Button icon={FileInput} disabled disabledReason="保存视图 Writer 未开放">保存视图</InstitutionV11Button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-2.5">
              <span className="text-xs font-medium text-slate-500">当前筛选：</span>
              <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-600">正式数据范围 <X aria-hidden="true" className="h-3 w-3" /></span>
              <span className="text-[11px] text-slate-400">仅服务端已接受的查询条件会进入结果</span>
            </div>
            <SkeletonRows columns={5} rows={6} />
            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
              <span>当前未获得可信客户结果</span>
              <div className="flex items-center gap-2">
                <button disabled className="h-8 rounded-lg border border-slate-200 px-3 text-slate-300">上一页</button>
                <span>第 -- 页</span>
                <button disabled className="h-8 rounded-lg border border-slate-200 px-3 text-slate-300">下一页</button>
              </div>
            </div>
          </>
        ) : activeTab === 'import' ? (
          <div className="p-5">
            <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
              {importSteps.map((step, index) => (
                <button key={step} type="button" onClick={() => setImportStep(index)} className={cn('rounded-lg border px-3 py-3 text-left text-xs transition', importStep === index ? 'border-blue-300 bg-blue-50 text-blue-800' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50')}>
                  <span className="block text-[10px] font-semibold text-slate-400">步骤 {index + 1}</span>
                  <span className="mt-1 block font-semibold">{step}</span>
                </button>
              ))}
            </div>
            <div className="mt-5 grid min-h-72 place-items-center rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-8 text-center">
              <div>
                <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-white text-slate-500 shadow-sm"><Upload aria-hidden="true" className="h-5 w-5" /></span>
                <h3 className="mt-3 text-sm font-semibold text-slate-900">{importSteps[importStep]}</h3>
                <p className="mx-auto mt-1.5 max-w-md text-xs leading-5 text-slate-500">正式 Excel Import / Validation / Mapping Writer 尚未开放。本向导不会读取文件、写入数据库或伪造导入成功。</p>
                <InstitutionV11Button icon={LockKeyhole} disabled disabledReason="Excel Import Capability 未开放">继续此步骤</InstitutionV11Button>
              </div>
            </div>
          </div>
        ) : (
          <InstitutionV11EmptyState
            icon={activeTab === 'segments' ? UsersRound : Sparkles}
            title={activeTab === 'segments' ? '客户分群 Domain 未开放' : '经营机会聚合未开放'}
            description={activeTab === 'segments' ? '规则、适用范围和依赖条件已经呈现，但不会创建临时分群表或本地规则。' : '需要正式客户事实、消费事实与机会模型；当前不生成任何机会记录。'}
          />
        )}
        <CapabilityFootnote />
      </InstitutionV11Surface>

      <InstitutionV11Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="更多筛选"
        ariaLabel="高级筛选"
        description="仅正式服务端查询字段可以提交；其余分组明确标记当前不支持。"
        footer={<div className="flex justify-end gap-2"><InstitutionV11Button onClick={() => setDrawerOpen(false)}>重置</InstitutionV11Button><InstitutionV11Button tone="primary" onClick={() => setDrawerOpen(false)}>查询</InstitutionV11Button></div>}
      >
        <div className="space-y-3">
          {unsupportedFilterGroups.map((group, index) => (
            <details key={group} open className="rounded-xl border border-slate-200 bg-white">
              <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40">{group}</summary>
              <div className="grid gap-3 border-t border-slate-100 p-4 sm:grid-cols-2">
                {group === '基础资料' ? (
                  <>
                    <DisabledField label="性别" />
                    <DisabledField label="年龄区间" />
                    <DisabledField label="客户创建时间" />
                  </>
                ) : group === '客户归属' ? (
                  <>
                    <DisabledField label="负责人" />
                    <DisabledField label="协作成员" />
                  </>
                ) : (
                  <>
                    <DisabledField label={`${group}条件一`} />
                    <DisabledField label={`${group}条件二`} />
                  </>
                )}
              </div>
            </details>
          ))}
        </div>
      </InstitutionV11Drawer>
    </div>
  );
}

function ConversationCapabilityPage({ pageLabel }: Readonly<{ pageLabel: string }>) {
  const [contextTab, setContextTab] = useState('profile');
  const contextTabs = [
    { id: 'profile', label: '档案' },
    { id: 'ai', label: 'AI' },
    { id: 'appointment', label: '预约' },
    { id: 'followup', label: '随访' },
  ] as const;
  return (
    <div className="-mx-[26px] -my-[22px]">
      <div className="sr-only"><InstitutionV11PageHeader eyebrow="CONVERSATION WORKBENCH" title={pageLabel} description="四栏会话工作区已经还原；真实微信登录、消息入站、消息发送与 AI 自动回复继续关闭。" breadcrumbs={[{ label: '机构端', href: '/hospital' }, { label: '会话工作台' }, { label: pageLabel }]} state="NOT_CONFIGURED" /></div>
      <section className="grid min-h-[calc(100vh-var(--institution-topbar)-var(--institution-workspace))] overflow-hidden border-t border-slate-200 bg-white xl:grid-cols-[68px_300px_minmax(400px,1fr)_306px]">
        <aside className="border-b border-slate-200 bg-white p-2 text-slate-600 xl:border-b-0 xl:border-r">
          <h2 className="sr-only">微信账号</h2>
          <div className="space-y-2">
            {[
              ['全部账号', MonitorSmartphone, '未知'],
              ['个人微信', WifiOff, '供应商依赖'],
              ['企业微信', ShieldCheck, '待管理员授权'],
            ].map(([label, Icon, status]) => (
              <button key={String(label)} type="button" title={`${String(label)} · ${String(status)}`} className="flex w-full flex-col items-center gap-1 rounded-lg px-1 py-2 hover:bg-blue-50">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-blue-300 to-blue-600 text-white"><Icon aria-hidden="true" className="h-4 w-4" /></span>
                <span className="text-center text-[9px] leading-3 text-slate-500">{String(label)}</span>
              </button>
            ))}
          </div>
        </aside>
        <aside className="border-b border-slate-200 xl:border-b-0 xl:border-r">
          <div className="border-b border-slate-100 p-3">
            <div className="mb-2 flex items-center justify-between"><h2 className="text-[17px] font-bold text-slate-900">会话</h2><span className="text-xs text-blue-600">设置</span></div>
            <div className="relative">
              <Search aria-hidden="true" className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input disabled placeholder="搜索会话" className="h-9 w-full rounded-lg border border-slate-200 bg-slate-100 pl-9 pr-3 text-sm" />
            </div>
            <div className="mt-2 flex gap-1">
              {['全部', 'AI', '待接管', '人工'].map((label) => <button key={label} type="button" className={cn('rounded-full px-2.5 py-1 text-[11px]', label === '全部' ? 'bg-blue-50 font-semibold text-blue-700' : 'text-slate-500 hover:bg-slate-50')}>{label}</button>)}
            </div>
          </div>
          <InstitutionV11EmptyState icon={MessageSquareText} title="暂无可信会话队列" description="未读取会话事实、未读数、负责人或渠道身份状态。" />
        </aside>
        <div className="flex min-h-[480px] flex-col border-b border-slate-200 xl:border-b-0 xl:border-r">
          <header className="flex h-14 items-center justify-between gap-3 border-b border-slate-100 px-4">
            <div><h2 className="text-sm font-semibold text-slate-900">未选择会话</h2><p className="text-[11px] text-slate-500">发送者身份与当前阶段未读取</p></div>
            <div className="flex gap-2"><select disabled className="h-9 rounded-lg border border-slate-200 bg-slate-100 px-3 text-sm text-slate-400"><option>AI辅助</option></select><InstitutionV11Button icon={UserRoundCog} disabled disabledReason="需要正式会话对象权限">人工接管</InstitutionV11Button><InstitutionV11Button disabled disabledReason="对象权限未开放">客户详情</InstitutionV11Button></div>
          </header>
          <div className="grid flex-1 place-items-center bg-slate-50/60 p-6 text-center">
            <div><span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-white text-slate-400 shadow-sm"><MessageSquareText aria-hidden="true" className="h-5 w-5" /></span><h3 className="mt-3 text-sm font-semibold text-slate-900">选择正式会话后查看消息流</h3><p className="mt-1 text-xs text-slate-500">不会使用非正式记录补成聊天正文。</p></div>
          </div>
          <footer className="border-t border-slate-200 bg-white p-3">
            <div className="flex gap-5 pb-2 text-xs font-semibold text-blue-600"><button type="button" disabled title="真实附件发送关闭">图片</button><button type="button" disabled>文件</button><button type="button" disabled title="知识引用需要已发布知识与对象权限">知识库</button><button type="button" disabled>话术</button></div>
            <div className="flex gap-2"><textarea disabled aria-label="会话输入" placeholder="真实消息发送未开放" className="min-h-20 flex-1 resize-none border-0 bg-white p-1 text-sm" /><InstitutionV11Button tone="primary" disabled disabledReason="MessageDelivery 未开放">发送</InstitutionV11Button></div>
          </footer>
        </div>
        <aside>
          <div className="overflow-x-auto"><InstitutionV11Tabs label="客户上下文" items={contextTabs} activeId={contextTab} onChange={setContextTab} /></div>
          <div className="p-4">
            <InstitutionV11EmptyState icon={contextTab === 'ai' ? Bot : contextTab === 'appointment' ? CalendarClock : contextTab === 'followup' ? ClipboardList : UsersRound} title={`${contextTabs.find((item) => item.id === contextTab)?.label ?? '上下文'}未读取`} description="需要当前会话对象与客户对象的服务端授权结果；不会从客户端路径推断关联事实。" />
          </div>
        </aside>
      </section>
    </div>
  );
}

function AppointmentCalendar() {
  const days = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
  const dates = ['08-24', '08-25', '08-26', '08-27', '08-28', '08-29', '08-30'];
  const times = ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'];
  return (
    <div className="overflow-x-auto p-3">
      <div className="min-w-[980px] overflow-hidden rounded-lg border border-slate-200">
        <div className="grid grid-cols-[88px_repeat(7,minmax(0,1fr))] bg-slate-50"><div className="grid place-items-center border-r border-slate-200 text-xs text-slate-600">时间</div>{days.map((day, index) => <div key={day} className="border-r border-slate-200 py-2 text-center last:border-r-0"><div className="text-xs font-semibold text-slate-700">{day}</div><div className="mt-1 text-[10px] text-slate-400">{dates[index]}</div></div>)}</div>
        {times.map((time) => <div key={time} className="grid grid-cols-[88px_repeat(7,minmax(0,1fr))] border-t border-slate-200"><div className="px-3 py-3 text-center text-[11px] text-slate-400">{time}</div>{days.map((day) => <button key={`${day}-${time}`} type="button" disabled title="Availability 能力未开放" className="m-1 min-h-[58px] rounded-md border border-dashed border-blue-200 bg-white text-[10px] text-slate-400 disabled:cursor-not-allowed">空闲 · --:--</button>)}</div>)}
      </div>
    </div>
  );
}

function CareCapabilityPage({ pageLabel, routeId }: Readonly<{ pageLabel: string; routeId: CapabilityOffRouteIdV11 }>) {
  const planPage = routeId === 'care_paths' || routeId === 'care_path_detail';
  const [view, setView] = useState(planPage ? 'designer' : 'calendar');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pageTabs = [
    { id: 'appointments', label: '预约管理' },
    { id: 'followups', label: '随访管理' },
    { id: 'designer', label: '随访方案' },
  ] as const;
  return (
    <div className="space-y-4">
      <InstitutionV11PageHeader eyebrow="APPOINTMENT & FOLLOW-UP" title={planPage ? '术后随访方案 V3' : pageLabel} description={planPage ? '已发布版本引用固定 Knowledge Version；修改会创建新草稿版本，不直接覆盖历史任务。' : '聚合 HIS 与智美天工预约，统一查询 Availability，创建、改约、取消与双向同步。'} breadcrumbs={[{ label: '机构端', href: '/hospital' }, { label: '预约与随访' }, { label: pageLabel }]} state="CAPABILITY_OFF" actions={planPage ? <><InstitutionV11Button disabled disabledReason="方案 Writer 未开放">保存草稿</InstitutionV11Button><InstitutionV11Button disabled disabledReason="模拟执行契约未开放">模拟测试</InstitutionV11Button><InstitutionV11Button ariaLabel="发布版本" tone="primary" disabled disabledReason="发布 Writer 未开放">发布方案</InstitutionV11Button></> : <><InstitutionV11Button ariaLabel="空闲时间" icon={Search} onClick={() => setDrawerOpen(true)}>查询空闲时间</InstitutionV11Button><InstitutionV11Button icon={Plus} tone="primary" disabled disabledReason="正式 Writer 或 Availability 未开放">新建预约</InstitutionV11Button></>} />
      {!planPage ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[['今日预约', CalendarDays], ['待确认', Clock3], ['同步异常', AlertTriangle], ['本周空闲时段', CheckCircle2]].map(([label, Icon]) => <InstitutionV11UnavailableValue key={String(label)} label={String(label)} source="正式聚合未开放" icon={Icon as typeof CalendarDays} />)}</div> : null}
      <InstitutionV11Surface>
        <div className="sr-only"><InstitutionV11Tabs label="预约与随访页面" items={pageTabs} activeId={view} onChange={setView} /></div>
        {view === 'designer' ? (
          <div className="grid min-h-[690px] lg:grid-cols-[250px_minmax(0,1fr)_330px]">
            <aside className="border-b border-slate-200 p-4 lg:border-b-0 lg:border-r">
              <h2 className="text-sm font-semibold text-slate-900">触发与适用范围</h2>
              <div className="mt-4 space-y-3">{[['触发事件', '治疗完成'], ['适用项目', '项目事实未读取'], ['终止条件', '拒绝联系 / 人工终止 / 严重投诉'], ['频控', '同一客户每天最多主动触达 1 次']].map(([title, detail]) => <div key={title} className="rounded-xl border border-slate-200 p-3"><p className="text-xs font-semibold text-slate-800">{title}</p><p className="mt-1 text-[11px] leading-5 text-slate-500">{detail}</p></div>)}</div><InstitutionV11Button disabled disabledReason="方案 Writer 未开放">编辑触发条件</InstitutionV11Button>
            </aside>
            <div className="border-b border-slate-200 lg:border-b-0 lg:border-r">
              <header className="flex h-[52px] items-center justify-between border-b border-slate-200 px-4"><h2 className="text-sm font-semibold text-slate-900">可视化时间轴</h2><span className="rounded-md bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-600">4个节点</span></header>
              <div className="min-h-[638px] bg-[radial-gradient(circle,#d8e5f6_1px,transparent_1px)] bg-[size:22px_22px] p-8"><div className="mx-auto w-48 rounded-xl border border-blue-200 bg-blue-50 p-4 text-center text-sm font-semibold text-slate-700">治疗完成<p className="mt-1 text-[11px] font-normal text-slate-400">治疗项目待授权 · 需等事件</p></div><div className="mt-8 grid grid-cols-3 gap-4">{['术后1天', '术后3天', '术后7天', '术后30天'].map((title, index) => <button key={title} type="button" className={cn('min-h-28 rounded-xl border bg-white p-4 text-center', index === 0 ? 'border-blue-500 ring-2 ring-blue-100' : 'border-slate-200')}><span className="text-xs font-semibold text-blue-600">T+{[1,3,7,30][index]}天</span><strong className="mt-2 block text-sm text-slate-800">{title}</strong><span className="mt-2 block text-[10px] text-slate-400">知识版本未读取</span></button>)}</div><button disabled className="mx-auto mt-5 block rounded-xl border border-dashed border-blue-300 bg-white px-8 py-5 text-sm font-semibold text-blue-500">＋ 添加节点</button></div>
            </div>
            <aside className="p-4"><h2 className="text-sm font-semibold text-slate-900">术后1天 · 节点设置</h2><div className="mt-4 grid gap-3"><DisabledField label="执行时间" value="T+1天" /><DisabledField label="允许发送窗口" value="09:00–18:00" /><DisabledField label="内容与知识" value="条件自动" /><div className="rounded-xl border border-slate-200 p-3 text-xs"><strong>结构化问卷</strong>{['是否红肿', '是否疼痛', '是否渗液', '干燥程度', '护理依从性'].map((item) => <label key={item} className="mt-2 flex items-center gap-2"><input type="checkbox" defaultChecked disabled />{item}</label>)}</div><div className="space-y-2 border-t border-slate-200 pt-3">{['无回复：24小时后提醒1次', '风险：高风险转人工', '完成：客户回复+低风险'].map((item) => <p key={item} className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-500">{item}</p>)}</div></div></aside>
          </div>
        ) : view === 'followups' ? (
          <div><div className="flex flex-wrap gap-1 border-b border-slate-100 p-3">{['待执行', '进行中', '待人工', '已完成', '异常'].map((label, index) => <button key={label} type="button" className={cn('rounded-full px-3 py-1.5 text-xs', index === 0 ? 'bg-blue-50 font-semibold text-blue-700' : 'text-slate-500')}>{label}</button>)}</div><SkeletonRows columns={5} rows={7} /><CapabilityFootnote /></div>
        ) : (
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 px-4"><div className="flex h-12 items-center gap-5 text-sm"><button type="button" className="text-slate-500">列表</button><button type="button" className="h-full border-b-2 border-blue-600 font-semibold text-blue-600">日历</button></div><div className="flex gap-2"><span className="rounded-md bg-emerald-50 px-2 py-1 text-[11px] text-emerald-600">HIS预约读 Capability 未开放</span><span className="rounded-md bg-amber-50 px-2 py-1 text-[11px] text-amber-600">取消写入未授权</span></div></div><div className="flex h-11 items-center gap-7 border-b border-slate-100 px-4 text-sm text-slate-500"><span className="h-full border-b-2 border-blue-600 py-3 font-semibold text-blue-600">全部</span><span>待确认</span><span>已确认</span><span>已完成</span><span>已取消</span><span>异常</span></div>
            <AppointmentCalendar />
          </div>
        )}
      </InstitutionV11Surface>
      <InstitutionV11Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="空闲时间查询" description="时间槽组件已还原，但不会生成假空闲时段。" footer={<div className="flex justify-end"><InstitutionV11Button onClick={() => setDrawerOpen(false)}>关闭</InstitutionV11Button></div>}>
        <div className="grid gap-4"><DisabledField label="项目" /><DisabledField label="医生" /><DisabledField label="治疗室" /><DisabledField label="设备" /><div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center"><CalendarClock aria-hidden="true" className="mx-auto h-6 w-6 text-slate-400" /><h3 className="mt-2 text-sm font-semibold text-slate-900">Availability 能力未开放</h3><p className="mt-1 text-xs leading-5 text-slate-500">不可预约时段全部置灰；Hover 会显示当前禁用原因。</p></div></div>
      </InstitutionV11Drawer>
    </div>
  );
}

function KnowledgeCapabilityPage({ pageLabel, routeId }: Readonly<{ pageLabel: string; routeId: CapabilityOffRouteIdV11 }>) {
  const editor = routeId === 'knowledge_item_detail';
  const [activeType, setActiveType] = useState('documents');
  const tabs = [{ id: 'documents', label: '知识文档' }, { id: 'sop', label: 'SOP' }, { id: 'faq', label: 'FAQ' }, { id: 'scripts', label: '话术与模板' }] as const;
  return (
    <div className="space-y-4">
      <InstitutionV11PageHeader eyebrow="KNOWLEDGE BASE" title={routeId === 'knowledge_library' ? '知识库' : pageLabel} description="机构审核发布、版本化、可追溯并可按 AI 场景授权的统一知识底座。" breadcrumbs={[{ label: '机构端', href: '/hospital' }, { label: '知识库', href: '/hospital/knowledge' }, { label: pageLabel }]} state={routeId === 'knowledge_search' || routeId === 'knowledge_qa' ? 'EXTERNAL_CONTRACT_REQUIRED' : 'CAPABILITY_OFF'} actions={<><InstitutionV11Button icon={ShieldCheck} disabled disabledReason="AI 使用设置 Writer 未开放">AI使用设置</InstitutionV11Button><InstitutionV11Button icon={Upload} disabled disabledReason="知识上传 Writer 未开放">上传文件</InstitutionV11Button><InstitutionV11Button icon={Plus} tone="primary" disabled disabledReason="知识 Writer 未开放">新建知识</InstitutionV11Button></>} />
      {editor ? (
        <section className="grid min-h-[620px] overflow-hidden rounded-xl border border-slate-200 bg-white lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="border-b border-slate-200 lg:border-b-0 lg:border-r"><header className="flex items-center justify-between border-b border-slate-100 px-4 py-3"><div><h2 className="text-sm font-semibold text-slate-900">正文编辑</h2><p className="mt-0.5 text-[11px] text-slate-500">草稿不可保存 · Published only</p></div><div className="flex gap-2"><InstitutionV11Button disabled disabledReason="Knowledge Writer 未开放">保存草稿</InstitutionV11Button><InstitutionV11Button tone="primary" disabled disabledReason="发布流程未开放">发布</InstitutionV11Button></div></header><div className="p-5"><div className="min-h-[460px] rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-6"><h1 className="text-xl font-bold text-slate-300">知识标题</h1><p className="mt-4 text-sm leading-7 text-slate-400">正文编辑区已还原。当前未读取知识正文，也不会将示例文本保存为正式知识内容。</p></div></div></div>
          <aside className="p-4"><h2 className="text-sm font-semibold text-slate-900">知识属性</h2><div className="mt-4 grid gap-3"><DisabledField label="类型" /><DisabledField label="分类" /><DisabledField label="适用项目" /><DisabledField label="适用场景" /><DisabledField label="角色权限" /><DisabledField label="AI 检索权限" /><DisabledField label="AI 生成权限" /><DisabledField label="自动发送权限" /><DisabledField label="来源" /><DisabledField label="版本 / 发布状态" /></div></aside>
        </section>
      ) : (
        <InstitutionV11Surface>
          <div className="overflow-x-auto"><InstitutionV11Tabs label="知识类型" items={tabs} activeId={activeType} onChange={setActiveType} /></div>
          <div className="grid min-h-[520px] lg:grid-cols-[220px_minmax(0,1fr)]"><aside className="border-b border-slate-200 p-4 lg:border-b-0 lg:border-r"><p className="text-[11px] text-slate-400">知识空间 / 分类</p><nav className="mt-2 space-y-1">{['全部知识', '光电项目', '术后护理', '预约服务', '风险处理', '客户运营'].map((label, index) => <button key={label} type="button" className={cn('flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm', index === 0 ? 'bg-blue-50 font-semibold text-blue-700' : 'text-slate-600 hover:bg-slate-50')}><BookOpenText aria-hidden="true" className="h-4 w-4" />{label}</button>)}</nav><div className="mt-5 rounded-lg bg-slate-50 p-3 text-[11px] leading-5 text-slate-500">员工权限、AI 场景权限、发布状态在检索前过滤；未发布知识不能进入正式 AI 上下文。</div></aside><div><div className="grid gap-3 border-b border-slate-100 p-4 lg:grid-cols-[minmax(280px,1fr)_110px_130px_80px]"><div className="relative"><Search aria-hidden="true" className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input disabled placeholder="标题、问题、项目、标签" className="h-9 w-full rounded-lg border border-slate-200 bg-slate-100 pl-9 pr-3 text-sm" /></div><select disabled className="rounded-lg border border-slate-200 bg-slate-100 px-3 text-sm text-slate-400"><option>全部状态</option></select><select disabled className="rounded-lg border border-slate-200 bg-slate-100 px-3 text-sm text-slate-400"><option>全部AI</option></select><InstitutionV11Button tone="primary" disabled disabledReason="正式筛选 Reader 未开放">查询</InstitutionV11Button></div><SkeletonRows columns={7} rows={3} /><CapabilityFootnote /></div></div>
        </InstitutionV11Surface>
      )}
    </div>
  );
}

function AnalyticsCapabilityPage({ pageLabel, routeId }: Readonly<{ pageLabel: string; routeId: CapabilityOffRouteIdV11 }>) {
  const [activeTab, setActiveTab] = useState(routeId.startsWith('analytics_report') ? 'strategy' : 'overview');
  const tabs = [{ id: 'overview', label: '经营总览' }, { id: 'customers', label: '客户分析' }, { id: 'appointments', label: '预约与服务' }, { id: 'followups', label: '随访与触达' }, { id: 'ai', label: 'AI 与自动化' }, { id: 'strategy', label: '经营策略' }] as const;
  const metrics = ['客户规模', '新增客户', '预约完成', '随访触达', '经营机会', '转化率'];
  return (
    <div className="space-y-4">
      <InstitutionV11Surface className="p-4"><InstitutionV11PageHeader eyebrow="BUSINESS ANALYTICS" title="经营分析" description="围绕客户、预约、服务、随访、触达和 AI 形成可下钻分析，并生成有证据的经营策略草稿。" breadcrumbs={[{ label: '机构端', href: '/hospital' }, { label: '经营分析' }, { label: pageLabel }]} state="CAPABILITY_OFF" actions={<InstitutionV11Button disabled disabledReason="导出聚合未开放">导出</InstitutionV11Button>} /><div className="mt-3 flex flex-wrap items-end gap-10"><DisabledField label="分析周期" value="本月" /><DisabledField label="院区" value="全部院区" /><DisabledField label="项目" value="全部项目" /><DisabledField label="负责人" value="全部负责人" /><span className="ml-auto rounded-md bg-slate-100 px-2 py-1 text-[11px] text-slate-400">数据更新时间不可用</span></div></InstitutionV11Surface>
      <InstitutionV11Surface><div className="overflow-x-auto"><InstitutionV11Tabs label="经营分析页面" items={tabs} activeId={activeTab} onChange={setActiveTab} /></div></InstitutionV11Surface>
      <InstitutionV11CapabilityBanner title={activeTab === 'strategy' ? '经营策略基于真实同步数据生成；缺少成本、毛利或营销费用时，只给方向性建议，不伪装成利润预测。' : '当前页面缺少可验证聚合'} description={activeTab === 'strategy' ? '可以查看生成条件、所需数据、证据与假设边界，但不会生成上月诊断或下月策略。' : '指标结构已还原；没有正式聚合时统一显示不可用，不使用演示营收、毛利、转化率或营销策略。'} state="CAPABILITY_OFF" source="Analytics Canonical Aggregation" />
      <div>
        {activeTab === 'strategy' ? (
          <div className="grid gap-4 lg:grid-cols-[1.25fr_0.9fr]"><div className="space-y-4"><InstitutionV11Surface><div className="flex items-center gap-3 p-4"><span className="grid h-12 w-12 place-items-center rounded-full bg-blue-50 text-lg font-bold text-blue-600">—</span><div><h2 className="text-sm font-semibold text-slate-900">本期经营健康度</h2><p className="mt-1 text-[11px] text-slate-400">聚合数据完整度不足</p></div><InstitutionV11Button disabled disabledReason="Evidence Reader 未开放">查看证据</InstitutionV11Button></div><div className="grid grid-cols-4 gap-3 border-t border-slate-100 p-4">{['营业收入', '预约到店率', '热门项目', '随访回复率'].map((metric) => <div key={metric}><p className="text-[11px] text-slate-400">{metric}</p><p className="mt-1 text-lg font-bold text-slate-400">—</p><p className="text-[10px] text-slate-400">数据不可用</p></div>)}</div></InstitutionV11Surface><InstitutionV11Surface title="推荐经营策略"><div className="divide-y divide-slate-100 px-4">{['经营策略方向一 · 未生成', '经营策略方向二 · 未生成'].map((title, index) => <article key={title} className="flex gap-3 py-4"><span className="grid h-8 w-8 place-items-center rounded-lg bg-blue-50 text-sm font-semibold text-blue-600">{index + 1}</span><div><h3 className="text-sm font-semibold text-slate-800">{title}</h3><p className="mt-1 text-xs text-slate-400">缺少正式经营模型，不生成目标、依据、动作或预计影响。</p></div></article>)}</div></InstitutionV11Surface><div className="sr-only"><h2>上月经营诊断</h2></div></div><div className="space-y-4"><InstitutionV11Surface title="下月目标建议"><dl className="space-y-3 p-4 text-xs">{['营收目标', '预约到店率', '随访回复率', '工作日资源利用率'].map((label) => <div key={label} className="flex justify-between"><dt className="text-slate-500">{label}</dt><dd className="font-semibold text-slate-400">未生成</dd></div>)}</dl></InstitutionV11Surface><InstitutionV11Surface title="项目与套餐策略"><div className="space-y-3 p-4">{['项目策略 · 未生成', '套餐策略 · 未生成'].map((title) => <div key={title} className="rounded-xl border border-slate-200 p-3"><h3 className="text-sm font-semibold text-slate-700">{title}</h3><p className="mt-1 text-xs text-slate-400">需要正式数据后生成</p></div>)}</div></InstitutionV11Surface><InstitutionV11Surface title="证据与假设" description="生成策略前必须满足"><div className="space-y-2 p-4">{['稳定消费事实', '客户分群口径', '预约与随访聚合', '资源与排班数据', 'Evidence 可追溯性'].map((item) => <div key={item} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-600"><CircleDashed aria-hidden="true" className="h-4 w-4 text-slate-400" />{item}<span className="ml-auto text-slate-400">未满足</span></div>)}</div></InstitutionV11Surface></div></div>
        ) : (
          <div><div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">{metrics.map((metric) => <InstitutionV11UnavailableValue key={metric} label={metric} source="正式聚合未开放" icon={BarChart3} />)}</div><div className="grid gap-4 border-t border-slate-100 p-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(300px,0.6fr)]"><InstitutionV11Surface title="近期业务趋势" description="统计口径：当前无可验证聚合"><div className="grid min-h-64 place-items-center bg-[linear-gradient(to_right,#e8edf4_1px,transparent_1px),linear-gradient(to_bottom,#e8edf4_1px,transparent_1px)] bg-[size:48px_48px]"><div className="text-center"><Activity aria-hidden="true" className="mx-auto h-6 w-6 text-slate-300" /><p className="mt-2 text-xs text-slate-400">趋势数据不可用</p></div></div><div className="border-t border-slate-100 p-3"><InstitutionV11Freshness observedAt={null} source="Analytics Reader" /></div></InstitutionV11Surface><InstitutionV11Surface title="数据质量"><div className="space-y-2 p-4">{['数据来源', '统计口径', '更新时间', '当前新鲜度'].map((label) => <div key={label} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs"><span className="text-slate-500">{label}</span><span className="font-medium text-slate-400">未获得可信结果</span></div>)}</div></InstitutionV11Surface></div></div>
        )}
      </div>
    </div>
  );
}

function ManagementCapabilityPage({ pageLabel, routeId }: Readonly<{ pageLabel: string; routeId: CapabilityOffRouteIdV11 }>) {
  const dataPage = routeId.startsWith('system_data');
  const [activeTab, setActiveTab] = useState(dataPage ? 'sync' : 'connections');
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const tabs = [{ id: 'organization', label: '机构与成员' }, { id: 'security', label: '权限与安全' }, { id: 'connections', label: '系统接入' }, { id: 'sync', label: '数据与同步' }, { id: 'ai', label: 'AI 与自动化' }, { id: 'audit', label: '审计与日志' }, { id: 'settings', label: '基础设置' }] as const;
  const wizardSteps = ['基础信息', '接入模式', '技术文档', '鉴权与网络', 'Capability 探测', '字段映射', '连接测试', '契约测试', 'UAT', '正式启用'] as const;
  const connectorCards = [
    { title: 'HIS', icon: Network, state: '等待外部契约', detail: '真实 HIS 连接与 mutation 均关闭' },
    { title: '医院数据库', icon: Database, state: '未连接', detail: '不建立数据库连接，不执行查询或写入' },
    { title: '企业微信', icon: ShieldCheck, state: '待管理员授权', detail: 'CorpID / AgentID / Secret 不进入前端持久化' },
    { title: '个人微信', icon: MonitorSmartphone, state: 'VENDOR_DEPENDENT', detail: '扫码、心跳与在线状态依赖供应商 Connector' },
  ] as const;
  return (
    <div className="space-y-4">
      <InstitutionV11PageHeader eyebrow="MANAGEMENT CENTER" title="管理中心" description="统一治理机构、权限、HIS/数据库/微信接入、数据同步、AI自动化与审计。" breadcrumbs={[{ label: '机构端', href: '/hospital' }, { label: '管理中心' }, { label: pageLabel }]} state={dataPage ? 'EXTERNAL_CONTRACT_REQUIRED' : 'NOT_CONFIGURED'} />
      <InstitutionV11Surface>
        <div className="overflow-x-auto"><InstitutionV11Tabs label="管理中心页面" items={tabs} activeId={activeTab} onChange={setActiveTab} /></div>
        {activeTab === 'connections' ? (
          <div className="p-4"><InstitutionV11CapabilityBanner title="Connector能力按资料 → 连通 → 契约测试 → UAT → 正式启用逐级验证；绿色状态不代表所有能力均已开放。" description="测试连接、同步、扫码登录、真实消息和真实 AI Provider 调用均不可执行。" state="NOT_CONFIGURED" source="Capability Authority / Entitlement / Connector contracts" /><div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{connectorCards.map(({ title, icon: Icon, state, detail }) => <article key={title} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-start gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-blue-50 text-blue-600"><Icon aria-hidden="true" className="h-5 w-5" /></span><div><h2 className="text-[16px] font-semibold text-slate-900">{title === 'HIS' ? '医院HIS' : title === '医院数据库' ? '业务数据库' : title}</h2><p className="mt-1 text-[11px] text-slate-400">{detail}</p></div><span className="ml-auto rounded-lg border border-amber-100 bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-700">{state}</span></div><div className="mt-4 grid grid-cols-2 gap-2">{['客户资料读取', '预约读取', '治疗记录读取', '消息收发'].map((capability, index) => <div key={capability} className="flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-2 text-[11px] text-slate-600"><span>{capability}</span><span className={index < 2 ? 'text-emerald-600' : 'text-slate-400'}>{index < 2 ? '支持' : '未开放'}</span></div>)}</div><p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-400">{title === '企业微信' ? 'Secret 不进入前端持久化、URL 或日志' : title === '个人微信' ? '需要供应商 SDK、授权协议与合规说明' : '真实连接与写入继续关闭'}</p><div className="mt-3 flex gap-2"><InstitutionV11Button>查看详情</InstitutionV11Button>{title === 'HIS' ? <InstitutionV11Button ariaLabel="接入向导" icon={Waypoints} tone="primary" onClick={() => setWizardOpen(true)}>接入向导</InstitutionV11Button> : <InstitutionV11Button tone="primary" disabled disabledReason="真实外部连接未授权">开始接入</InstitutionV11Button>}</div></article>)}</div><h2 className="sr-only">Capability Matrix</h2></div>
        ) : activeTab === 'sync' ? (
          <div className="grid gap-4 p-4 xl:grid-cols-[260px_minmax(0,1fr)]"><aside className="space-y-2">{['字段映射', '同步任务', '同步日志', '数据冲突', '预约冲突'].map((label, index) => <button key={label} type="button" className={cn('flex w-full items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-xs', index === 0 ? 'border-blue-200 bg-blue-50 font-semibold text-blue-700' : 'border-slate-200 text-slate-600')}><GitBranch aria-hidden="true" className="h-4 w-4" />{label}</button>)}</aside><InstitutionV11Surface title="字段映射" description="Mapping contract 已识别，真实数据源与同步执行未开放"><SkeletonRows columns={5} rows={7} /><CapabilityFootnote /></InstitutionV11Surface></div>
        ) : activeTab === 'ai' ? (
          <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">{['会话 AI', '随访 AI', '预约助手 AI', '客户画像 AI', '经营机会 AI', '机构自动化安全档位'].map((title) => <article key={title} className="rounded-xl border border-slate-200 p-4"><div className="flex items-center justify-between"><Bot aria-hidden="true" className="h-5 w-5 text-violet-600" /><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">关闭</span></div><h2 className="mt-3 text-sm font-semibold text-slate-900">{title}</h2><p className="mt-1 text-xs leading-5 text-slate-500">Provider、知识访问范围与人工接管规则未完成正式配置。</p></article>)}</div>
        ) : activeTab === 'audit' ? (
          <div><div className="flex flex-wrap gap-2 border-b border-slate-100 p-4">{['操作审计', '敏感字段访问', 'AI Evidence', '消息触达', '同步日志', '登录安全'].map((label) => <button key={label} type="button" className="rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-600">{label}</button>)}</div><SkeletonRows columns={5} rows={7} /><CapabilityFootnote /></div>
        ) : (
          <InstitutionV11EmptyState icon={activeTab === 'organization' ? UsersRound : activeTab === 'security' ? KeyRound : Settings2} title={`${tabs.find((item) => item.id === activeTab)?.label ?? '配置'}能力未开放`} description="页面边界和依赖条件已完整呈现；本任务不新增配置 Writer、Secret 持久化或平台控制面。" />
        )}
      </InstitutionV11Surface>
      <InstitutionV11Modal open={wizardOpen} onClose={() => setWizardOpen(false)} title="HIS 接入向导" footer={<div className="flex justify-end gap-2"><InstitutionV11Button onClick={() => setWizardOpen(false)}>取消</InstitutionV11Button><InstitutionV11Button tone="primary" onClick={() => setWizardStep((step) => Math.min(wizardSteps.length - 1, step + 1))}>下一步</InstitutionV11Button></div>}>
        <div className="flex gap-1 overflow-x-auto pb-4">{wizardSteps.map((step, index) => <button key={step} type="button" onClick={() => setWizardStep(index)} className={cn('min-w-[96px] rounded-lg border px-2 py-2 text-left text-[10px]', index === wizardStep ? 'border-blue-300 bg-blue-50 font-semibold text-blue-800' : index < wizardStep ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-500')}><span className="mr-1">{index + 1}.</span>{step}</button>)}</div><div className="grid gap-3 sm:grid-cols-2"><DisabledField label="连接器" value="医院HIS" /><DisabledField label="技术状态" value="CONTRACT_VERIFIED" /></div><div className="mt-4 rounded-lg bg-slate-50 px-3 py-3 text-xs text-slate-500">当前步骤：{wizardSteps[wizardStep]}。确认 HIS 厂商、版本、测试环境、接入方式及预约读写能力。</div><p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">向导不会收集、保存或回显 Secret；连接测试、契约测试、UAT 与正式启用仅展示流程状态。</p>
      </InstitutionV11Modal>
    </div>
  );
}

export function InstitutionV11CapabilityPage({
  routeId,
  pageLabel,
}: Readonly<{
  routeId: CapabilityOffRouteIdV11;
  pageLabel: string;
}>) {
  const state = routeCapabilityState[routeId] ?? 'CAPABILITY_OFF';
  const content = useMemo<ReactNode>(() => {
    if (routeId.startsWith('customer_')) return <CustomerCapabilityPage pageLabel={pageLabel} routeId={routeId} />;
    if (routeId.startsWith('conversation_')) return <ConversationCapabilityPage pageLabel={pageLabel} />;
    if (routeId.startsWith('care_')) return <CareCapabilityPage pageLabel={pageLabel} routeId={routeId} />;
    if (routeId.startsWith('knowledge_')) return <KnowledgeCapabilityPage pageLabel={pageLabel} routeId={routeId} />;
    if (routeId.startsWith('analytics_')) return <AnalyticsCapabilityPage pageLabel={pageLabel} routeId={routeId} />;
    if (routeId.startsWith('system_')) return <ManagementCapabilityPage pageLabel={pageLabel} routeId={routeId} />;
    return null;
  }, [pageLabel, routeId]);

  if (content) return <div data-restoration-state="RESTORED" data-capability-state={state}>{content}</div>;

  return (
    <InstitutionV11Surface>
      <InstitutionV11EmptyState title={`${pageLabel}能力未开放`} description="页面尚未获得可信业务契约；不会展示模拟数据或受控操作。" />
      <CapabilityFootnote />
    </InstitutionV11Surface>
  );
}
