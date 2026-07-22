import Link from 'next/link';
import {
  INSTITUTION_NAVIGATION_SECTIONS_V1,
  type InstitutionNavigationSectionV1,
} from '@/modules/institution-contracts/v1/institution-navigation';
import {
  INSTITUTION_CANONICAL_ROUTES_V1,
  type InstitutionCanonicalRouteIdV1,
} from '@/modules/institution-contracts/v1/institution-routes';
import { InstitutionPageState } from '@/modules/institution/components/InstitutionPageState';

type CapabilityOffRouteIdV1 = Exclude<InstitutionCanonicalRouteIdV1, 'workbench'>;

const CAPABILITY_OFF_PAGE_LABELS_V1 = Object.freeze({
  customer_list: '客户列表',
  customer_treatments: '治疗记录',
  customer_treatment_detail: '治疗记录详情',
  customer_detail: '客户详情',
  conversation_queue: '会话队列',
  conversation_automations: '自动触达',
  conversation_automation_detail: '自动触达详情',
  conversation_detail: '会话详情',
  care_today_queue: '今日队列',
  care_appointments: '预约管理',
  care_appointment_detail: '预约详情',
  care_followups: '随访任务',
  care_followup_detail: '随访详情',
  care_paths: '路径管理',
  care_path_detail: '路径详情',
  knowledge_library: '资料库',
  knowledge_search: '检索测试',
  knowledge_qa: '问答与引用',
  knowledge_qa_audit_detail: '问答审计详情',
  knowledge_jobs: '任务记录',
  knowledge_item_detail: '资料详情',
  analytics_overview: '经营总览',
  analytics_consumption: '消费分析',
  analytics_consumption_detail: '消费详情',
  analytics_projects: '项目分析',
  analytics_project_detail: '项目详情',
  analytics_opportunities: '客户与机会',
  analytics_opportunity_detail: '客户机会详情',
  analytics_reports: 'AI 经营报告',
  analytics_report_detail: '经营报告详情',
  system_overview: '系统概览',
  system_organization: '机构与成员',
  system_member_detail: '成员详情',
  system_channels: '渠道接入',
  system_channel_connection_detail: '渠道连接详情',
  system_channel_mappings: '身份匹配',
  system_channel_mapping_detail: '身份匹配详情',
  system_data: '数据接入与治理',
  system_data_source_detail: '数据源详情',
  system_data_import_detail: '导入批次详情',
  system_ai_usage: 'AI 与额度',
  system_ai_usage_service_detail: 'AI 服务用量详情',
  system_privacy: '数据与隐私',
  system_audit: '审计与安全',
  system_audit_detail: '审计详情',
} satisfies Readonly<Record<CapabilityOffRouteIdV1, string>>);

const sectionById = new Map(
  INSTITUTION_NAVIGATION_SECTIONS_V1.map((section) => [section.id, section] as const),
);
const safeRouteParameterPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const capabilityOffRoutes = INSTITUTION_CANONICAL_ROUTES_V1.flatMap((route) => {
  if (route.id === 'workbench') return [];

  const section = sectionById.get(route.sectionId);
  if (!section) return [];

  return [
    {
      pageLabel: CAPABILITY_OFF_PAGE_LABELS_V1[route.id],
      routeId: route.id,
      section,
      segments: route.pathnamePattern.split('/').filter(Boolean).slice(1),
    },
  ];
});

export type InstitutionCapabilityOffRouteV1 = Readonly<{
  pageLabel: string;
  routeId: CapabilityOffRouteIdV1;
  section: InstitutionNavigationSectionV1;
}>;

export function resolveInstitutionCapabilityOffRouteV1(
  slug: readonly string[],
): InstitutionCapabilityOffRouteV1 | null {
  const route = capabilityOffRoutes.find((candidate) => {
    if (candidate.segments.length !== slug.length) return false;

    return candidate.segments.every((expectedSegment, index) => {
      const actualSegment = slug[index];
      if (!actualSegment) return false;

      return expectedSegment.startsWith(':')
        ? safeRouteParameterPattern.test(actualSegment)
        : expectedSegment === actualSegment;
    });
  });

  if (!route) return null;

  return Object.freeze({
    pageLabel: route.pageLabel,
    routeId: route.routeId,
    section: route.section,
  });
}

export function resolveInstitutionRouteSectionV1(
  slug: readonly string[],
): InstitutionNavigationSectionV1 | null {
  return resolveInstitutionCapabilityOffRouteV1(slug)?.section ?? null;
}

export function InstitutionCapabilityOffPage({
  pageLabel,
  section,
}: {
  pageLabel: string;
  section: InstitutionNavigationSectionV1;
}) {
  const title = `${pageLabel}尚未开放`;
  const semanticTitle = `${section.label} · ${pageLabel}能力未开放`;
  const isConversationSection = section.id === 'conversations';

  const returnToWorkbenchLink = (
    <Link
      href="/hospital"
      className="inline-flex h-10 items-center justify-center rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
    >
      返回工作台
    </Link>
  );

  const action = isConversationSection ? (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      <p className="text-left text-sm font-normal leading-6 text-slate-500 sm:text-center">
        当前未读取任何会话或渠道事实；未知状态不会被解释为零记录、空会话、历史消息或渠道已可用。
      </p>
      <dl
        aria-label="会话能力静态边界"
        className="grid gap-3 text-left sm:grid-cols-3"
      >
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <dt className="text-xs font-medium text-slate-500">会话事实</dt>
          <dd className="mt-1 text-sm font-semibold text-slate-800">未读取</dd>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <dt className="text-xs font-medium text-slate-500">渠道状态</dt>
          <dd className="mt-1 text-sm font-semibold text-slate-800">未验证</dd>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <dt className="text-xs font-medium text-slate-500">发送与自动触达</dt>
          <dd className="mt-1 text-sm font-semibold text-slate-800">未启用</dd>
        </div>
      </dl>
      {returnToWorkbenchLink}
    </div>
  ) : (
    returnToWorkbenchLink
  );

  return (
    <div
      data-capability-state="blocked"
      className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-3xl items-center justify-center"
    >
      <h1 className="sr-only">{semanticTitle}</h1>
      <InstitutionPageState
        kind="placeholder"
        title={title}
        description="当前机构尚未获得该能力的生产放行。能力开放后仍会由服务端重新校验机构、角色和数据范围。"
        className="w-full border-white/90 bg-white/86 px-6 py-12 shadow-xl shadow-slate-200/60"
        action={action}
      />
    </div>
  );
}
