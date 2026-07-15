'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BriefcaseBusiness,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  PanelLeftClose,
  PanelLeftOpen,
  Route,
  ShieldCheck,
  ShieldQuestion,
  Sparkles,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react';
import type { AuthSessionPayload } from '@/modules/auth/domain/session';
import { isAuthRole } from '@/modules/auth/domain/session';
import { LogoutButton } from '@/modules/auth/components/LogoutButton';
import { AppointmentCenterShell } from '@/modules/institution/components/AppointmentCenterShell';
import { AiConversationWorkbenchShell } from '@/modules/institution/components/AiConversationWorkbenchShell';
import { InstitutionAiServiceUsageShell } from '@/modules/institution/components/InstitutionAiServiceUsageShell';
import { CustomerCenterShell } from '@/modules/institution/components/CustomerCenterShell';
import { HisConnectionReadOnlyPanel } from '@/modules/institution/components/HisConnectionReadOnlyPanel';
import { InstitutionAuditEventsShell } from '@/modules/institution/components/InstitutionAuditEventsShell';
import { InstitutionKnowledgeReadonlyShell } from '@/modules/institution/components/InstitutionKnowledgeReadonlyShell';
import { OpportunityPoolShell } from '@/modules/institution/components/OpportunityPoolShell';
import {
  InstitutionPageState,
  getInstitutionPageStateFromClientError,
  type InstitutionPageStateProps,
} from '@/modules/institution/components/InstitutionPageState';
import { SmartFollowUpShell } from '@/modules/institution/components/SmartFollowUpShell';
import { TreatmentSummaryManagementShell } from '@/modules/institution/components/TreatmentSummaryManagementShell';
import { WeComCustomerMappingCandidatesReadonlyPanel } from '@/modules/institution/components/WeComCustomerMappingCandidatesReadonlyPanel';
import { WeComExternalContactReadonlyPanel } from '@/modules/institution/components/WeComExternalContactReadonlyPanel';
import type { V1KnowledgeBaseDemoReadonlyApiContractResponse } from '@/modules/knowledge-base/domain/v1-knowledge-base-demo-readonly-api-contract';
import type { V1WorkspaceDashboardReadonlyAggregationApiContractResponse } from '@/modules/workspace/domain/v1-workspace-dashboard-readonly-api-contract';
import {
  listAppointments,
  listCustomers,
  listFollowUpTasks,
  type TenantBusinessClientError,
} from '@/modules/institution/client/tenant-business-client';
import {
  institutionNavItems,
  visibleInstitutionNavItems,
} from '@/modules/workspace/domain/institution-dashboard';
import type { InstitutionViewId } from '@/modules/workspace/domain/institution-dashboard';
import {
  canAccessResource,
  type AccessContext,
} from '@/modules/security/domain/access-control';
import {
  buildInstitutionDashboardSummary,
  type InstitutionDashboardMetricKey,
  type InstitutionDashboardSummary,
} from '@/modules/workspace/domain/institution-dashboard-view-models';
import { cn } from '@/shared/utils/cn';

const statToneClasses = {
  blue: 'border-blue-200/80 bg-blue-50/80 text-blue-700',
  violet: 'border-violet-200/80 bg-violet-50/80 text-violet-700',
  emerald: 'border-emerald-200/80 bg-emerald-50/80 text-emerald-700',
  amber: 'border-amber-200/80 bg-amber-50/80 text-amber-700',
};

const metricIcons = {
  customer_total: Users,
  high_priority_customers: BriefcaseBusiness,
  pending_appointments: CalendarCheck,
  due_followups: Clock3,
  completed_followups: CheckCircle2,
  opportunity_pool: Target,
} satisfies Record<InstitutionDashboardMetricKey, typeof Users>;

const metricDestinations = {
  customer_total: 'customers',
  high_priority_customers: 'customers',
  pending_appointments: 'appointments',
  due_followups: 'followups',
  completed_followups: 'followups',
  opportunity_pool: 'opportunities',
} satisfies Record<InstitutionDashboardMetricKey, InstitutionViewId>;

const actionDestinations = {
  customer: 'customers',
  appointment: 'appointments',
  followup: 'followups',
} satisfies Record<InstitutionDashboardSummary['actionItems'][number]['source'], InstitutionViewId>;

const followUpPathAnalysisMetricItems = [
  {
    key: 'templateSuggestionCount',
    label: '模板建议数',
    helper: '模板路径建议',
    tone: 'blue',
  },
  {
    key: 'confirmedSourceTaskCount',
    label: '人工确认任务数',
    helper: '来源任务',
    tone: 'violet',
  },
  {
    key: 'completedTaskCount',
    label: '已完成任务数',
    helper: '已完成',
    tone: 'emerald',
  },
  {
    key: 'overdueTaskCount',
    label: '超时任务数',
    helper: '待处理超时',
    tone: 'amber',
  },
  {
    key: 'voidedSummaryBlockedCount',
    label: '作废摘要阻断数',
    helper: '审计阻断',
    tone: 'rose',
  },
  {
    key: 'duplicateSourceTaskConflictCount',
    label: '重复来源任务冲突数',
    helper: '审计冲突',
    tone: 'cyan',
  },
] as const;

const followUpPathAnalysisToneClasses = {
  blue: 'border-blue-200 bg-blue-50 text-blue-700',
  violet: 'border-violet-200 bg-violet-50 text-violet-700',
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  amber: 'border-amber-200 bg-amber-50 text-amber-700',
  rose: 'border-rose-200 bg-rose-50 text-rose-700',
  cyan: 'border-cyan-200 bg-cyan-50 text-cyan-700',
} satisfies Record<(typeof followUpPathAnalysisMetricItems)[number]['tone'], string>;

type KnowledgeBaseDemoReadonlyEntryState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'loaded'; response: V1KnowledgeBaseDemoReadonlyApiContractResponse };

type KnowledgeBaseDemoSearchResult = {
  resultId: string;
  title: string;
  snippet: string;
  scoreBand: 'high' | 'medium' | 'low';
  sourceKind: 'mock' | 'seed' | 'demo';
  chunkIndex: number;
  readonly: true;
};

type KnowledgeBaseDemoSearchResponse = {
  status: 'ready' | 'empty' | 'empty_query' | 'denied' | 'validation_failed';
  readonly: true;
  query: string;
  mode?: 'demo_search_mock_embedding';
  resultCount: number;
  results: KnowledgeBaseDemoSearchResult[];
};

type KnowledgeBaseDemoSearchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'loaded'; response: KnowledgeBaseDemoSearchResponse };

const knowledgeBaseDemoIdleSearchState: KnowledgeBaseDemoSearchState = { status: 'idle' };

type WorkspaceDashboardReadonlyAggregationEntryState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'loaded'; response: V1WorkspaceDashboardReadonlyAggregationApiContractResponse };

const emptyDashboardSummary = buildInstitutionDashboardSummary({
  customers: [],
  appointments: [],
  followUpTasks: [],
});

type DashboardLoadStatus = 'loading' | 'success' | 'error';
type FollowUpPathAnalysisMetricKey = (typeof followUpPathAnalysisMetricItems)[number]['key'];

type FollowUpPathAnalysisApiResponse = Record<FollowUpPathAnalysisMetricKey, number> & {
  scope: string;
  analysisAt: string;
  notes: string[];
  warnings: string[];
  dataSourceNote?: string;
  boundaryNote?: string;
};

const realInstitutionViews = [
  'dashboard',
  'customers',
  'appointments',
  'followups',
  'aiServiceUsage',
  'treatmentSummaries',
  'opportunities',
  'audit',
  'wecomExternalContacts',
  'wecomCustomerMappingCandidates',
  'hisConnections',
  'conversations',
  'knowledge',
] as const satisfies readonly InstitutionViewId[];

function isRealInstitutionView(viewId: InstitutionViewId) {
  return (realInstitutionViews as readonly InstitutionViewId[]).includes(viewId);
}

function navigationBoundaryLabel(viewId: InstitutionViewId) {
  return isRealInstitutionView(viewId) ? '开发主线' : '后续';
}

function navigationBoundaryClasses(viewId: InstitutionViewId) {
  return isRealInstitutionView(viewId)
    ? 'border-emerald-300/30 bg-emerald-300/12 text-emerald-100'
    : 'border-amber-300/30 bg-amber-300/12 text-amber-100';
}

function visibleDashboardErrorState(error: TenantBusinessClientError): InstitutionPageStateProps {
  return getInstitutionPageStateFromClientError(error, {
    forbiddenMessage: '当前账号没有访问机构首页数据的权限',
    fallbackMessage: '机构运营视图暂时无法加载',
    unavailableMessage: '数据服务暂时不可用，请稍后刷新或切换到开发空态',
  });
}

function firstDashboardError(
  results: Array<{ ok: true } | { ok: false; error: TenantBusinessClientError }>,
) {
  return results.find(
    (result): result is { ok: false; error: TenantBusinessClientError } => !result.ok,
  )?.error;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function safeNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function safeOptionalString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function safeStringList(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .slice(0, 6);
}

function parseFollowUpPathAnalysisPayload(payload: unknown): FollowUpPathAnalysisApiResponse {
  const record = isRecord(payload) ? payload : {};

  return {
    scope:
      safeOptionalString(record.scope) ?? 'followup_path_operational_analysis_v1',
    analysisAt: safeOptionalString(record.analysisAt) ?? '',
    templateSuggestionCount: safeNumber(record.templateSuggestionCount),
    confirmedSourceTaskCount: safeNumber(record.confirmedSourceTaskCount),
    completedTaskCount: safeNumber(record.completedTaskCount),
    overdueTaskCount: safeNumber(record.overdueTaskCount),
    voidedSummaryBlockedCount: safeNumber(record.voidedSummaryBlockedCount),
    duplicateSourceTaskConflictCount: safeNumber(record.duplicateSourceTaskConflictCount),
    notes: safeStringList(record.notes),
    warnings: safeStringList(record.warnings),
    dataSourceNote: safeOptionalString(record.dataSourceNote),
    boundaryNote: safeOptionalString(record.boundaryNote),
  };
}

function parseKnowledgeBaseDemoSearchPayload(payload: unknown): KnowledgeBaseDemoSearchResponse {
  const record = isRecord(payload) ? payload : {};
  const status = safeOptionalString(record.status);
  const results = Array.isArray(record.results)
    ? record.results
        .filter(isRecord)
        .map((result, index): KnowledgeBaseDemoSearchResult => {
          const scoreBand = safeOptionalString(result.scoreBand);
          const sourceKind = safeOptionalString(result.sourceKind);

          return {
            resultId: safeOptionalString(result.resultId) ?? `demo-search-result-${index}`,
            title: safeOptionalString(result.title) ?? '知识库只读搜索结果',
            snippet: safeOptionalString(result.snippet) ?? '低敏摘要',
            scoreBand:
              scoreBand === 'high' || scoreBand === 'medium' || scoreBand === 'low'
                ? scoreBand
                : 'low',
            sourceKind:
              sourceKind === 'mock' || sourceKind === 'seed' || sourceKind === 'demo'
                ? sourceKind
                : 'demo',
            chunkIndex: safeNumber(result.chunkIndex),
            readonly: true,
          };
        })
        .slice(0, 5)
    : [];

  return {
    status:
      status === 'ready' ||
      status === 'empty' ||
      status === 'empty_query' ||
      status === 'denied' ||
      status === 'validation_failed'
        ? status
        : results.length > 0
          ? 'ready'
          : 'empty',
    readonly: true,
    query: safeOptionalString(record.query) ?? '',
    mode: record.mode === 'demo_search_mock_embedding' ? 'demo_search_mock_embedding' : undefined,
    resultCount: safeNumber(record.resultCount),
    results,
  };
}

async function loadFollowUpPathAnalysis(): Promise<
  | { ok: true; analysis: FollowUpPathAnalysisApiResponse }
  | { ok: false }
> {
  try {
    const response = await fetch('/api/institution/follow-up-path-analysis', {
      cache: 'no-store',
    });

    if (!response.ok) {
      return { ok: false };
    }

    const payload: unknown = await response.json();
    return {
      ok: true,
      analysis: parseFollowUpPathAnalysisPayload(payload),
    };
  } catch {
    return { ok: false };
  }
}

type WorkspaceAccessStatus =
  | { kind: 'loading' }
  | { kind: 'denied' }
  | { kind: 'allowed'; context: AccessContext };

function parseWorkspaceAccessContext(value: unknown): AccessContext | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const payload = value as Partial<AuthSessionPayload>;
  const user = payload.user;
  if (
    payload.authenticated !== true ||
    !user ||
    typeof user.id !== 'string' ||
    !isAuthRole(user.role) ||
    typeof user.tenantId !== 'string' ||
    user.tenantId.length === 0 ||
    typeof user.institutionId !== 'string' ||
    user.institutionId.length === 0
  ) {
    return null;
  }

  return {
    userId: user.id,
    role: user.role,
    scope: 'tenant',
    tenantId: user.tenantId,
    institutionId: user.institutionId,
    source: 'demo_session',
  };
}

export function InstitutionWorkspace() {
  const [workspaceAccess, setWorkspaceAccess] = useState<WorkspaceAccessStatus>({ kind: 'loading' });
  const [activeView, setActiveView] = useState<InstitutionViewId>('dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [dashboardSummary, setDashboardSummary] = useState<InstitutionDashboardSummary>(
    emptyDashboardSummary,
  );
  const [lowSensitiveImportCustomerCount, setLowSensitiveImportCustomerCount] = useState(0);
  const [dashboardStatus, setDashboardStatus] = useState<DashboardLoadStatus>('loading');
  const [dashboardErrorState, setDashboardErrorState] =
    useState<InstitutionPageStateProps | null>(null);
  const [followUpPathAnalysis, setFollowUpPathAnalysis] =
    useState<FollowUpPathAnalysisApiResponse | null>(null);
  const [followUpPathAnalysisStatus, setFollowUpPathAnalysisStatus] =
    useState<DashboardLoadStatus>('loading');
  const [entitlementView, setEntitlementView] = useState<{
    items: Array<{ resource: string; label: string; used: number | null; limit: number | null;
      remaining: number | null; status: string }>;
    planCode: string | null;
    planName: string | null;
  } | null>(null);
  const visibleNavItems = visibleInstitutionNavItems(
    workspaceAccess.kind === 'allowed' ? workspaceAccess.context : null,
  );
  const canViewWeComCustomerMappingCandidates = visibleNavItems.some(
    (item) => item.id === 'wecomCustomerMappingCandidates',
  );
  const canReviewWeComCustomerMappingCandidates = workspaceAccess.kind === 'allowed'
    ? canAccessResource({
        context: workspaceAccess.context,
        resource: 'customer',
        action: 'mapping_review',
        targetTenantId: workspaceAccess.context.tenantId,
      }).allowed
    : false;
  const displayedView = activeView === 'wecomCustomerMappingCandidates'
    && !canViewWeComCustomerMappingCandidates
    ? 'dashboard'
    : activeView;
  const activeNavItem = visibleNavItems.find((item) => item.id === displayedView)
    ?? visibleNavItems[0]
    ?? institutionNavItems[0];
  const highPriorityMetric = dashboardSummary.metrics.find(
    (metric) => metric.key === 'high_priority_customers',
  );
  const highPriorityLabel =
    dashboardStatus === 'loading' ? '--' : highPriorityMetric?.value ?? '0';
  const SidebarToggleIcon = isSidebarCollapsed ? PanelLeftOpen : PanelLeftClose;

  useEffect(() => {
    let isCurrent = true;

    async function loadWorkspaceAccess() {
      try {
        const response = await fetch('/api/auth/session', { cache: 'no-store' });
        if (!response.ok) {
          if (isCurrent) setWorkspaceAccess({ kind: 'denied' });
          return;
        }
        const context = parseWorkspaceAccessContext(await response.json());
        if (isCurrent) {
          setWorkspaceAccess(context ? { kind: 'allowed', context } : { kind: 'denied' });
        }
      } catch {
        if (isCurrent) setWorkspaceAccess({ kind: 'denied' });
      }
    }

    void loadWorkspaceAccess();
    return () => {
      isCurrent = false;
    };
  }, []);

  useEffect(() => {
    let isActive = true;

    async function loadDashboardSummary() {
      setDashboardStatus('loading');
      setLowSensitiveImportCustomerCount(0);
      setDashboardErrorState(null);
      setFollowUpPathAnalysisStatus('loading');
      setFollowUpPathAnalysis(null);

      const [customerResult, appointmentResult, followUpResult, pathAnalysisResult] = await Promise.all([
        listCustomers(),
        listAppointments(),
        listFollowUpTasks(),
        loadFollowUpPathAnalysis(),
      ]);

      if (!isActive) return;

      // 加载套餐权益用量（只读，不需要阻塞主运营视图）
      fetch('/api/institution/entitlement-usage')
        .then((r) => r.json().catch(() => null))
        .then((p) => {
          if (p && Array.isArray(p.items)) setEntitlementView(p);
        })
        .catch(() => {});

      if (pathAnalysisResult.ok) {
        setFollowUpPathAnalysis(pathAnalysisResult.analysis);
        setFollowUpPathAnalysisStatus('success');
      } else {
        setFollowUpPathAnalysis(null);
        setFollowUpPathAnalysisStatus('error');
      }

      const error = firstDashboardError([customerResult, appointmentResult, followUpResult]);
      if (error) {
        setDashboardSummary(emptyDashboardSummary);
        setDashboardErrorState(visibleDashboardErrorState(error));
        setDashboardStatus('error');
        return;
      }

      setDashboardSummary(
        buildInstitutionDashboardSummary({
          customers: customerResult.ok ? customerResult.records : [],
          appointments: appointmentResult.ok ? appointmentResult.records : [],
          followUpTasks: followUpResult.ok ? followUpResult.records : [],
        }),
      );
      setLowSensitiveImportCustomerCount(
        customerResult.ok
          ? customerResult.records.filter((customer) => customer.tags.includes('低敏导入')).length
          : 0,
      );
      setDashboardStatus('success');
    }

    void loadDashboardSummary();

    return () => {
      isActive = false;
    };
  }, []);

  return (
    <main
      className="min-h-screen overflow-x-hidden bg-[#eef4fb] bg-cover bg-center text-slate-950"
      style={{
        backgroundImage:
          'linear-gradient(110deg, rgba(247,250,255,0.94) 0%, rgba(244,249,255,0.9) 46%, rgba(232,244,251,0.82) 100%), url("/homepage/zmtg-luxury-clinic-bg.png")',
      }}
    >
      <div className="flex min-h-screen">
        <aside
          aria-label="机构端侧边栏"
          data-sidebar-state={isSidebarCollapsed ? 'collapsed' : 'expanded'}
          className={cn(
            'fixed left-0 top-0 z-30 hidden h-screen shrink-0 flex-col overflow-hidden border-r border-white/12 bg-[#071322]/95 text-slate-200 shadow-2xl shadow-slate-950/20 transition-[width] duration-200 md:flex',
            isSidebarCollapsed ? 'md:w-16' : 'md:w-[276px]',
          )}
        >
          <div className="absolute inset-y-0 left-0 hidden w-full bg-[linear-gradient(rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.045)_1px,transparent_1px)] bg-[length:36px_36px] md:block" />
          <div
            aria-label="机构端品牌区"
            className={cn(
              'relative flex h-[84px] shrink-0 items-center border-b border-white/10 transition-[padding] duration-200',
              isSidebarCollapsed ? 'justify-center px-2' : 'gap-3 px-5',
            )}
          >
            <Image
              src="/brand/logo-mark.png"
              alt=""
              width={50}
              height={50}
              className={cn(
                'shrink-0 rounded-xl bg-white object-contain transition-[width,height] duration-200',
                isSidebarCollapsed ? 'h-10 w-10 p-1' : 'h-[50px] w-[50px] p-1.5',
              )}
            />
            {!isSidebarCollapsed ? (
              <div className="min-w-0">
                <div className="truncate text-lg font-semibold tracking-normal text-white">智美天工</div>
                <div className="mt-0.5 truncate text-xs text-slate-400">医美智能运营系统</div>
              </div>
            ) : null}
          </div>

          <div
            className={cn(
              'relative flex h-[54px] shrink-0 items-center border-b border-white/10 text-xs font-semibold text-slate-400',
              isSidebarCollapsed ? 'justify-center px-2' : 'justify-between px-5',
            )}
          >
            {!isSidebarCollapsed ? <span>机构菜单</span> : null}
            <button
              type="button"
              aria-label={isSidebarCollapsed ? '展开机构端侧边栏' : '收起机构端侧边栏'}
              aria-expanded={!isSidebarCollapsed}
              title={isSidebarCollapsed ? '展开机构端侧边栏' : '收起机构端侧边栏'}
              onClick={() => setIsSidebarCollapsed((collapsed) => !collapsed)}
              className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-white/10 hover:text-cyan-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
            >
              <SidebarToggleIcon className="h-4 w-4" />
            </button>
          </div>

          <nav
            aria-label="机构端桌面导航"
            className={cn(
              'relative flex-1 space-y-0.5 overflow-y-auto py-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
              isSidebarCollapsed ? 'px-2' : 'px-4',
            )}
          >
            {visibleNavItems.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => setActiveView(item.id)}
                aria-label={item.label}
                aria-current={displayedView === item.id ? 'page' : undefined}
                title={isSidebarCollapsed ? item.label : undefined}
                className={cn(
                  'flex h-10 w-full items-center rounded-xl text-sm font-medium tracking-normal transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50',
                  isSidebarCollapsed ? 'justify-center px-0' : 'justify-between gap-3 px-3 text-left',
                  displayedView === item.id ? 'bg-blue-500/20 text-cyan-200 ring-1 ring-cyan-300/20' : 'text-slate-300 hover:bg-white/8 hover:text-white',
                )}
              >
                <span className={cn('flex min-w-0 items-center', isSidebarCollapsed ? 'justify-center' : 'gap-3')}>
                  <item.icon className="h-5 w-5 shrink-0" />
                  {!isSidebarCollapsed ? <span className="truncate">{item.label}</span> : null}
                </span>
                {!isSidebarCollapsed ? (
                  <span
                    aria-hidden="true"
                    className={cn(
                      'shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                      navigationBoundaryClasses(item.id),
                    )}
                  >
                    {navigationBoundaryLabel(item.id)}
                  </span>
                ) : null}
              </button>
            ))}
          </nav>

          <div className={cn('relative border-t border-white/10', isSidebarCollapsed ? 'space-y-2 p-3' : 'space-y-3 p-4')}>
            <div
              aria-label="机构端账号操作"
              className={cn(
                'flex',
                isSidebarCollapsed ? 'flex-col items-center gap-2' : 'items-center gap-2',
              )}
            >
              <div
                title={isSidebarCollapsed ? '系统管理员 · 机构运营账号' : undefined}
                className={cn(
                  'flex items-center rounded-xl bg-white/8 py-2',
                  isSidebarCollapsed ? 'w-10 justify-center px-0' : 'min-w-0 flex-1 gap-2.5 px-2.5',
                )}
              >
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-cyan-400/16 text-xs font-semibold text-cyan-200">管</div>
                {!isSidebarCollapsed ? (
                  <div className="min-w-0">
                    <div className="truncate text-xs font-semibold text-white">系统管理员</div>
                    <div className="truncate text-[11px] text-slate-400">机构运营账号</div>
                  </div>
                ) : null}
              </div>
              <LogoutButton
                redirectTo="/login"
                ariaLabel={isSidebarCollapsed ? '退出工作台' : undefined}
                className={cn(
                  'flex h-10 shrink-0 rounded-xl text-xs font-semibold text-rose-200 hover:bg-rose-500/10',
                  isSidebarCollapsed ? 'w-10 px-0' : 'px-2.5',
                )}
              >
                {isSidebarCollapsed ? '' : '退出'}
              </LogoutButton>
            </div>
          </div>
        </aside>

        <section
          aria-label="机构端主内容"
          className={cn(
            'min-w-0 flex-1 overflow-hidden transition-[padding] duration-200',
            isSidebarCollapsed ? 'md:pl-16' : 'md:pl-[276px]',
          )}
        >
          <nav aria-label="机构端移动导航" className="sticky top-0 z-20 border-b border-white/70 bg-white/84 px-4 py-3 shadow-sm shadow-slate-200/50 backdrop-blur-xl md:hidden">
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="text-xs font-semibold text-slate-500">机构导航</span>
              <div className="flex shrink-0 items-center gap-2">
                <span className="rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-cyan-700">
                  高优先级 {highPriorityLabel}
                </span>
                <LogoutButton
                  redirectTo="/login"
                  className="h-8 shrink-0 rounded-full border border-rose-200 bg-rose-50 px-2.5 text-xs font-semibold text-rose-600"
                >
                  退出工作台
                </LogoutButton>
              </div>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {visibleNavItems.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  aria-label={`移动导航：${item.label}`}
                  onClick={() => setActiveView(item.id)}
                  aria-current={displayedView === item.id ? 'page' : undefined}
                  className={cn(
                    'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold tracking-normal',
                    displayedView === item.id ? 'border-blue-200 bg-blue-600 text-white shadow-sm shadow-blue-500/20' : 'border-slate-200 bg-white/76 text-slate-600',
                  )}
                >
                  <item.icon className="h-3.5 w-3.5 shrink-0" />
                  {item.label}
                  <span
                    aria-hidden="true"
                    className={cn(
                      'ml-0.5 rounded-full border px-1.5 py-0.5 text-[10px]',
                      isRealInstitutionView(item.id)
                        ? displayedView === item.id
                          ? 'border-white/30 bg-white/16 text-white'
                          : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : displayedView === item.id
                          ? 'border-white/30 bg-white/16 text-white'
                          : 'border-amber-200 bg-amber-50 text-amber-700',
                    )}
                  >
                    {navigationBoundaryLabel(item.id)}
                  </span>
                </button>
              ))}
            </div>
          </nav>

          <div className="mx-auto w-full max-w-[1740px] space-y-6 px-4 py-4 sm:px-6 lg:px-8 lg:py-7">
            {displayedView === 'dashboard' ? (
              <InstitutionDashboardHome
                entitlementView={entitlementView}
                errorState={dashboardErrorState}
                followUpPathAnalysis={followUpPathAnalysis}
                followUpPathAnalysisStatus={followUpPathAnalysisStatus}
                lowSensitiveImportCustomerCount={lowSensitiveImportCustomerCount}
                onNavigate={setActiveView}
                status={dashboardStatus}
                summary={dashboardSummary}
              />
            ) : displayedView === 'customers' ? (
              <CustomerCenterShell />
            ) : displayedView === 'appointments' ? (
              <AppointmentCenterShell />
            ) : displayedView === 'followups' ? (
              <SmartFollowUpShell />
            ) : displayedView === 'aiServiceUsage' ? (
              <InstitutionAiServiceUsageShell />
            ) : displayedView === 'treatmentSummaries' ? (
              <TreatmentSummaryManagementShell />
            ) : displayedView === 'opportunities' ? (
              <OpportunityPoolShell />
            ) : displayedView === 'audit' ? (
              <InstitutionAuditEventsShell />
            ) : displayedView === 'wecomExternalContacts' ? (
              <WeComExternalContactReadonlyPanel />
            ) : displayedView === 'wecomCustomerMappingCandidates' && canViewWeComCustomerMappingCandidates ? (
              <WeComCustomerMappingCandidatesReadonlyPanel
                canReview={canReviewWeComCustomerMappingCandidates}
                requestScopeKey={workspaceAccess.kind === 'allowed'
                  ? `${workspaceAccess.context.tenantId}:${workspaceAccess.context.institutionId}`
                  : 'denied'}
              />
            ) : displayedView === 'hisConnections' ? (
              <HisConnectionReadOnlyPanel />
            ) : displayedView === 'conversations' ? (
              <AiConversationWorkbenchShell />
            ) : displayedView === 'knowledge' ? (
              <InstitutionKnowledgeReadonlyShell />
            ) : (
              <PlaceholderInstitutionView label={activeNavItem.label} />
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function InstitutionDashboardHome({
  entitlementView,
  errorState,
  followUpPathAnalysis,
  followUpPathAnalysisStatus,
  lowSensitiveImportCustomerCount,
  onNavigate,
  status,
  summary,
}: {
  entitlementView: {
    items: Array<{ resource: string; label: string; used: number | null; limit: number | null;
      remaining: number | null; status: string }>;
    planCode: string | null;
    planName: string | null;
  } | null;
  errorState: InstitutionPageStateProps | null;
  followUpPathAnalysis: FollowUpPathAnalysisApiResponse | null;
  followUpPathAnalysisStatus: DashboardLoadStatus;
  lowSensitiveImportCustomerCount: number;
  onNavigate: (viewId: InstitutionViewId) => void;
  status: DashboardLoadStatus;
  summary: InstitutionDashboardSummary;
}) {
  const entitlementAlerts = entitlementView?.items.filter(
    (item) => item.status === 'near_limit' || item.status === 'exceeded',
  ) ?? [];

  return (
    <div className="flex flex-col gap-4">
      <header className="overflow-hidden rounded-[24px] border border-white/80 bg-white/76 p-4 shadow-[0_20px_64px_rgba(32,61,104,0.10)] backdrop-blur-xl lg:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-center gap-3 md:hidden">
              <Image
                src="/brand/logo-mark.png"
                alt=""
                width={46}
                height={46}
                className="h-11 w-11 rounded-xl bg-white object-contain p-1"
              />
              <div>
                <div className="font-semibold tracking-normal text-slate-950">智美天工</div>
                <div className="text-xs text-slate-500">机构工作台</div>
              </div>
            </div>
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-cyan-200/80 bg-cyan-50/80 px-3 py-1 text-xs font-semibold text-cyan-700 md:mt-0">
              <Sparkles className="h-4 w-4" />
              当前为 API 数据
            </div>
            <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-normal text-slate-950 sm:text-4xl xl:text-[42px]">
              <span className="block">今日治疗后随访重点</span>
              <span className="block bg-gradient-to-r from-blue-600 via-cyan-500 to-emerald-500 bg-clip-text text-transparent sm:whitespace-nowrap">
                待人工确认的后续动作
              </span>
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
              客户、预约与随访任务统一汇总，优先处理需要人工确认的事项。
            </p>
          </div>

          <div className="flex flex-wrap gap-2 text-xs font-semibold xl:max-w-[460px] xl:justify-end">
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-slate-600">
              {status === 'loading' ? '数据加载中' : status === 'error' ? '数据暂不可用' : '数据已更新'}
            </span>
            <span className={cn(
              'rounded-full border px-3 py-1.5',
              summary.safetySwitch.realChannelBlocked
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-amber-200 bg-amber-50 text-amber-700',
            )}>
              真实渠道{summary.safetySwitch.realChannelBlocked ? '已阻断' : '可用'}
            </span>
            <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-blue-700">
              低敏导入 {status === 'success' ? lowSensitiveImportCustomerCount : '--'}
            </span>
          </div>
        </div>
      </header>

      {status === 'loading' ? (
        <InstitutionPageState kind="loading" title="正在加载机构运营摘要..." />
      ) : null}

      {status === 'error' && errorState ? (
        <InstitutionPageState {...errorState} />
      ) : null}

      <section aria-label="核心运营指标" className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        {summary.metrics.map((metric) => {
          const MetricIcon = metricIcons[metric.key];

          return (
            <article
              key={metric.key}
              className="overflow-hidden rounded-[18px] border border-white/80 bg-white/82 shadow-[0_14px_44px_rgba(32,61,104,0.08)] backdrop-blur-xl"
            >
              <button
                type="button"
                aria-label={`查看${metric.label}`}
                onClick={() => onNavigate(metricDestinations[metric.key])}
                className="w-full p-4 text-left transition hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
              >
                <div className="flex items-center justify-between gap-3">
                  <div
                    className={cn(
                      'grid h-9 w-9 place-items-center rounded-xl border',
                      statToneClasses[metric.tone],
                    )}
                  >
                    <MetricIcon className="h-4 w-4" />
                  </div>
                  <span className="truncate text-[11px] font-semibold text-slate-400">
                    {metric.helper}
                  </span>
                </div>
                <div className="mt-3 flex items-end justify-between gap-3">
                  <div className="text-3xl font-semibold leading-none tracking-normal text-slate-950">
                    {status === 'success' ? metric.value : '--'}
                  </div>
                  <div className="pb-0.5 text-right text-xs font-medium text-slate-500">
                    {metric.label}
                  </div>
                </div>
              </button>
            </article>
          );
        })}
      </section>

      {entitlementAlerts.length > 0 ? (
        <section className="flex flex-wrap items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
          <span className="font-semibold">套餐用量提醒</span>
          <span className="text-amber-800">
            {entitlementAlerts.map((item) => item.label).join('、')}已接近或达到上限
          </span>
        </section>
      ) : null}

      <details
        data-testid="dashboard-system-details"
        className="group order-last rounded-2xl border border-slate-200/80 bg-white/72 shadow-[0_12px_40px_rgba(32,61,104,0.07)] backdrop-blur-xl"
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 text-sm font-semibold text-slate-700 marker:hidden">
          <span className="flex items-center gap-2">
            <ShieldQuestion className="h-4 w-4 text-slate-400" />
            系统与数据详情
          </span>
          <span className="text-xs font-medium text-slate-400 group-open:hidden">按需展开</span>
          <span className="hidden text-xs font-medium text-slate-400 group-open:inline">收起详情</span>
        </summary>
        <div className="space-y-4 border-t border-slate-200/70 p-4">
      <section className="rounded-[22px] border border-emerald-100 bg-emerald-50/80 p-5 shadow-[0_20px_70px_rgba(32,61,104,0.10)] backdrop-blur-xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/20">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold tracking-normal text-slate-950">
                权限与安全开关
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                当前权限 / 安全边界按最小权限展示；真实渠道默认关闭，当前仍为 mock。
              </p>
            </div>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-right">
            <div className="text-xs font-semibold text-slate-400">真实渠道</div>
            <div className="mt-1 text-sm font-semibold text-emerald-700">
              {summary.safetySwitch.realChannelBlocked ? '已阻断' : '可用'}
            </div>
          </div>
        </div>
        <div className="mt-4 grid gap-2 text-xs font-semibold text-emerald-800 sm:grid-cols-3 xl:grid-cols-5">
          {summary.safetySwitch.boundaryLabels.map((label) => (
            <span key={label} className="rounded-full border border-emerald-200 bg-white px-3 py-2">
              {label}
            </span>
          ))}
        </div>
      </section>

      <section className="rounded-[22px] border border-blue-100 bg-blue-50/80 p-5 shadow-[0_20px_70px_rgba(32,61,104,0.10)] backdrop-blur-xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/20">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold tracking-normal text-slate-950">
                低敏客户导入状态
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                dashboard 仅汇总低敏导入客户数量和安全边界；不展示手机号、身份证、病历号、聊天记录或外部系统 payload。
              </p>
            </div>
          </div>
          <div className="rounded-2xl border border-blue-200 bg-white px-4 py-3 text-right">
            <div className="text-xs font-semibold text-slate-400">低敏导入客户</div>
            <div className="mt-1 text-3xl font-semibold text-blue-700">
              {status === 'loading' ? '--' : lowSensitiveImportCustomerCount}
            </div>
          </div>
        </div>
        <div className="mt-4 grid gap-2 text-xs font-semibold text-blue-800 sm:grid-cols-3">
          <span className="rounded-full border border-blue-200 bg-white px-3 py-2">字段白名单预检</span>
          <span className="rounded-full border border-blue-200 bg-white px-3 py-2">失败原因可见</span>
          <span className="rounded-full border border-blue-200 bg-white px-3 py-2">导入后记录审计</span>
        </div>
        {status === 'success' && lowSensitiveImportCustomerCount === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-blue-200 bg-white px-4 py-3 text-sm font-semibold text-slate-500">
            当前暂无低敏导入客户，可在客户中心使用预检 API 后执行合法行导入。
          </div>
        ) : null}
      </section>

      {entitlementView ? (
        <section className="rounded-[22px] border border-white/80 bg-white/78 p-5 shadow-[0_20px_70px_rgba(32,61,104,0.10)] backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-700">
              <ShieldQuestion className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold tracking-normal text-slate-950">
                当前套餐：{entitlementView.planName ?? entitlementView.planCode ?? '-'}
              </h2>
              <p className="mt-1 text-xs text-slate-500">套餐权益用量，接近上限时会提前提示</p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {entitlementView.items.map((item) => {
              let statusBadge = '';
              if (item.status === 'exceeded') statusBadge = 'text-rose-600';
              else if (item.status === 'near_limit') statusBadge = 'text-amber-600';
              else if (item.status === 'no_active_plan' || item.status === 'not_configured') statusBadge = 'text-slate-400';
              else statusBadge = 'text-emerald-600';
              return (
                <div key={item.resource} className="rounded-xl border border-slate-200/80 bg-white p-3">
                  <div className="text-xs font-semibold text-slate-500">{item.label}</div>
                  <div className="mt-1 flex items-baseline gap-1">
                    <span className="text-xl font-semibold text-slate-950">{item.used ?? '-'}</span>
                    <span className="text-sm text-slate-400">/ {item.limit ?? '-'}</span>
                    {item.remaining !== null && (
                      <span className="ml-auto text-xs text-slate-400">剩余 {item.remaining}</span>
                    )}
                  </div>
                  {item.status === 'near_limit' && (
                    <p className="mt-1 text-xs text-amber-600 font-medium">即将达到上限，请联系平台管理员</p>
                  )}
                  {item.status === 'exceeded' && (
                    <p className="mt-1 text-xs text-rose-600 font-medium">已达到上限</p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {status === 'success' && summary.isEmpty ? (
        <InstitutionPageState
          kind="empty"
          title="暂无可计算运营摘要"
          description="当前没有客户、预约或随访任务可进入运营视图。"
        />
      ) : null}

      <WorkspaceDashboardReadonlyAggregationEntrySection />
      <KnowledgeBaseDemoReadonlyEntrySection />
        </div>
      </details>

      <FollowUpPathAnalysisPanel
        analysis={followUpPathAnalysis}
        status={followUpPathAnalysisStatus}
      />

      <section className="order-1 grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)]">
        <article className="rounded-[22px] border border-white/80 bg-white/82 p-4 shadow-[0_16px_52px_rgba(32,61,104,0.09)] backdrop-blur-xl lg:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-600/20">
                <Activity className="h-4 w-4" />
              </div>
              <div>
                <div className="text-xs font-semibold text-blue-600">近期需要人工处理</div>
                <h2 className="mt-0.5 text-lg font-semibold tracking-normal text-slate-950">
                  当前行动队列
                </h2>
              </div>
            </div>
            <div className="flex gap-2">
              {summary.supportingStats
                .filter((item) => item.key === 'reschedule_appointments' || item.key === 'urgent_followups')
                .map((item) => (
                  <div key={item.key} className="rounded-xl bg-slate-100 px-3 py-2 text-right">
                    <div className="text-[11px] font-medium text-slate-500">{item.label}</div>
                    <div className="text-lg font-semibold leading-5 text-slate-950">
                      {status === 'success' ? item.value : '--'}
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {status === 'success' && summary.actionItems.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50/70 px-4 py-4 text-center text-sm font-semibold text-slate-500">
              当前没有可展示的待处理行动。
            </div>
          ) : null}

          {summary.actionItems.length > 0 ? (
            <div className="mt-4 grid gap-2.5 lg:grid-cols-2">
              {summary.actionItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate(actionDestinations[item.source])}
                  className="rounded-xl border border-slate-200/80 bg-white px-3.5 py-3 text-left transition hover:border-blue-200 hover:bg-blue-50/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 inline-flex shrink-0 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-600">
                      {item.badge}
                    </span>
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold tracking-normal text-slate-950">
                        {item.title}
                      </h3>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{item.detail}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : null}
        </article>

        <article className="rounded-[22px] border border-white/80 bg-white/82 p-4 shadow-[0_16px_52px_rgba(32,61,104,0.09)] backdrop-blur-xl lg:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold tracking-normal text-slate-950">
                客户旅程看板
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">治疗后服务与复诊机会分布</p>
            </div>
            <Target className="h-5 w-5 text-blue-500" />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {summary.journeyLanes.map((lane) => (
              <div key={lane.key} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50/90 px-3 py-2.5">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-slate-800">{lane.title}</h3>
                  <div className="truncate text-[11px] text-slate-400">{lane.detail}</div>
                </div>
                <div className="shrink-0 text-xl font-semibold text-slate-950">
                  {status === 'success' ? lane.count : '--'}
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}

function KnowledgeBaseDemoReadonlyEntrySection() {
  const [entryState, setEntryState] = useState<KnowledgeBaseDemoReadonlyEntryState>({
    status: 'loading',
  });
  const boundaryItems = [
    '只调用现有 GET API',
    '只读 search API',
    '低敏字段',
    '不接 DB',
    '不接真实外部院内系统',
    '不读取凭证',
    '不使用真实业务个人数据',
    '不展示智能推断细节',
  ];

  useEffect(() => {
    let isMounted = true;

    async function loadKnowledgeBaseDemoReadonly() {
      try {
        const response = await fetch('/api/v1/knowledge-base/demo-readonly', {
          cache: 'no-store',
        });

        if (!response.ok) {
          throw new Error('knowledge_base_demo_readonly_unavailable');
        }

        const payload =
          (await response.json()) as V1KnowledgeBaseDemoReadonlyApiContractResponse;

        if (isMounted) {
          setEntryState({ status: 'loaded', response: payload });
        }
      } catch {
        if (isMounted) {
          setEntryState({ status: 'error' });
        }
      }
    }

    void loadKnowledgeBaseDemoReadonly();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <section className="rounded-[24px] border border-white/80 bg-white/78 p-5 shadow-[0_20px_70px_rgba(32,61,104,0.10)] backdrop-blur-xl lg:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/20">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-normal text-slate-950">
              知识库只读入口
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              机构工作台中的知识库只读入口；当前无真实知识库记录时保持空态。
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600">
            只读入口
          </span>
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-500">
            未接入真实数据
          </span>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm leading-6 text-emerald-800">
        当前仅调用只读 GET 接口；不会写入数据或触发外部动作。
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {boundaryItems.map((item) => (
          <div
            key={item}
            className="rounded-2xl border border-slate-200/80 bg-white/86 px-4 py-3 text-sm font-semibold text-slate-600"
          >
            {item}
          </div>
        ))}
      </div>

      <KnowledgeBaseDemoReadonlyEntryBody state={entryState} />
    </section>
  );
}

function WorkspaceDashboardReadonlyAggregationEntrySection() {
  const [entryState, setEntryState] =
    useState<WorkspaceDashboardReadonlyAggregationEntryState>({
      status: 'loading',
    });
  const boundaryItems = [
    '只调用既有 GET route',
    '只读摘要',
    '低敏字段',
    '不写入数据',
    '不触发外部动作',
    '不展示明细',
  ];

  useEffect(() => {
    let isMounted = true;

    async function loadWorkspaceDashboardReadonlyAggregation() {
      try {
        const response = await fetch('/api/v1/workspace-dashboard/readonly-aggregation', {
          cache: 'no-store',
        });

        if (!response.ok) {
          throw new Error('workspace_dashboard_readonly_aggregation_unavailable');
        }

        const payload =
          (await response.json()) as V1WorkspaceDashboardReadonlyAggregationApiContractResponse;

        if (isMounted) {
          setEntryState({ status: 'loaded', response: payload });
        }
      } catch {
        if (isMounted) {
          setEntryState({ status: 'error' });
        }
      }
    }

    void loadWorkspaceDashboardReadonlyAggregation();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <section className="rounded-[24px] border border-white/80 bg-white/78 p-5 shadow-[0_20px_70px_rgba(32,61,104,0.10)] backdrop-blur-xl lg:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/20">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-normal text-slate-950">
              workspace dashboard readonly aggregation
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              机构工作台只读聚合入口，仅消费既有 readonly aggregation GET route。
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-600">
            readonly aggregation
          </span>
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-500">
            无默认样例数据
          </span>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50/80 px-4 py-3 text-sm leading-6 text-blue-800">
        当前仅调用 GET /api/v1/workspace-dashboard/readonly-aggregation；不会写入数据或触发外部动作。
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {boundaryItems.map((item) => (
          <div
            key={item}
            className="rounded-2xl border border-slate-200/80 bg-white/86 px-4 py-3 text-sm font-semibold text-slate-600"
          >
            {item}
          </div>
        ))}
      </div>

      <WorkspaceDashboardReadonlyAggregationEntryBody state={entryState} />
    </section>
  );
}

function WorkspaceDashboardReadonlyAggregationEntryBody({
  state,
}: {
  state: WorkspaceDashboardReadonlyAggregationEntryState;
}) {
  if (state.status === 'loading') {
    return (
      <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm font-semibold text-slate-500">
        正在加载 workspace dashboard readonly aggregation...
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <h3 className="text-sm font-semibold text-amber-900">
              workspace dashboard readonly aggregation 暂时不可用
            </h3>
            <p className="mt-1 text-sm leading-6 text-amber-800">
              请稍后刷新页面，当前不会影响机构工作台其他只读摘要。
            </p>
          </div>
        </div>
      </div>
    );
  }

  const { response } = state;
  const statusLabel = workspaceDashboardReadonlyAggregationStatusLabel(response);
  const summaryItems = [
    {
      key: 'businessLoopSummary',
      label: 'businessLoopSummary',
      value: response.aggregation.businessLoopSummary,
    },
    {
      key: 'managementConfigSummary',
      label: 'managementConfigSummary',
      value: response.aggregation.managementConfigSummary,
    },
    {
      key: 'knowledgeGovernanceSummary',
      label: 'knowledgeGovernanceSummary',
      value: response.aggregation.knowledgeGovernanceSummary,
    },
    {
      key: 'fieldWhitelistSummary',
      label: 'fieldWhitelistSummary',
      value: response.aggregation.fieldWhitelistSummary,
    },
    {
      key: 'readonlyFeaturePolicySummary',
      label: 'readonlyFeaturePolicySummary',
      value: response.aggregation.readonlyFeaturePolicySummary,
    },
  ];

  return (
    <div className="mt-5 space-y-4">
      <div className="rounded-2xl border border-slate-200/80 bg-white/86 px-4 py-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-normal text-slate-400">
            状态总览
          </span>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-500">
            status / dashboardStatus
          </span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold tracking-normal text-slate-950">
              {statusLabel}
            </h3>
            <div className="mt-1 text-sm font-semibold text-slate-700">
              {toWorkspaceDashboardReadonlyAggregationSafeText(response.summary.title)}
            </div>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              {toWorkspaceDashboardReadonlyAggregationSafeText(response.summary.description)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
              {toWorkspaceDashboardReadonlyAggregationSafeText(response.summary.statusText)}
            </span>
            <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-600">
              {toWorkspaceDashboardReadonlyAggregationSafeText(response.dashboardStatus)}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold tracking-normal text-slate-950">
            核心聚合摘要
          </h3>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            仅展示当前只读聚合结果；无真实记录时保持空态。
          </p>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
        {summaryItems.map((item) => (
          <article
            key={item.key}
            className="rounded-2xl border border-slate-200/80 bg-white/86 p-4"
          >
            <div className="text-xs font-semibold uppercase tracking-normal text-slate-400">
              {item.label}
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {toWorkspaceDashboardReadonlyAggregationSafeText(item.value)}
            </p>
          </article>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <WorkspaceDashboardReadonlyAggregationList
          emptyText="暂无风险提示"
          items={response.riskFlags}
          label="riskFlags"
          title="治理提示"
        />
        <WorkspaceDashboardReadonlyAggregationList
          emptyText="暂无只读提示"
          items={response.recommendedReadonlyActions}
          label="recommendedReadonlyActions"
          title="只读动作提示"
        />
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white/86 p-4">
        <div className="text-xs font-semibold uppercase tracking-normal text-slate-400">
          taskRecords
        </div>
        <div className="mt-3 space-y-3">
          {response.taskRecords.map((record) => (
            <div
              key={record.recordId}
              className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold tracking-normal text-slate-950">
                  {toWorkspaceDashboardReadonlyAggregationSafeText(record.title)}
                </span>
                <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-500">
                  {toWorkspaceDashboardReadonlyAggregationSafeText(record.status)}
                </span>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {toWorkspaceDashboardReadonlyAggregationSafeText(record.failureReason)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function WorkspaceDashboardReadonlyAggregationList({
  emptyText,
  items,
  label,
  title,
}: {
  emptyText: string;
  items: readonly string[];
  label: string;
  title: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white/86 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold tracking-normal text-slate-950">{title}</span>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-500">
          {label}
        </span>
      </div>
      {items.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {items.map((item) => (
            <span
              key={item}
              className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600"
            >
              {toWorkspaceDashboardReadonlyAggregationSafeText(item)}
            </span>
          ))}
        </div>
      ) : (
        <div className="mt-3 rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-4 text-center text-sm font-semibold text-slate-500">
          {emptyText}
        </div>
      )}
    </div>
  );
}

function toWorkspaceDashboardReadonlyAggregationSafeText(value: string) {
  if (isWorkspaceDashboardReadonlyAggregationUnsafeText(value)) {
    return '低敏摘要已隐藏';
  }

  return value;
}

function isWorkspaceDashboardReadonlyAggregationUnsafeText(value: string) {
  return /真实客户|手机号|身份证|病历|诊断|订单|支付|合同|发票|HIS|credential|token|secret|apiKey|raw|payload|worker|stack|dependency|\/tmp|模型|prompt|completion|embedding|vector|retrieval|upload|parse|chunk|runtime|上传|编辑|删除|发布|下架|回滚|创建任务|预约|触达|营销|成交|createTask|autoMarketing/u.test(
    value,
  );
}

function workspaceDashboardReadonlyAggregationStatusLabel(
  response: V1WorkspaceDashboardReadonlyAggregationApiContractResponse,
) {
  if (response.status === 'disabled') {
    return 'workspace dashboard readonly aggregation 暂未开启';
  }

  if (response.status === 'denied') {
    return '当前账号没有 workspace dashboard readonly aggregation 访问权限';
  }

  if (response.status === 'empty') {
    return '暂无可展示 workspace dashboard readonly aggregation';
  }

  if (response.status === 'partial') {
    return 'workspace dashboard readonly aggregation 部分可用';
  }

  if (response.status === 'stale') {
    return 'workspace dashboard readonly aggregation 可能已过期';
  }

  return 'workspace dashboard readonly aggregation 已就绪';
}

function KnowledgeBaseDemoReadonlyEntryBody({
  state,
}: {
  state: KnowledgeBaseDemoReadonlyEntryState;
}) {
  if (state.status === 'loading') {
    return (
      <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm font-semibold text-slate-500">
        正在加载知识库只读入口...
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <h3 className="text-sm font-semibold text-amber-900">
              知识库只读入口暂时不可用
            </h3>
            <p className="mt-1 text-sm leading-6 text-amber-800">
              请稍后刷新页面，当前不会影响机构工作台其他只读摘要。
            </p>
          </div>
        </div>
      </div>
    );
  }

  const { response } = state;
  const statusLabel = knowledgeBaseDemoReadonlyStatusLabel(response);
  const hasLowSensitiveSummary =
    response.categories.length > 0 ||
    response.folders.length > 0 ||
    response.knowledgeItems.length > 0;
  const presentationItems = [
    '分类摘要 categories',
    '目录摘要 folders',
    '知识条目 knowledgeItems',
    '只读任务 taskRecords',
    '预览 searchPreview',
  ];

  return (
    <div className="mt-5 space-y-4">
      <div className="rounded-2xl border border-slate-200/80 bg-white/86 px-4 py-4">
        <div className="mb-3 text-xs font-semibold uppercase tracking-normal text-slate-400">
          summary
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold tracking-normal text-slate-950">
              {statusLabel}
            </h3>
            <div className="mt-1 text-sm font-semibold text-slate-700">
              {toKnowledgeBaseDemoReadonlySafeText(response.summary.title)}
            </div>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              {toKnowledgeBaseDemoReadonlySafeText(response.summary.description)}
            </p>
          </div>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
            {toKnowledgeBaseDemoReadonlySafeText(response.summary.statusText)}
          </span>
        </div>
      </div>

      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold tracking-normal text-emerald-950">
              知识库展示结构
            </h3>
            <p className="mt-1 text-sm leading-6 text-emerald-800">
              当前无真实知识库记录时仅展示空结构，不进行真实查找
            </p>
          </div>
          <span className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-semibold text-emerald-700">
            只读 / 空态
          </span>
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-5">
          {presentationItems.map((item) => (
            <div
              key={item}
              className="rounded-2xl border border-emerald-100 bg-white/86 px-3 py-2 text-xs font-semibold text-emerald-800"
            >
              {item}
            </div>
          ))}
        </div>
      </div>

      <KnowledgeBaseDemoSearchPanel />

      {hasLowSensitiveSummary ? (
        <>
          <div className="rounded-2xl border border-slate-200/80 bg-white/86 p-4">
            <div className="text-xs font-semibold uppercase tracking-normal text-slate-400">
              categories
            </div>
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              {response.categories.map((category) => (
                <article
                  key={category.categoryId}
                  className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4"
                >
                  <h4 className="text-sm font-semibold tracking-normal text-slate-950">
                    {toKnowledgeBaseDemoReadonlySafeText(category.label)}
                  </h4>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {toKnowledgeBaseDemoReadonlySafeText(category.summary)}
                  </p>
                </article>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white/86 p-4">
            <div className="text-xs font-semibold uppercase tracking-normal text-slate-400">
              folders
            </div>
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              {response.folders.map((folder) => (
                <article
                  key={folder.folderId}
                  className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4"
                >
                  <h4 className="text-sm font-semibold tracking-normal text-slate-950">
                    {toKnowledgeBaseDemoReadonlySafeText(folder.label)}
                  </h4>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {toKnowledgeBaseDemoReadonlySafeText(folder.summary)}
                  </p>
                </article>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white/86 p-4">
            <div className="text-xs font-semibold uppercase tracking-normal text-slate-400">
              knowledgeItems
            </div>
            <div className="mt-3 grid gap-3 lg:grid-cols-3">
              {response.knowledgeItems.map((item) => (
                <article
                  key={item.itemId}
                  className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4"
                >
                  <h4 className="text-sm font-semibold tracking-normal text-slate-950">
                    {toKnowledgeBaseDemoReadonlySafeText(item.title)}
                  </h4>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {toKnowledgeBaseDemoReadonlySafeText(item.summary)}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm font-semibold text-slate-500">
          暂无可展示低敏知识库摘要
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200/80 bg-white/86 p-4">
          <div className="text-xs font-semibold uppercase tracking-normal text-slate-400">
            taskRecords
          </div>
          <div className="mt-3 space-y-3">
            {response.taskRecords.map((record) => (
              <div
                key={record.recordId}
                className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold tracking-normal text-slate-950">
                    {toKnowledgeBaseDemoReadonlySafeText(record.title)}
                  </span>
                  <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-500">
                    {toKnowledgeBaseDemoReadonlySafeText(record.status)}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {toKnowledgeBaseDemoReadonlySafeText(record.failureReason)}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white/86 p-4">
          <div className="text-xs font-semibold uppercase tracking-normal text-slate-400">
            searchPreview
          </div>
          <div className="mt-3 rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
            <div className="text-sm font-semibold tracking-normal text-slate-950">
              {toKnowledgeBaseDemoReadonlySafeText(response.searchPreview.mode)}
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {toKnowledgeBaseDemoReadonlySafeText(response.searchPreview.query)}
            </p>
          </div>
          <div className="mt-3 space-y-3">
            {response.searchPreview.results.map((result) => (
              <article
                key={result.previewId}
                className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-sm font-semibold tracking-normal text-slate-950">
                    {toKnowledgeBaseDemoReadonlySafeText(result.title)}
                  </h4>
                  <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-500">
                    {toKnowledgeBaseDemoReadonlySafeText(result.sourceKind)}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {toKnowledgeBaseDemoReadonlySafeText(result.snippet)}
                </p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function KnowledgeBaseDemoSearchPanel() {
  const [query, setQuery] = useState('');
  const [searchState, setSearchState] = useState<KnowledgeBaseDemoSearchState>({
    status: 'idle',
  });
  const trimmedQuery = query.trim();

  useEffect(() => {
    if (trimmedQuery.length === 0) {
      return;
    }

    let isMounted = true;
    const params = new URLSearchParams({ q: trimmedQuery });

    async function runSearch() {
      setSearchState({ status: 'loading' });

      try {
        const response = await fetch(
          `/api/v1/knowledge-base/runtime/search?${params.toString()}`,
          { cache: 'no-store' },
        );

        if (!response.ok) {
          throw new Error('knowledge_base_demo_search_unavailable');
        }

        const payload = parseKnowledgeBaseDemoSearchPayload(await response.json());
        if (isMounted) {
          setSearchState({ status: 'loaded', response: payload });
        }
      } catch {
        if (isMounted) {
          setSearchState({ status: 'error' });
        }
      }
    }

    void runSearch();

    return () => {
      isMounted = false;
    };
  }, [trimmedQuery]);

  return (
    <div className="rounded-2xl border border-cyan-200 bg-cyan-50/70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold tracking-normal text-cyan-950">
            知识库只读搜索
          </h3>
          <p className="mt-1 text-sm leading-6 text-cyan-800">
            仅用于只读搜索 / 受控本地索引，不代表真实生产检索。
          </p>
        </div>
        <span className="rounded-full border border-cyan-200 bg-white px-3 py-1 text-xs font-semibold text-cyan-700">
          只读搜索 / 受控本地索引
        </span>
      </div>

      <label className="mt-4 block">
        <span className="text-xs font-semibold uppercase tracking-normal text-cyan-700">
          query
        </span>
        <input
          aria-label="知识库只读搜索查询"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="mt-2 h-10 w-full rounded-xl border border-cyan-200 bg-white px-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-cyan-400"
          placeholder="输入只读搜索查询"
        />
      </label>

      <KnowledgeBaseDemoSearchResultState
        state={trimmedQuery.length === 0 ? knowledgeBaseDemoIdleSearchState : searchState}
      />
    </div>
  );
}

function KnowledgeBaseDemoSearchResultState({
  state,
}: {
  state: KnowledgeBaseDemoSearchState;
}) {
  if (state.status === 'idle') {
    return (
      <div className="mt-3 rounded-2xl border border-dashed border-cyan-200 bg-white/80 px-4 py-4 text-sm font-semibold text-cyan-700">
        输入关键词后展示只读搜索低敏结果。
      </div>
    );
  }

  if (state.status === 'loading') {
    return (
      <div className="mt-3 rounded-2xl border border-dashed border-cyan-200 bg-white/80 px-4 py-4 text-sm font-semibold text-cyan-700">
        正在加载知识库只读搜索...
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <h4 className="text-sm font-semibold text-amber-900">
              知识库只读搜索暂时不可用
            </h4>
            <p className="mt-1 text-sm leading-6 text-amber-800">
              当前不会影响知识库 readonly 摘要展示。
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (state.response.results.length === 0) {
    return (
      <div className="mt-3 rounded-2xl border border-dashed border-cyan-200 bg-white/80 px-4 py-4 text-sm font-semibold text-cyan-700">
        暂无只读搜索结果
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-cyan-200 bg-white px-2.5 py-1 text-xs font-semibold text-cyan-700">
          {toKnowledgeBaseDemoSearchSafeText(state.response.mode ?? 'readonly_search')}
        </span>
        <span className="rounded-full border border-cyan-200 bg-white px-2.5 py-1 text-xs font-semibold text-cyan-700">
          resultCount: {state.response.resultCount}
        </span>
      </div>
      {state.response.results.map((result) => (
        <article
          key={result.resultId}
          className="rounded-2xl border border-cyan-100 bg-white/86 p-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-semibold tracking-normal text-slate-950">
              {toKnowledgeBaseDemoSearchSafeText(result.title)}
            </h4>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-500">
              {toKnowledgeBaseDemoSearchSafeText(result.sourceKind)} / readonly
            </span>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {toKnowledgeBaseDemoSearchSafeText(result.snippet)}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-cyan-700">
              scoreBand: {result.scoreBand}
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-500">
              chunkIndex: {result.chunkIndex}
            </span>
          </div>
        </article>
      ))}
    </div>
  );
}

function toKnowledgeBaseDemoReadonlySafeText(value: string | null | undefined) {
  if (value === null || value === undefined) {
    return 'not_available';
  }

  if (isKnowledgeBaseDemoReadonlyUnsafeText(value)) {
    return '低敏摘要已隐藏';
  }

  return value
    .replaceAll('知识库 demo readonly API 契约', '知识库只读入口')
    .replaceAll('知识库 demo readonly facade', '知识库只读聚合')
    .replaceAll('知识库 demo readonly', '知识库只读')
    .replaceAll('demo readonly', '只读')
    .replaceAll('mock_demo_preview', 'readonly_preview')
    .replaceAll('知识库 demo 只读预览', '知识库只读预览')
    .replaceAll('mock / seed / demo', '只读空态')
    .replaceAll('低敏只读演示', '低敏只读预览')
    .replaceAll('演示', '预览')
    .replaceAll('demo', '只读')
    .replaceAll('seed', '开发数据')
    .replaceAll('mock', '空态');
}

function isKnowledgeBaseDemoReadonlyUnsafeText(value: string) {
  return /真实客户|真实知识|真实检索|手机号|身份证|病历|诊断|订单|支付|合同|发票|HIS|credential|token|secret|apiKey|raw|payload|worker|stack|dependency|\/tmp|模型|prompt|completion|upload|parse|上传|编辑|删除|发布|下架|回滚|创建任务|预约|触达|营销|成交/u.test(
    value,
  );
}

function toKnowledgeBaseDemoSearchSafeText(value: string | null | undefined) {
  if (value === null || value === undefined) {
    return 'not_available';
  }

  if (isKnowledgeBaseDemoSearchUnsafeText(value)) {
    return '低敏摘要已隐藏';
  }

  return value
    .replaceAll('demo_search_mock_embedding', 'readonly_search')
    .replaceAll('mock_demo_preview', 'readonly_preview')
    .replaceAll('低敏只读演示', '低敏只读预览')
    .replaceAll('演示', '预览')
    .replaceAll('demo', '只读')
    .replaceAll('seed', '开发数据')
    .replaceAll('mock', '空态');
}

function isKnowledgeBaseDemoSearchUnsafeText(value: string) {
  return /真实客户|真实知识|真实检索|手机号|身份证|病历|诊断|订单|支付|合同|发票|HIS|credential|token|secret|apiKey|raw|payload|worker|stack|dependency|\/tmp|模型|prompt|completion|上传|编辑|删除|发布|下架|回滚|创建任务|预约|触达|营销|成交/u.test(
    value,
  );
}

function knowledgeBaseDemoReadonlyStatusLabel(
  response: V1KnowledgeBaseDemoReadonlyApiContractResponse,
) {
  if (response.status === 'disabled') {
    return '知识库只读入口暂未开启';
  }

  if (response.status === 'denied') {
    return '当前账号没有知识库只读入口访问权限';
  }

  if (response.status === 'empty') {
    return '暂无真实知识库只读内容';
  }

  if (response.status === 'exception') {
    return '知识库只读入口来源不完整';
  }

  if (response.status === 'partial') {
    return '知识库只读入口部分可用';
  }

  if (response.status === 'stale') {
    return '知识库只读入口可能已过期';
  }

  return '知识库只读入口已就绪';
}

function FollowUpPathAnalysisPanel({
  analysis,
  status,
}: {
  analysis: FollowUpPathAnalysisApiResponse | null;
  status: DashboardLoadStatus;
}) {
  const hasNoData =
    status === 'success' &&
    analysis !== null &&
    followUpPathAnalysisMetricItems.every((item) => analysis[item.key] === 0);

  return (
    <section className="order-2 rounded-[22px] border border-white/80 bg-white/82 p-4 shadow-[0_16px_52px_rgba(32,61,104,0.09)] backdrop-blur-xl lg:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-cyan-600 text-white shadow-lg shadow-cyan-600/20">
            <Route className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-normal text-slate-950">
              随访路径运营分析
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              人工确认、完成进度与异常指标
            </p>
          </div>
        </div>
        <span className={cn(
          'rounded-full border px-3 py-1 text-xs font-semibold',
          status === 'error'
            ? 'border-amber-200 bg-amber-50 text-amber-700'
            : status === 'loading' || hasNoData
              ? 'border-slate-200 bg-slate-50 text-slate-500'
              : 'border-emerald-200 bg-emerald-50 text-emerald-600',
        )}>
          {status === 'error'
            ? '暂不可用'
            : status === 'loading'
              ? '加载中'
              : hasNoData
                ? '暂无指标'
                : '运营聚合'}
        </span>
      </div>

      {status === 'loading' ? (
        <div className="mt-3 rounded-xl border border-dashed border-slate-300 bg-slate-50/70 px-4 py-3 text-center text-sm font-semibold text-slate-500">
          正在加载随访路径运营分析...
        </div>
      ) : null}

      {status === 'error' ? (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div>
              <h3 className="text-sm font-semibold text-amber-900">
                随访路径运营分析暂时无法加载
              </h3>
              <p className="mt-0.5 text-xs leading-5 text-amber-800">
                请稍后刷新页面，当前模块不会影响客户、预约和随访摘要。
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {status === 'success' && analysis ? (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
            {followUpPathAnalysisMetricItems.map((item) => (
              <article
                key={item.key}
                className="rounded-xl border border-slate-200/80 bg-slate-50/70 px-3 py-2.5"
              >
                <div className="flex items-center justify-between gap-3">
                  <span
                    className={cn(
                      'rounded-full border px-2.5 py-1 text-[11px] font-semibold',
                      followUpPathAnalysisToneClasses[item.tone],
                    )}
                  >
                    {item.helper}
                  </span>
                  <div className="text-xl font-semibold leading-none text-slate-950">
                    {analysis[item.key]}
                  </div>
                </div>
                <div className="mt-2 text-xs font-medium text-slate-500">{item.label}</div>
              </article>
            ))}
          </div>

          <div className="mt-3 rounded-xl border border-cyan-100 bg-cyan-50/70 px-3 py-2 text-xs leading-5 text-slate-600">
            <div className="font-semibold text-cyan-800">数据与操作边界</div>
            {analysis.notes.length > 0 ? (
              <div className="mt-1 space-y-1">
                {analysis.notes.map((note) => <p key={note}>{note}</p>)}
              </div>
            ) : null}
            {analysis.dataSourceNote ? <p className="mt-1">数据来源：{analysis.dataSourceNote}</p> : null}
            {analysis.boundaryNote ? <p className="mt-1">操作边界：{analysis.boundaryNote}</p> : null}
            <p className="mt-1">仅展示聚合指标，不展示客户明细、任务正文或治疗记录，不自动触达，也不接入 AI 决策。</p>
          </div>

          {analysis.warnings.length > 0 ? (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <div>
                  <h3 className="text-sm font-semibold text-amber-900">提示</h3>
                  <div className="mt-0.5 space-y-1 text-xs leading-5 text-amber-800">
                    {analysis.warnings.map((warning) => (
                      <p key={warning}>{warning}</p>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

function PlaceholderInstitutionView({ label }: { label: string }) {
  return (
    <InstitutionPageState
      kind="placeholder"
      title={`${label}暂不进入本次开发主线`}
      description="本入口不会触发客服、知识库或数据分析真实功能请求。"
      action={
        <div className="space-y-2 text-sm leading-6 text-slate-500">
          <p>
            本次主线：工作台、客户中心、预约中心、智能随访、AI 服务使用、治疗摘要管理、审计日志、
            HIS 连接配置、AI 会话工作台、知识库只读列表。
          </p>
          <p>后续：数据分析。</p>
        </div>
      }
      className="items-start text-left"
    />
  );
}
