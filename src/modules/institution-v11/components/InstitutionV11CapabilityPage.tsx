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

function CustomerCapabilityPage({ pageLabel }: Readonly<{ pageLabel: string }>) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('list');
  const [importStep, setImportStep] = useState(0);
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
        title="客户页面已还原，正式客户数据能力未开放"
        description="高级筛选中仅 lifecycle 与 priority 有正式服务端查询契约；其他条件保持禁用，不会进行客户端伪筛选。"
        state="CAPABILITY_OFF"
        source="Customer Canonical Owner / Capability Authority"
      />

      <InstitutionV11Surface>
        <div className="overflow-x-auto"><InstitutionV11Tabs label="客户中心页面" items={tabs} activeId={activeTab} onChange={setActiveTab} /></div>
        {activeTab === 'list' ? (
          <>
            <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                <div className="relative min-w-[240px] flex-1 lg:max-w-sm">
                  <Search aria-hidden="true" className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input disabled aria-label="搜索客户" placeholder="搜索姓名、手机号或客户编号" className="h-9 w-full rounded-lg border border-slate-200 bg-slate-100 pl-9 pr-3 text-sm placeholder:text-slate-400" />
                </div>
                <button type="button" className="h-9 rounded-full border border-blue-200 bg-blue-50 px-3 text-xs font-semibold text-blue-700">全部客户</button>
                <button type="button" disabled title="需要服务端筛选字段" className="h-9 rounded-full border border-slate-200 bg-white px-3 text-xs text-slate-400">今日新增</button>
                <button type="button" disabled title="需要 Follow-up Projection" className="h-9 rounded-full border border-slate-200 bg-white px-3 text-xs text-slate-400">待随访</button>
              </div>
              <div className="flex flex-wrap gap-2">
                <InstitutionV11Button icon={Filter} onClick={() => setDrawerOpen(true)}>高级筛选</InstitutionV11Button>
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
        title="高级筛选"
        description="仅正式服务端查询字段可以提交；其余分组明确标记当前不支持。"
        footer={<div className="flex justify-end gap-2"><InstitutionV11Button onClick={() => setDrawerOpen(false)}>重置</InstitutionV11Button><InstitutionV11Button tone="primary" onClick={() => setDrawerOpen(false)}>查询</InstitutionV11Button></div>}
      >
        <div className="space-y-3">
          {unsupportedFilterGroups.map((group, index) => (
            <details key={group} open={index < 2} className="rounded-xl border border-slate-200 bg-white">
              <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40">{group}</summary>
              <div className="grid gap-3 border-t border-slate-100 p-4 sm:grid-cols-2">
                {group === '基础资料' ? (
                  <>
                    <DisabledField label="关键词" />
                    <DisabledField label="客户来源" />
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
    <div className="space-y-4">
      <InstitutionV11PageHeader
        eyebrow="CONVERSATION WORKBENCH"
        title={pageLabel}
        description="四栏会话工作区已经还原；真实微信登录、消息入站、消息发送与 AI 自动回复继续关闭。"
        breadcrumbs={[{ label: '机构端', href: '/hospital' }, { label: '会话工作台' }, { label: pageLabel }]}
        state="NOT_CONFIGURED"
        actions={<InstitutionV11Button icon={RefreshCw} disabled disabledReason="Connector 未配置">刷新渠道状态</InstitutionV11Button>}
      />
      <InstitutionV11CapabilityBanner title="正式渠道与消息能力尚未配置" description="个人微信依赖供应商 Connector；企业微信需要机构管理员完成授权。界面不模拟在线状态、未读数或发送成功。" state="NOT_CONFIGURED" source="Conversation Canonical Owner / MessageDelivery / Connector Authority" />
      <section className="grid min-h-[610px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm xl:grid-cols-[170px_290px_minmax(400px,1fr)_300px]">
        <aside className="border-b border-slate-200 bg-slate-950 p-3 text-slate-200 xl:border-b-0 xl:border-r xl:border-slate-800">
          <div className="flex items-center justify-between px-2 py-2">
            <h2 className="text-sm font-semibold text-white">微信账号</h2>
            <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] text-amber-200">未配置</span>
          </div>
          <div className="mt-2 space-y-1">
            {[
              ['全部账号', MonitorSmartphone, '未知'],
              ['个人微信', WifiOff, '供应商依赖'],
              ['企业微信', ShieldCheck, '待管理员授权'],
            ].map(([label, Icon, status]) => (
              <button key={String(label)} type="button" className="w-full rounded-lg px-2 py-2.5 text-left hover:bg-white/5">
                <span className="flex items-center gap-2 text-xs font-medium"><Icon aria-hidden="true" className="h-4 w-4 text-slate-400" />{String(label)}</span>
                <span className="mt-1 block pl-6 text-[10px] leading-4 text-slate-500">{String(status)}</span>
              </button>
            ))}
          </div>
        </aside>
        <aside className="border-b border-slate-200 xl:border-b-0 xl:border-r">
          <div className="border-b border-slate-100 p-3">
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
            <InstitutionV11Button icon={UserRoundCog} disabled disabledReason="需要正式会话对象权限">人工接管</InstitutionV11Button>
          </header>
          <div className="grid flex-1 place-items-center bg-slate-50/60 p-6 text-center">
            <div><span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-white text-slate-400 shadow-sm"><MessageSquareText aria-hidden="true" className="h-5 w-5" /></span><h3 className="mt-3 text-sm font-semibold text-slate-900">选择正式会话后查看消息流</h3><p className="mt-1 text-xs text-slate-500">不会使用非正式记录补成聊天正文。</p></div>
          </div>
          <footer className="border-t border-slate-200 bg-white p-3">
            <div className="flex gap-2 pb-2 text-slate-400"><button type="button" disabled title="真实附件发送关闭"><Upload aria-hidden="true" className="h-4 w-4" /></button><button type="button" disabled title="知识引用需要已发布知识与对象权限"><BookOpenText aria-hidden="true" className="h-4 w-4" /></button><button type="button" disabled title="AI Provider 未配置"><Sparkles aria-hidden="true" className="h-4 w-4" /></button></div>
            <div className="flex gap-2"><textarea disabled aria-label="会话输入" placeholder="真实消息发送未开放" className="min-h-16 flex-1 resize-none rounded-lg border border-slate-200 bg-slate-100 p-3 text-sm" /><InstitutionV11Button tone="primary" disabled disabledReason="MessageDelivery 未开放">发送</InstitutionV11Button></div>
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
  const days = ['一', '二', '三', '四', '五', '六', '日'];
  const dates = Array.from({ length: 35 }, (_, index) => index - 2);
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[820px]">
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">{days.map((day) => <div key={day} className="px-3 py-2 text-center text-xs font-semibold text-slate-500">周{day}</div>)}</div>
        <div className="grid grid-cols-7">{dates.map((date, index) => <button key={index} type="button" disabled title="Availability 能力未开放" className="min-h-24 border-b border-r border-slate-100 p-2 text-left last:border-r-0 disabled:cursor-not-allowed disabled:bg-slate-50/60"><span className={cn('grid h-6 w-6 place-items-center rounded-full text-xs', date === 15 ? 'bg-blue-600 text-white' : date > 0 && date < 32 ? 'text-slate-600' : 'text-slate-300')}>{date > 0 && date < 32 ? date : ''}</span><span className="mt-4 block text-[10px] leading-4 text-slate-400">Availability 未开放</span></button>)}</div>
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
      <InstitutionV11PageHeader eyebrow="APPOINTMENT & FOLLOW-UP" title={pageLabel} description="预约、随访任务与消息状态保持分离；Availability、HIS mutation 与真实消息发送继续关闭。" breadcrumbs={[{ label: '机构端', href: '/hospital' }, { label: '预约与随访' }, { label: pageLabel }]} state="CAPABILITY_OFF" actions={<><InstitutionV11DateRangeControl label="本周" /><InstitutionV11Button icon={Plus} tone="primary" disabled disabledReason="正式 Writer 或 Availability 未开放">新建</InstitutionV11Button></>} />
      <InstitutionV11CapabilityBanner title={planPage ? '随访方案 Writer 未开放' : 'Availability 与 HIS mutation 未开放'} description={planPage ? '设计器的节点、规则、发布与影响预览结构已经还原，但草稿不会保存到浏览器或临时 JSON。' : '日历和时间槽保留完整结构；创建、修改、取消和 HIS 回写均显示明确禁用原因。'} state="CAPABILITY_OFF" source="Appointment / Follow-up Canonical Owner" />
      <InstitutionV11Surface>
        <div className="overflow-x-auto"><InstitutionV11Tabs label="预约与随访页面" items={pageTabs} activeId={view} onChange={setView} /></div>
        {view === 'designer' ? (
          <div className="grid min-h-[590px] lg:grid-cols-[240px_minmax(0,1fr)_300px]">
            <aside className="border-b border-slate-200 p-4 lg:border-b-0 lg:border-r">
              <div className="flex items-center justify-between"><h2 className="text-sm font-semibold text-slate-900">方案列表</h2><button disabled title="Writer 未开放" className="text-slate-300"><Plus aria-hidden="true" className="h-4 w-4" /></button></div>
              <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3"><p className="text-xs font-semibold text-blue-900">未保存方案</p><p className="mt-1 text-[11px] text-blue-700">版本 -- · 草稿不可保存</p></div>
              <p className="mt-4 text-[11px] leading-5 text-slate-500">支持从模板创建、复制、查看适用项目与运行情况；当前无正式数据。</p>
            </aside>
            <div className="border-b border-slate-200 p-4 lg:border-b-0 lg:border-r">
              <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-sm font-semibold text-slate-900">可视化时间轴</h2><p className="mt-1 text-xs text-slate-500">相对时间、发送窗口与渠道策略</p></div><InstitutionV11Button icon={Plus} disabled disabledReason="方案 Writer 未开放">添加节点</InstitutionV11Button></div>
              <div className="relative mt-6 space-y-5 before:absolute before:bottom-4 before:left-[17px] before:top-4 before:w-px before:bg-slate-200">
                {[
                  ['触发条件', '治疗完成后进入方案'],
                  ['相对时间', 'T + -- 天 / 发送窗口未配置'],
                  ['结构化问卷', '问题、风险规则与无回复策略未配置'],
                  ['完成条件', '完成与终止条件未配置'],
                ].map(([title, description], index) => <div key={title} className="relative flex gap-3"><span className="z-10 grid h-9 w-9 shrink-0 place-items-center rounded-full border border-slate-200 bg-white text-xs font-semibold text-slate-500">{index + 1}</span><div className="flex-1 rounded-xl border border-slate-200 bg-slate-50/60 p-3"><h3 className="text-xs font-semibold text-slate-800">{title}</h3><p className="mt-1 text-[11px] leading-5 text-slate-500">{description}</p></div></div>)}
              </div>
            </div>
            <aside className="p-4"><h2 className="text-sm font-semibold text-slate-900">节点配置</h2><div className="mt-4 grid gap-3"><DisabledField label="适用范围" /><DisabledField label="渠道策略" /><DisabledField label="账号策略" /><DisabledField label="固定知识版本" /><DisabledField label="触达频控" /><DisabledField label="冲突检查" /></div><div className="mt-5 grid gap-2"><InstitutionV11Button icon={Activity} disabled disabledReason="模拟执行契约未开放">模拟测试</InstitutionV11Button><InstitutionV11Button icon={Upload} tone="primary" disabled disabledReason="发布 Writer 未开放">发布版本</InstitutionV11Button></div></aside>
          </div>
        ) : view === 'followups' ? (
          <div><div className="flex flex-wrap gap-1 border-b border-slate-100 p-3">{['待执行', '进行中', '待人工', '已完成', '异常'].map((label, index) => <button key={label} type="button" className={cn('rounded-full px-3 py-1.5 text-xs', index === 0 ? 'bg-blue-50 font-semibold text-blue-700' : 'text-slate-500')}>{label}</button>)}</div><SkeletonRows columns={5} rows={7} /><CapabilityFootnote /></div>
        ) : (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-3"><div className="flex gap-1"><button type="button" className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">日历</button><button type="button" className="rounded-lg px-3 py-1.5 text-xs text-slate-500">列表</button><button type="button" className="rounded-lg px-3 py-1.5 text-xs text-slate-500">日</button><button type="button" className="rounded-lg px-3 py-1.5 text-xs text-slate-500">周</button></div><div className="flex items-center gap-1"><button type="button" aria-label="上一周" className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200"><ChevronLeft aria-hidden="true" className="h-4 w-4" /></button><span className="px-3 text-sm font-semibold text-slate-800">机构时区 · 当前周期</span><button type="button" aria-label="下一周" className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200"><ChevronRight aria-hidden="true" className="h-4 w-4" /></button><InstitutionV11Button icon={PanelRightOpen} onClick={() => setDrawerOpen(true)}>空闲时间</InstitutionV11Button></div></div>
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
      <InstitutionV11PageHeader eyebrow="KNOWLEDGE BASE" title={pageLabel} description="沿用唯一 Knowledge Canonical Owner；未发布知识不会进入正式 AI 上下文。" breadcrumbs={[{ label: '机构端', href: '/hospital' }, { label: '知识库', href: '/hospital/knowledge' }, { label: pageLabel }]} state={routeId === 'knowledge_search' || routeId === 'knowledge_qa' ? 'EXTERNAL_CONTRACT_REQUIRED' : 'CAPABILITY_OFF'} actions={<><InstitutionV11Button icon={Upload} disabled disabledReason="知识上传 Writer 未开放">上传文件</InstitutionV11Button><InstitutionV11Button icon={Plus} tone="primary" disabled disabledReason="知识 Writer 未开放">新建知识</InstitutionV11Button></>} />
      <InstitutionV11CapabilityBanner title="知识编辑、发布与 AI 使用能力未开放" description="页面完整呈现类型、分类、权限、版本、发布状态和 AI 使用范围；不会复制第二套知识表或 Writer。" state="CAPABILITY_OFF" source="Knowledge Canonical Owner / Published metadata Reader" />
      {editor ? (
        <section className="grid min-h-[620px] overflow-hidden rounded-xl border border-slate-200 bg-white lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="border-b border-slate-200 lg:border-b-0 lg:border-r"><header className="flex items-center justify-between border-b border-slate-100 px-4 py-3"><div><h2 className="text-sm font-semibold text-slate-900">正文编辑</h2><p className="mt-0.5 text-[11px] text-slate-500">草稿不可保存 · Published only</p></div><div className="flex gap-2"><InstitutionV11Button disabled disabledReason="Knowledge Writer 未开放">保存草稿</InstitutionV11Button><InstitutionV11Button tone="primary" disabled disabledReason="发布流程未开放">发布</InstitutionV11Button></div></header><div className="p-5"><div className="min-h-[460px] rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-6"><h1 className="text-xl font-bold text-slate-300">知识标题</h1><p className="mt-4 text-sm leading-7 text-slate-400">正文编辑区已还原。当前未读取知识正文，也不会将示例文本保存为正式知识内容。</p></div></div></div>
          <aside className="p-4"><h2 className="text-sm font-semibold text-slate-900">知识属性</h2><div className="mt-4 grid gap-3"><DisabledField label="类型" /><DisabledField label="分类" /><DisabledField label="适用项目" /><DisabledField label="适用场景" /><DisabledField label="角色权限" /><DisabledField label="AI 检索权限" /><DisabledField label="AI 生成权限" /><DisabledField label="自动发送权限" /><DisabledField label="来源" /><DisabledField label="版本 / 发布状态" /></div></aside>
        </section>
      ) : (
        <InstitutionV11Surface>
          <div className="overflow-x-auto"><InstitutionV11Tabs label="知识类型" items={tabs} activeId={activeType} onChange={setActiveType} /></div>
          <div className="grid min-h-[520px] lg:grid-cols-[220px_minmax(0,1fr)]"><aside className="border-b border-slate-200 p-4 lg:border-b-0 lg:border-r"><h2 className="text-sm font-semibold text-slate-900">知识空间</h2><nav className="mt-3 space-y-1">{['全部知识', '项目知识', '服务 SOP', '常见问题', '话术模板'].map((label, index) => <button key={label} type="button" className={cn('flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs', index === 0 ? 'bg-blue-50 font-semibold text-blue-700' : 'text-slate-600 hover:bg-slate-50')}><BookOpenText aria-hidden="true" className="h-4 w-4" />{label}</button>)}</nav><div className="mt-5 border-t border-slate-100 pt-4"><h3 className="text-xs font-semibold text-slate-600">分类与标签</h3><p className="mt-2 text-[11px] leading-5 text-slate-400">正式分类 Reader 未开放</p></div></aside><div><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4"><div className="relative min-w-[260px] flex-1 max-w-lg"><Search aria-hidden="true" className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input disabled placeholder="搜索标题、标签或正文" className="h-9 w-full rounded-lg border border-slate-200 bg-slate-100 pl-9 pr-3 text-sm" /></div><div className="flex gap-2"><InstitutionV11Button icon={ListFilter} disabled disabledReason="正式筛选 Reader 未开放">筛选</InstitutionV11Button><InstitutionV11Button icon={Sparkles} disabled disabledReason="AI Provider 未配置">AI 检索测试</InstitutionV11Button></div></div><SkeletonRows columns={5} rows={7} /><CapabilityFootnote /></div></div>
        </InstitutionV11Surface>
      )}
    </div>
  );
}

function AnalyticsCapabilityPage({ pageLabel }: Readonly<{ pageLabel: string }>) {
  const [activeTab, setActiveTab] = useState('overview');
  const tabs = [{ id: 'overview', label: '经营总览' }, { id: 'customers', label: '客户分析' }, { id: 'appointments', label: '预约与服务' }, { id: 'followups', label: '随访与触达' }, { id: 'ai', label: 'AI 与自动化' }, { id: 'strategy', label: '经营策略' }] as const;
  const metrics = ['客户规模', '新增客户', '预约完成', '随访触达', '经营机会', '转化率'];
  return (
    <div className="space-y-4">
      <InstitutionV11PageHeader eyebrow="BUSINESS ANALYTICS" title={pageLabel} description="仅展示当前真实聚合能够证明的指标；每项指标同时标明来源、统计口径、更新时间与新鲜度。" breadcrumbs={[{ label: '机构端', href: '/hospital' }, { label: '经营分析' }, { label: pageLabel }]} state="CAPABILITY_OFF" actions={<><InstitutionV11DateRangeControl /><InstitutionV11Button icon={RefreshCw} disabled disabledReason="聚合 Reader 未开放">Soft Refresh</InstitutionV11Button></>} />
      <InstitutionV11CapabilityBanner title={activeTab === 'strategy' ? '经营策略模型未开放' : '当前页面缺少可验证聚合'} description={activeTab === 'strategy' ? '可以查看生成条件、所需数据、证据与假设边界，但不会生成上月诊断或下月策略。' : '指标结构已还原；没有正式聚合时统一显示不可用，不使用演示营收、毛利、转化率或营销策略。'} state="CAPABILITY_OFF" source="Analytics Canonical Aggregation" />
      <InstitutionV11Surface>
        <div className="overflow-x-auto"><InstitutionV11Tabs label="经营分析页面" items={tabs} activeId={activeTab} onChange={setActiveTab} /></div>
        {activeTab === 'strategy' ? (
          <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(300px,0.7fr)]"><div className="grid gap-3 sm:grid-cols-2">{['上月经营诊断', '下月目标建议', '重点项目策略', '重点人群策略', '套餐组合策略', '营销日历', '资源与排班建议', '风险与注意事项'].map((title) => <article key={title} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4"><div className="flex items-center justify-between gap-2"><h2 className="text-sm font-semibold text-slate-800">{title}</h2><LockKeyhole aria-hidden="true" className="h-4 w-4 text-slate-400" /></div><p className="mt-2 text-xs leading-5 text-slate-500">经营策略模型未开放；当前不生成建议。</p></article>)}</div><div className="space-y-4"><InstitutionV11Surface title="证据与假设" description="生成策略前必须满足"><div className="space-y-2 p-4">{['稳定消费事实', '客户分群口径', '预约与随访聚合', '资源与排班数据', 'Evidence 可追溯性'].map((item) => <div key={item} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-600"><CircleDashed aria-hidden="true" className="h-4 w-4 text-slate-400" />{item}<span className="ml-auto text-slate-400">未满足</span></div>)}</div></InstitutionV11Surface><InstitutionV11Surface title="策略任务闭环"><InstitutionV11EmptyState icon={Workflow} title="任务 Writer 未开放" description="不会把视觉策略卡片保存为正式任务。" /></InstitutionV11Surface></div></div>
        ) : (
          <div><div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">{metrics.map((metric) => <InstitutionV11UnavailableValue key={metric} label={metric} source="正式聚合未开放" icon={BarChart3} />)}</div><div className="grid gap-4 border-t border-slate-100 p-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(300px,0.6fr)]"><InstitutionV11Surface title="近期业务趋势" description="统计口径：当前无可验证聚合"><div className="grid min-h-64 place-items-center bg-[linear-gradient(to_right,#e8edf4_1px,transparent_1px),linear-gradient(to_bottom,#e8edf4_1px,transparent_1px)] bg-[size:48px_48px]"><div className="text-center"><Activity aria-hidden="true" className="mx-auto h-6 w-6 text-slate-300" /><p className="mt-2 text-xs text-slate-400">趋势数据不可用</p></div></div><div className="border-t border-slate-100 p-3"><InstitutionV11Freshness observedAt={null} source="Analytics Reader" /></div></InstitutionV11Surface><InstitutionV11Surface title="数据质量"><div className="space-y-2 p-4">{['数据来源', '统计口径', '更新时间', '当前新鲜度'].map((label) => <div key={label} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs"><span className="text-slate-500">{label}</span><span className="font-medium text-slate-400">未获得可信结果</span></div>)}</div></InstitutionV11Surface></div></div>
        )}
      </InstitutionV11Surface>
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
      <InstitutionV11PageHeader eyebrow="MANAGEMENT CENTER" title={pageLabel} description="仅呈现机构级配置与诊断；Connector 技术能力、机构授权和 Entitlement 分开显示。" breadcrumbs={[{ label: '机构端', href: '/hospital' }, { label: '管理中心' }, { label: pageLabel }]} state={dataPage ? 'EXTERNAL_CONTRACT_REQUIRED' : 'NOT_CONFIGURED'} actions={<InstitutionV11Button icon={Settings2} disabled disabledReason="本任务不开放机构配置 Writer">保存设置</InstitutionV11Button>} />
      <InstitutionV11CapabilityBanner title="外部 Connector 保持关闭" description="测试连接、同步、扫码登录、真实消息和真实 AI Provider 调用均不可执行；Secret 不回显、不进入 URL、日志或浏览器存储。" state={dataPage ? 'EXTERNAL_CONTRACT_REQUIRED' : 'NOT_CONFIGURED'} source="Capability Authority / Entitlement / Connector contracts" />
      <InstitutionV11Surface>
        <div className="overflow-x-auto"><InstitutionV11Tabs label="管理中心页面" items={tabs} activeId={activeTab} onChange={setActiveTab} /></div>
        {activeTab === 'connections' ? (
          <div className="p-4"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{connectorCards.map(({ title, icon: Icon, state, detail }) => <article key={title} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-600"><Icon aria-hidden="true" className="h-5 w-5" /></span><span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">{state}</span></div><h2 className="mt-4 text-sm font-semibold text-slate-900">{title}</h2><p className="mt-1.5 min-h-10 text-xs leading-5 text-slate-500">{detail}</p><div className="mt-4 flex gap-2">{title === 'HIS' ? <InstitutionV11Button icon={Waypoints} onClick={() => setWizardOpen(true)}>接入向导</InstitutionV11Button> : null}<InstitutionV11Button icon={CloudCog} disabled disabledReason="真实外部连接未授权">测试连接</InstitutionV11Button></div></article>)}</div><InstitutionV11Surface className="mt-4" title="Capability Matrix" description="技术能力与机构授权分别判定"><div className="overflow-x-auto"><table className="min-w-[760px] w-full text-left text-xs"><thead className="bg-slate-50 text-slate-500"><tr>{['Connector', '读取', '写入', '机构授权', '同步状态', '错误状态'].map((label) => <th key={label} className="px-4 py-3 font-semibold">{label}</th>)}</tr></thead><tbody>{connectorCards.map((item) => <tr key={item.title} className="border-t border-slate-100"><td className="px-4 py-3 font-semibold text-slate-800">{item.title}</td><td className="px-4 py-3 text-slate-500">关闭</td><td className="px-4 py-3 text-slate-500">关闭</td><td className="px-4 py-3 text-amber-700">未完成</td><td className="px-4 py-3 text-slate-400">未运行</td><td className="px-4 py-3 text-slate-400">无可信诊断</td></tr>)}</tbody></table></div></InstitutionV11Surface></div>
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
      <InstitutionV11Drawer open={wizardOpen} onClose={() => setWizardOpen(false)} title="HIS 接入向导" description="十步接入流程已还原；所有真实连接与凭证操作保持关闭。" footer={<div className="flex items-center justify-between"><InstitutionV11Button onClick={() => setWizardStep((step) => Math.max(0, step - 1))}>上一步</InstitutionV11Button><span className="text-xs text-slate-500">{wizardStep + 1} / {wizardSteps.length}</span><InstitutionV11Button tone="primary" onClick={() => setWizardStep((step) => Math.min(wizardSteps.length - 1, step + 1))}>下一步</InstitutionV11Button></div>}>
        <div className="grid grid-cols-2 gap-2">{wizardSteps.map((step, index) => <button key={step} type="button" onClick={() => setWizardStep(index)} className={cn('rounded-lg border px-3 py-2 text-left text-xs', index === wizardStep ? 'border-blue-300 bg-blue-50 font-semibold text-blue-800' : index < wizardStep ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-500')}><span className="mr-1.5 text-[10px]">{index + 1}</span>{step}</button>)}</div><div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-5"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-white text-slate-500"><Network aria-hidden="true" className="h-5 w-5" /></span><div><h3 className="text-sm font-semibold text-slate-900">{wizardSteps[wizardStep]}</h3><p className="mt-1 text-xs text-slate-500">真实 HIS 接入、数据库连接与鉴权验证未授权。</p></div></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><DisabledField label="配置项一" /><DisabledField label="配置项二" /></div><p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">向导不会收集、保存或回显 Secret；连接测试、契约测试、UAT 与正式启用仅展示流程状态。</p></div>
      </InstitutionV11Drawer>
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
    if (routeId.startsWith('customer_')) return <CustomerCapabilityPage pageLabel={pageLabel} />;
    if (routeId.startsWith('conversation_')) return <ConversationCapabilityPage pageLabel={pageLabel} />;
    if (routeId.startsWith('care_')) return <CareCapabilityPage pageLabel={pageLabel} routeId={routeId} />;
    if (routeId.startsWith('knowledge_')) return <KnowledgeCapabilityPage pageLabel={pageLabel} routeId={routeId} />;
    if (routeId.startsWith('analytics_')) return <AnalyticsCapabilityPage pageLabel={pageLabel} />;
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
