import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const wireMocks = vi.hoisted(() => {
  const authorizeCurrentInstitutionNavigationV1 = vi.fn();
  const authorization = Object.freeze({
    authorizeCurrentInstitutionNavigationV1,
  });
  return {
    authorization,
    authorizeCurrentInstitutionNavigationV1,
    auditReadAuthorizationHandle: Object.freeze({}),
    consumeInstitutionAuditReadAuthorizationV1: vi.fn(),
    genuineDecisions: new WeakSet<object>(),
    resolveInstitutionAuditReadAuthorizationV1: vi.fn(),
    resolveInstitutionCapabilityAuthorityStatusV1: vi.fn(),
    resolveInstitutionServerAuthorizationV1: vi.fn(),
  };
});

vi.mock('@/modules/institution/server/institution-server-runtime', () => ({
  resolveInstitutionServerAuthorizationV1:
    wireMocks.resolveInstitutionServerAuthorizationV1,
}));

vi.mock('@/modules/security/server/institution-request-authorization', () => ({
  isInstitutionRequestAuthorizationV1: vi.fn(
    (value: unknown) => value === wireMocks.authorization,
  ),
}));

vi.mock('@/modules/security/server/institution-section-guard', () => ({
  isInstitutionNavigationAuthorizationV1: vi.fn(
    (value: unknown) =>
      value !== null &&
      typeof value === 'object' &&
      wireMocks.genuineDecisions.has(value),
  ),
}));

vi.mock('@/server/orchestration/institution-audit-read-authorization', () => ({
  consumeInstitutionAuditReadAuthorizationV1:
    wireMocks.consumeInstitutionAuditReadAuthorizationV1,
  resolveInstitutionAuditReadAuthorizationV1:
    wireMocks.resolveInstitutionAuditReadAuthorizationV1,
}));

vi.mock('@/server/orchestration/institution-capability-authority', () => ({
  resolveInstitutionCapabilityAuthorityStatusV1:
    wireMocks.resolveInstitutionCapabilityAuthorityStatusV1,
}));

import HospitalCapabilityOffRoute from '@/app/hospital/[...slug]/page';
import HospitalSystemAuditPage, {
  dynamic as hospitalSystemAuditDynamicMode,
} from '@/app/hospital/system/audit/page';
import type { CapabilityStatusV1 } from '@/modules/institution-contracts/v1/institution-capability';
import {
  INSTITUTION_NAVIGATION_SECTION_IDS_V1,
  INSTITUTION_NAVIGATION_SECTIONS_V1,
} from '@/modules/institution-contracts/v1/institution-navigation';
import {
  InstitutionCapabilityOffPage,
  resolveInstitutionCapabilityOffRouteV1,
  resolveInstitutionRouteSectionV1,
} from '@/modules/institution/components/InstitutionCapabilityOffPage';
import { InstitutionNavigationShell } from '@/modules/institution/components/InstitutionNavigationShell';

const allSectionIds = INSTITUTION_NAVIGATION_SECTION_IDS_V1;

type AuditAuthorityFixtureOptions = Readonly<{
  codeMaturity?: 'unverified' | 'verified';
  connectionAvailability?: 'not_required' | 'unavailable' | 'available';
  dataReadiness?: 'not_required' | 'ready' | 'empty' | 'partial' | 'stale' | 'unavailable';
  decision?: 'hidden' | 'read_only' | 'operational';
  duplicate?: boolean;
  institutionAuthorization?: 'not_authorized' | 'authorized';
  key?: 'page_system_audit' | 'page_system_overview';
  missing?: boolean;
  productionRelease?: 'not_released' | 'pilot_released' | 'released' | 'suspended';
  safeSummary?: string | null;
}>;

function auditAuthorityStatus(
  options: AuditAuthorityFixtureOptions = {},
): CapabilityStatusV1 {
  const key = options.key ?? 'page_system_audit';
  const freshness = {
    observedAt: '2026-08-14T03:00:00.000Z',
    freshUntil: '2026-08-14T03:00:05.000Z',
  };
  const capability = {
    key,
    decision: options.decision ?? 'read_only',
    dimensions: {
      codeMaturity: options.codeMaturity ?? 'verified',
      institutionAuthorization:
        options.institutionAuthorization ?? 'authorized',
      connectionAvailability:
        options.connectionAvailability ?? 'not_required',
      dataReadiness: options.dataReadiness ?? 'partial',
      productionRelease: options.productionRelease ?? 'pilot_released',
    },
    safeSummary:
      options.safeSummary === undefined
        ? '审计与安全仅供查看'
        : options.safeSummary,
    diagnosticTargetKey: key,
  } as const;
  const capabilities = options.missing
    ? []
    : options.duplicate
      ? [capability, { ...capability }]
      : [capability];
  const partitions = capabilities.map((item) => ({
    key: item.key,
    readiness: 'ready' as const,
    freshness,
    failureCode: null,
  }));

  return {
    contractVersion: 'v1',
    scope: {
      tenantId: 'tenant-s18-route-001',
      institutionId: 'institution-s18-route-001',
    },
    readiness: 'ready',
    freshness,
    partitions,
    data: { capabilities },
    failureCode: null,
  };
}

function partialVerifiedEmptyAuditResponse() {
  return new Response(
    JSON.stringify({
      records: [],
      pageInfo: { hasMore: false, limit: 50, nextCursor: null },
      coverage: {
        state: 'partial_verified_only',
        safeDataAvailable: false,
        historicalCoverageComplete: false,
        partialCoverageSafe: true,
      },
    }),
    {
      status: 200,
      headers: { 'content-type': 'application/json' },
    },
  );
}

const capabilityOffRouteCases = [
  [['customers'], 'customer_list', '客户列表'],
  [['customers', 'treatments'], 'customer_treatments', '治疗记录'],
  [['customers', 'treatments', 'summary-001'], 'customer_treatment_detail', '治疗记录详情'],
  [['customers', 'customer-001'], 'customer_detail', '客户详情'],
  [['conversations'], 'conversation_queue', '会话队列'],
  [['conversations', 'automations'], 'conversation_automations', '自动触达'],
  [['conversations', 'automations', 'journey-001'], 'conversation_automation_detail', '自动触达详情'],
  [['conversations', 'conversation-001'], 'conversation_detail', '会话详情'],
  [['care'], 'care_today_queue', '今日队列'],
  [['care', 'appointments'], 'care_appointments', '预约管理'],
  [['care', 'appointments', 'appointment-001'], 'care_appointment_detail', '预约详情'],
  [['care', 'followups'], 'care_followups', '随访任务'],
  [['care', 'followups', 'followup-001'], 'care_followup_detail', '随访详情'],
  [['care', 'paths'], 'care_paths', '路径管理'],
  [['care', 'paths', 'path-001'], 'care_path_detail', '路径详情'],
  [['knowledge'], 'knowledge_library', '资料库'],
  [['knowledge', 'search'], 'knowledge_search', '检索测试'],
  [['knowledge', 'qa'], 'knowledge_qa', '问答与引用'],
  [['knowledge', 'qa', 'audits', 'audit-001'], 'knowledge_qa_audit_detail', '问答审计详情'],
  [['knowledge', 'jobs'], 'knowledge_jobs', '任务记录'],
  [['knowledge', 'items', 'knowledge-001'], 'knowledge_item_detail', '资料详情'],
  [['analytics'], 'analytics_overview', '经营总览'],
  [['analytics', 'consumption'], 'analytics_consumption', '消费分析'],
  [['analytics', 'consumption', 'record-001'], 'analytics_consumption_detail', '消费详情'],
  [['analytics', 'projects'], 'analytics_projects', '项目分析'],
  [['analytics', 'projects', 'project-001'], 'analytics_project_detail', '项目详情'],
  [['analytics', 'opportunities'], 'analytics_opportunities', '客户与机会'],
  [['analytics', 'opportunities', 'customer-001'], 'analytics_opportunity_detail', '客户机会详情'],
  [['analytics', 'reports'], 'analytics_reports', 'AI 经营报告'],
  [['analytics', 'reports', 'report-001'], 'analytics_report_detail', '经营报告详情'],
  [['system'], 'system_overview', '系统概览'],
  [['system', 'organization'], 'system_organization', '机构与成员'],
  [['system', 'organization', 'members', 'member-001'], 'system_member_detail', '成员详情'],
  [['system', 'channels'], 'system_channels', '渠道接入'],
  [['system', 'channels', 'connections', 'connection-001'], 'system_channel_connection_detail', '渠道连接详情'],
  [['system', 'channels', 'mappings'], 'system_channel_mappings', '身份匹配'],
  [['system', 'channels', 'mappings', 'mapping-001'], 'system_channel_mapping_detail', '身份匹配详情'],
  [['system', 'data'], 'system_data', '数据接入与治理'],
  [['system', 'data', 'sources', 'source-001'], 'system_data_source_detail', '数据源详情'],
  [['system', 'data', 'imports', 'batch-001'], 'system_data_import_detail', '导入批次详情'],
  [['system', 'ai-usage'], 'system_ai_usage', 'AI 与额度'],
  [['system', 'ai-usage', 'services', 'knowledge_qa'], 'system_ai_usage_service_detail', 'AI 服务用量详情'],
  [['system', 'privacy'], 'system_privacy', '数据与隐私'],
  [['system', 'audit'], 'system_audit', '审计与安全'],
  [['system', 'audit', 'event-001'], 'system_audit_detail', '审计详情'],
] as const;

describe('BASE-01A-R1 机构端稳定路由壳', () => {
  it('按冻结顺序展示桌面七栏目和移动五入口，并安全管理更多栏目焦点', async () => {
    render(
      <InstitutionNavigationShell
        activeSectionId="customers"
        availableSectionIds={allSectionIds}
      >
        <div>客户中心内容</div>
      </InstitutionNavigationShell>,
    );

    const desktopNavigation = screen.getByRole('navigation', { name: '机构端桌面导航' });
    expect(
      within(desktopNavigation)
        .getAllByRole('link')
        .map((link) => link.textContent?.trim()),
    ).toEqual([
      '工作台',
      '客户中心',
      '会话工作台',
      '预约与随访',
      '知识库',
      '经营分析',
      '管理中心',
    ]);

    expect(within(desktopNavigation).getByRole('link', { name: '客户中心' })).toHaveAttribute(
      'aria-current',
      'page',
    );

    const mobileNavigation = screen.getByRole('navigation', { name: '机构端移动导航' });
    expect(
      within(mobileNavigation)
        .getAllByRole('link')
        .map((link) => link.textContent?.trim()),
    ).toEqual(['工作台', '客户', '会话', '待办']);
    const moreButton = within(mobileNavigation).getByRole('button', { name: '更多' });
    expect(moreButton).toHaveAttribute('aria-haspopup', 'dialog');
    expect(moreButton).toHaveAttribute('aria-controls', 'institution-mobile-more-dialog');

    fireEvent.click(moreButton);

    const moreNavigation = screen.getByRole('dialog', { name: '更多栏目' });
    expect(
      within(moreNavigation)
        .getAllByRole('link')
        .map((link) => link.textContent?.trim()),
    ).toEqual(['知识库', '经营分析', '管理中心']);

    const closeButton = within(moreNavigation).getByRole('button', {
      name: '关闭更多栏目',
    });
    await waitFor(() => expect(closeButton).toHaveFocus());

    const managementLink = within(moreNavigation).getByRole('link', { name: '管理中心' });
    managementLink.focus();
    fireEvent.keyDown(moreNavigation, { key: 'Tab' });
    expect(closeButton).toHaveFocus();
    fireEvent.keyDown(moreNavigation, { key: 'Tab', shiftKey: true });
    expect(managementLink).toHaveFocus();

    fireEvent.keyDown(moreNavigation, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: '更多栏目' })).not.toBeInTheDocument();
    expect(moreButton).toHaveFocus();

    fireEvent.click(moreButton);
    const reopenedMoreNavigation = screen.getByRole('dialog', { name: '更多栏目' });
    const knowledgeLink = within(reopenedMoreNavigation).getByRole('link', {
      name: '知识库',
    });
    const linkClick = new MouseEvent('click', { bubbles: true, cancelable: true });
    linkClick.preventDefault();
    fireEvent(knowledgeLink, linkClick);
    expect(screen.queryByRole('dialog', { name: '更多栏目' })).not.toBeInTheDocument();
  });

  it('将全七栏可见性明确标记为导航边界，不冒充授权或能力开放', () => {
    render(
      <InstitutionNavigationShell
        activeSectionId="customers"
        availableSectionIds={allSectionIds}
      >
        <div>客户中心内容</div>
      </InstitutionNavigationShell>,
    );

    const desktopSidebar = screen.getByLabelText('机构端公共侧边栏');
    const expandedBoundary = '当前仅展示导航入口，不代表已授权或能力已开放';

    expect(within(desktopSidebar).getByText(expandedBoundary)).toHaveAttribute(
      'aria-label',
      expandedBoundary,
    );
    expect(within(desktopSidebar).getByText(expandedBoundary)).toHaveAttribute(
      'title',
      expandedBoundary,
    );
    expect(
      within(desktopSidebar).queryByText('栏目可见性由服务端权限与能力状态共同决定'),
    ).not.toBeInTheDocument();
    expect(screen.getByText('安全边界')).toBeInTheDocument();
    expect(screen.queryByText('安全访问')).not.toBeInTheDocument();

    for (const misleadingCurrentFact of ['已授权', '能力已开放', '生产放行']) {
      expect(screen.queryByText(misleadingCurrentFact)).not.toBeInTheDocument();
    }

    fireEvent.click(
      within(desktopSidebar).getByRole('button', { name: '收起机构端侧边栏' }),
    );
    expect(within(desktopSidebar).getByText('界')).toHaveAttribute(
      'aria-label',
      expandedBoundary,
    );
    expect(within(desktopSidebar).getByText('界')).toHaveAttribute('title', expandedBoundary);
    expect(within(desktopSidebar).queryByText(expandedBoundary)).not.toBeInTheDocument();
    expect(
      within(desktopSidebar).getByRole('button', { name: '展开机构端侧边栏' }),
    ).toBeInTheDocument();

    fireEvent.click(
      within(desktopSidebar).getByRole('button', { name: '展开机构端侧边栏' }),
    );
    expect(within(desktopSidebar).getByText(expandedBoundary)).toBeInTheDocument();
    expect(within(desktopSidebar).queryByText('界')).not.toBeInTheDocument();
  });

  it('未知 capability 默认 fail-closed，只展示明确可用的栏目', () => {
    render(
      <InstitutionNavigationShell
        activeSectionId="analytics"
        availableSectionIds={['workbench']}
      >
        <div>未发布页面</div>
      </InstitutionNavigationShell>,
    );

    const desktopNavigation = screen.getByRole('navigation', { name: '机构端桌面导航' });
    expect(within(desktopNavigation).getAllByRole('link')).toHaveLength(1);
    expect(within(desktopNavigation).getByRole('link', { name: '工作台' })).toHaveAttribute(
      'href',
      '/hospital',
    );
    expect(within(desktopNavigation).queryByText('经营分析')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '更多' })).not.toBeInTheDocument();
  });

  it('只解析冻结的 canonical 栏目根路径，不接受未知前缀', () => {
    expect(resolveInstitutionRouteSectionV1(['customers'])?.id).toBe('customers');
    expect(resolveInstitutionRouteSectionV1(['conversations'])?.id).toBe('conversations');
    expect(resolveInstitutionRouteSectionV1(['care', 'followups'])?.id).toBe('care');
    expect(resolveInstitutionRouteSectionV1(['analytics', 'opportunities'])?.id).toBe(
      'analytics',
    );
    expect(resolveInstitutionRouteSectionV1(['customers', 'customer-001'])?.id).toBe(
      'customers',
    );
    expect(resolveInstitutionRouteSectionV1(['system', 'ai-usage', 'services', 'knowledge_qa'])?.id).toBe(
      'system',
    );
    expect(resolveInstitutionRouteSectionV1(['system', 'typo'])).toBeNull();
    expect(resolveInstitutionRouteSectionV1(['customers', 'customer-001', 'extra'])).toBeNull();
    expect(resolveInstitutionRouteSectionV1(['customers', 'bad id'])).toBeNull();
    expect(resolveInstitutionRouteSectionV1(['service'])).toBeNull();
    expect(resolveInstitutionRouteSectionV1(['opportunities'])).toBeNull();
    expect(resolveInstitutionRouteSectionV1([])).toBeNull();
  });

  it.each(capabilityOffRouteCases)(
    '为合法深链 %j 返回冻结页面名称',
    (slug, routeId, pageLabel) => {
      const route = resolveInstitutionCapabilityOffRouteV1(slug);

      expect(route?.routeId).toBe(routeId);
      expect(route?.pageLabel).toBe(pageLabel);
      expect(route?.pageLabel).not.toContain(slug.at(-1) ?? '');
    },
  );

  it('为未发布深链显示统一安全状态，不渲染业务空壳或假数字', () => {
    const customers = INSTITUTION_NAVIGATION_SECTIONS_V1.find(
      (section) => section.id === 'customers',
    );

    if (!customers) throw new Error('customers section must exist');

    render(<InstitutionCapabilityOffPage section={customers} pageLabel="客户列表" />);

    expect(screen.getByRole('heading', { name: '客户中心 · 客户列表能力未开放', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('客户列表尚未开放')).toBeInTheDocument();
    expect(screen.getByText(/当前机构尚未获得该能力的生产放行。/u)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '返回工作台' })).toHaveAttribute(
      'href',
      '/hospital',
    );
    expect(screen.queryByText(/开发中|mock|fixture/i)).not.toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('会话能力静态边界')).not.toBeInTheDocument();
  });

  it('五个经营分析页面及合法详情深链只解析为同一阻断状态', () => {
    const analytics = INSTITUTION_NAVIGATION_SECTIONS_V1.find(
      (section) => section.id === 'analytics',
    );

    if (!analytics) throw new Error('analytics section must exist');

    const canonicalAnalyticsSlugs = [
      ['analytics'],
      ['analytics', 'consumption'],
      ['analytics', 'consumption', 'record-001'],
      ['analytics', 'projects'],
      ['analytics', 'projects', 'project:001'],
      ['analytics', 'opportunities'],
      ['analytics', 'opportunities', 'customer-001'],
      ['analytics', 'reports'],
      ['analytics', 'reports', 'report-001'],
    ];

    for (const slug of canonicalAnalyticsSlugs) {
      expect(resolveInstitutionCapabilityOffRouteV1(slug)?.section.id).toBe('analytics');
    }

    render(<InstitutionCapabilityOffPage section={analytics} pageLabel="经营总览" />);

    expect(screen.getByRole('heading', { name: '经营分析 · 经营总览能力未开放', level: 1 }).parentElement).toHaveAttribute(
      'data-capability-state',
      'blocked',
    );
    expect(screen.getByText('经营总览尚未开放')).toBeInTheDocument();
    expect(screen.queryByText(/unknown|stale|empty|mock|demo/iu)).not.toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('拒绝无效经营分析详情和旧机会兼容路径', () => {
    expect(resolveInstitutionRouteSectionV1(['analytics', 'consumption', 'bad id'])).toBeNull();
    expect(resolveInstitutionRouteSectionV1(['analytics', 'reports', 'report/001'])).toBeNull();
    expect(resolveInstitutionRouteSectionV1(['opportunities'])).toBeNull();
    expect(resolveInstitutionRouteSectionV1(['opportunities', 'customer-001'])).toBeNull();
  });

  it('正式会话根路由仍解析为 capability-off，且不显示模拟会话控件', () => {
    const conversationRoute = resolveInstitutionCapabilityOffRouteV1(['conversations']);
    const conversations = conversationRoute?.section;

    expect(conversations?.rootPath).toBe('/hospital/conversations');
    if (!conversations) throw new Error('conversations section must resolve');

    render(
      <InstitutionCapabilityOffPage
        section={conversations}
        pageLabel={conversationRoute.pageLabel}
      />,
    );

    expect(screen.getByText('会话队列尚未开放')).toBeInTheDocument();
    expect(screen.getByText(/当前机构尚未获得该能力的生产放行。/u)).toBeInTheDocument();
    expect(screen.queryByText(/fixture|mock_sent|dry-run|模拟发送|不真实发送/u)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '接管会话' })).not.toBeInTheDocument();
  });

  it.each([
    [['conversations'], '会话队列'],
    [['conversations', 'conversation-001'], '会话详情'],
    [['conversations', 'automations'], '自动触达'],
    [['conversations', 'automations', 'journey-001'], '自动触达详情'],
  ] as const)('会话 canonical 路由 %j 统一显示未读取、未验证和未启用边界', (slug, pageLabel) => {
    const route = resolveInstitutionCapabilityOffRouteV1(slug);
    if (!route) throw new Error('conversation route must resolve');

    const { unmount } = render(
      <InstitutionCapabilityOffPage section={route.section} pageLabel={pageLabel} />,
    );

    const boundary = screen.getByLabelText('会话能力静态边界');
    expect(within(boundary).getByText('会话事实')).toBeInTheDocument();
    expect(within(boundary).getByText('未读取')).toBeInTheDocument();
    expect(within(boundary).getByText('渠道状态')).toBeInTheDocument();
    expect(within(boundary).getByText('未验证')).toBeInTheDocument();
    expect(within(boundary).getByText('发送与自动触达')).toBeInTheDocument();
    expect(within(boundary).getByText('未启用')).toBeInTheDocument();
    expect(boundary).toHaveClass('sm:grid-cols-3');
    expect(
      screen.getByText(
        '当前未读取任何会话或渠道事实；未知状态不会被解释为零记录、空会话、历史消息或渠道已可用。',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '返回工作台' })).toHaveAttribute(
      'href',
      '/hospital',
    );
    expect(screen.queryByText(/^0$/u)).not.toBeInTheDocument();
    expect(screen.queryByText(/^暂无会话$/u)).not.toBeInTheDocument();
    expect(screen.queryByText(/^渠道可用$/u)).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();

    unmount();
  });
});

function mintNavigationDecision(
  targetSectionId: string,
  targetAccess: 'allowed' | 'blocked',
  availableSectionIds: readonly string[],
) {
  const decision = Object.freeze({
    kind: 'institution_navigation_authorization' as const,
    targetSectionId,
    targetAccess,
    availableSectionIds: Object.freeze([...availableSectionIds]),
  });
  wireMocks.genuineDecisions.add(decision);
  return decision;
}

describe('BASE-WIRE-01 canonical route authorization wiring', () => {
  beforeEach(() => {
    wireMocks.resolveInstitutionServerAuthorizationV1.mockReset();
    wireMocks.authorizeCurrentInstitutionNavigationV1.mockReset();
    wireMocks.resolveInstitutionServerAuthorizationV1.mockResolvedValue(
      wireMocks.authorization,
    );
  });

  it('resolves an unknown slug before authorization and keeps notFound at zero calls', async () => {
    await expect(
      HospitalCapabilityOffRoute({
        params: Promise.resolve({ slug: ['unknown-section'] }),
      }),
    ).rejects.toThrow(/404/u);
    expect(
      wireMocks.resolveInstitutionServerAuthorizationV1,
    ).not.toHaveBeenCalled();
    expect(
      wireMocks.authorizeCurrentInstitutionNavigationV1,
    ).not.toHaveBeenCalled();
  });

  it('uses one genuine admin decision for the exact target and seven-section capability-off shell', async () => {
    wireMocks.authorizeCurrentInstitutionNavigationV1.mockResolvedValueOnce(
      mintNavigationDecision('system', 'allowed', allSectionIds),
    );

    render(
      await HospitalCapabilityOffRoute({
        params: Promise.resolve({ slug: ['system'] }),
      }),
    );

    expect(
      wireMocks.resolveInstitutionServerAuthorizationV1,
    ).toHaveBeenCalledTimes(1);
    expect(
      wireMocks.authorizeCurrentInstitutionNavigationV1,
    ).toHaveBeenCalledTimes(1);
    expect(
      wireMocks.authorizeCurrentInstitutionNavigationV1,
    ).toHaveBeenCalledWith({ targetSectionId: 'system' });
    expect(screen.getByText('系统概览尚未开放')).toBeInTheDocument();
    const desktopNavigation = screen.getByRole('navigation', {
      name: '机构端桌面导航',
    });
    expect(within(desktopNavigation).getAllByRole('link')).toHaveLength(7);
    expect(
      within(desktopNavigation).getByRole('link', { name: '管理中心' }),
    ).toHaveAttribute('aria-current', 'page');
  });

  it('uses one genuine frontline decision for the canonical first four sections', async () => {
    wireMocks.authorizeCurrentInstitutionNavigationV1.mockResolvedValueOnce(
      mintNavigationDecision('customers', 'allowed', [
        'workbench',
        'customers',
        'conversations',
        'care',
      ]),
    );

    render(
      await HospitalCapabilityOffRoute({
        params: Promise.resolve({ slug: ['customers'] }),
      }),
    );

    expect(screen.getByText('客户列表尚未开放')).toBeInTheDocument();
    const desktopNavigation = screen.getByRole('navigation', {
      name: '机构端桌面导航',
    });
    expect(
      within(desktopNavigation)
        .getAllByRole('link')
        .map((link) => link.getAttribute('aria-label')),
    ).toEqual(['工作台', '客户中心', '会话工作台', '预约与随访']);
    expect(
      screen
        .getByRole('navigation', { name: '机构端移动导航' })
        .querySelector('button'),
    ).toBeNull();
  });

  it('renders forbidden with the frontline navigation when a genuine management target is blocked', async () => {
    wireMocks.authorizeCurrentInstitutionNavigationV1.mockResolvedValueOnce(
      mintNavigationDecision('knowledge', 'blocked', [
        'workbench',
        'customers',
        'conversations',
        'care',
      ]),
    );

    render(
      await HospitalCapabilityOffRoute({
        params: Promise.resolve({ slug: ['knowledge'] }),
      }),
    );

    expect(screen.getByText('当前账号不可访问该栏目')).toBeInTheDocument();
    expect(
      screen.getByText('当前仅确认栏目访问受限；未读取或展示任何业务数据。'),
    ).toBeInTheDocument();
    const desktopNavigation = screen.getByRole('navigation', {
      name: '机构端桌面导航',
    });
    expect(within(desktopNavigation).getAllByRole('link')).toHaveLength(4);
    expect(
      within(desktopNavigation).queryByRole('link', { name: '知识库' }),
    ).not.toBeInTheDocument();
    expect(document.querySelector('[aria-current="page"]')).toBeNull();
    const main = screen.getByRole('main');
    expect(within(main).queryByText(/^\d+$/u)).not.toBeInTheDocument();
    expect(within(main).queryAllByRole('button')).toHaveLength(0);
    expect(within(main).queryAllByRole('link')).toHaveLength(0);
  });

  it('maps dependency, authenticity, empty and target-mismatch failures to unavailable with empty navigation', async () => {
    let getterReads = 0;
    let proxyTraps = 0;
    const fakeAuthorizationAccessor: Record<string, unknown> = {};
    Object.defineProperty(
      fakeAuthorizationAccessor,
      'authorizeCurrentInstitutionNavigationV1',
      {
        enumerable: true,
        get() {
          getterReads += 1;
          throw new Error('authorization getter must not run');
        },
      },
    );
    const genuineDecision = mintNavigationDecision('analytics', 'allowed', [
      'workbench',
      'customers',
      'conversations',
      'care',
      'knowledge',
      'analytics',
      'system',
    ]);
    const decisionAccessor: Record<string, unknown> = {};
    Object.defineProperty(decisionAccessor, 'targetAccess', {
      enumerable: true,
      get() {
        getterReads += 1;
        throw new Error('decision getter must not run');
      },
    });
    const decisionProxy = new Proxy(genuineDecision, {
      getPrototypeOf() {
        proxyTraps += 1;
        throw new Error('decision proxy trap must not run');
      },
    });
    const revokedDecision = Proxy.revocable(genuineDecision, {
      getPrototypeOf() {
        proxyTraps += 1;
        throw new Error('revoked decision trap must not run');
      },
    });
    revokedDecision.revoke();

    const cases: readonly (() => void)[] = [
      () => {
        wireMocks.resolveInstitutionServerAuthorizationV1.mockResolvedValueOnce(
          null,
        );
      },
      () => {
        wireMocks.resolveInstitutionServerAuthorizationV1.mockRejectedValueOnce(
          new Error('server authorization unavailable'),
        );
      },
      () => {
        wireMocks.resolveInstitutionServerAuthorizationV1.mockResolvedValueOnce(
          fakeAuthorizationAccessor,
        );
      },
      () => {
        wireMocks.authorizeCurrentInstitutionNavigationV1.mockRejectedValueOnce(
          new Error('navigation unavailable'),
        );
      },
      () => {
        wireMocks.authorizeCurrentInstitutionNavigationV1.mockResolvedValueOnce({
          kind: 'institution_navigation_authorization',
          targetSectionId: 'analytics',
          targetAccess: 'allowed',
          availableSectionIds: allSectionIds,
        });
      },
      () => {
        wireMocks.authorizeCurrentInstitutionNavigationV1.mockResolvedValueOnce({
          ...genuineDecision,
        });
      },
      () => {
        wireMocks.authorizeCurrentInstitutionNavigationV1.mockResolvedValueOnce(
          decisionAccessor,
        );
      },
      () => {
        wireMocks.authorizeCurrentInstitutionNavigationV1.mockResolvedValueOnce(
          decisionProxy,
        );
      },
      () => {
        wireMocks.authorizeCurrentInstitutionNavigationV1.mockResolvedValueOnce(
          revokedDecision.proxy,
        );
      },
      () => {
        wireMocks.authorizeCurrentInstitutionNavigationV1.mockResolvedValueOnce(
          mintNavigationDecision('system', 'allowed', allSectionIds),
        );
      },
      () => {
        wireMocks.authorizeCurrentInstitutionNavigationV1.mockResolvedValueOnce(
          mintNavigationDecision('analytics', 'blocked', []),
        );
      },
    ];

    for (const configure of cases) {
      wireMocks.resolveInstitutionServerAuthorizationV1.mockReset();
      wireMocks.authorizeCurrentInstitutionNavigationV1.mockReset();
      wireMocks.resolveInstitutionServerAuthorizationV1.mockResolvedValue(
        wireMocks.authorization,
      );
      configure();
      const { unmount } = render(
        await HospitalCapabilityOffRoute({
          params: Promise.resolve({ slug: ['analytics'] }),
        }),
      );

      expect(screen.getByText('机构访问状态暂时不可用')).toBeInTheDocument();
      const desktopNavigation = screen.getByRole('navigation', {
        name: '机构端桌面导航',
      });
      expect(within(desktopNavigation).queryAllByRole('link')).toHaveLength(0);
      expect(document.querySelector('[aria-current="page"]')).toBeNull();
      unmount();
    }
    expect(getterReads).toBe(0);
    expect(proxyTraps).toBe(0);
  });
});

describe('POST-V2-R1C /hospital/system/audit admin-only readonly release route', () => {
  beforeEach(() => {
    wireMocks.resolveInstitutionServerAuthorizationV1.mockReset();
    wireMocks.authorizeCurrentInstitutionNavigationV1.mockReset();
    wireMocks.resolveInstitutionAuditReadAuthorizationV1.mockReset();
    wireMocks.consumeInstitutionAuditReadAuthorizationV1.mockReset();
    wireMocks.resolveInstitutionCapabilityAuthorityStatusV1.mockReset();
    wireMocks.resolveInstitutionServerAuthorizationV1.mockResolvedValue(
      wireMocks.authorization,
    );
    wireMocks.resolveInstitutionAuditReadAuthorizationV1.mockResolvedValue({
      kind: 'allowed',
      authorization: wireMocks.auditReadAuthorizationHandle,
    });
    wireMocks.resolveInstitutionCapabilityAuthorityStatusV1.mockResolvedValue(
      auditAuthorityStatus(),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps the canonical direct URL request-scoped and preserves the shared catch-all mapping', () => {
    expect(hospitalSystemAuditDynamicMode).toBe('force-dynamic');
    expect(resolveInstitutionCapabilityOffRouteV1(['system', 'audit'])).toMatchObject({
      routeId: 'system_audit',
      section: { id: 'system' },
    });
  });

  it('tenant_admin enters the direct route through genuine navigation, Audit owner, and exact Authority', async () => {
    wireMocks.authorizeCurrentInstitutionNavigationV1.mockResolvedValueOnce(
      mintNavigationDecision('system', 'allowed', allSectionIds),
    );
    const fetchMock = vi.fn<typeof fetch>(
      async () => partialVerifiedEmptyAuditResponse(),
    );
    vi.stubGlobal('fetch', fetchMock);

    render(await HospitalSystemAuditPage());

    expect(
      wireMocks.authorizeCurrentInstitutionNavigationV1,
    ).toHaveBeenCalledWith({ targetSectionId: 'system' });
    expect(
      wireMocks.resolveInstitutionAuditReadAuthorizationV1,
    ).toHaveBeenCalledTimes(1);
    expect(
      wireMocks.consumeInstitutionAuditReadAuthorizationV1,
    ).not.toHaveBeenCalled();
    expect(
      wireMocks.resolveInstitutionCapabilityAuthorityStatusV1,
    ).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('heading', { name: '审计日志' })).toBeInTheDocument();
    expect(screen.getByText('当前机构只读')).toBeInTheDocument();
    expect(
      await screen.findByText('暂无可信记录，历史覆盖不完整'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/不能据此判断本机构从未发生审计事件/u),
    ).toBeInTheDocument();
    expect(screen.getByText(/页内统计不是完整历史总量/u)).toBeInTheDocument();
    expect(screen.queryByText('可信历史覆盖完整')).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/institution/audit-events', {
      cache: 'no-store',
    });
    expect(fetchMock.mock.calls[0]?.[1]).not.toHaveProperty('method');
    expect(fetchMock.mock.calls[0]?.[1]).not.toHaveProperty('body');
    expect(
      screen.queryByRole('button', { name: /export|download|导出|下载/iu }),
    ).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(
      /tenant-s18-route-001|institution-s18-route-001|tenant_admin|authorization_handle|role_provenance|membership_evidence|binding_evidence|formal_server_session|cookie/iu,
    );
  });

  it('tenant_operator is forbidden by the Audit owner after genuine system navigation', async () => {
    wireMocks.authorizeCurrentInstitutionNavigationV1.mockResolvedValueOnce(
      mintNavigationDecision('system', 'allowed', allSectionIds),
    );
    wireMocks.resolveInstitutionAuditReadAuthorizationV1.mockResolvedValueOnce({
      kind: 'forbidden',
    });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    render(await HospitalSystemAuditPage());

    expect(screen.getByText('当前账号不可访问该栏目')).toBeInTheDocument();
    expect(
      wireMocks.resolveInstitutionAuditReadAuthorizationV1,
    ).toHaveBeenCalledTimes(1);
    expect(
      wireMocks.resolveInstitutionCapabilityAuthorityStatusV1,
    ).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByRole('heading', { name: '审计日志' })).not.toBeInTheDocument();
    expect(screen.queryByText('审计与安全尚未开放')).not.toBeInTheDocument();
  });

  it.each(['consultant', 'customer_service'] as const)(
    '%s is forbidden by genuine blocked system navigation before Audit owner and Authority',
    async () => {
      wireMocks.authorizeCurrentInstitutionNavigationV1.mockResolvedValueOnce(
        mintNavigationDecision('system', 'blocked', [
          'workbench',
          'customers',
          'conversations',
          'care',
        ]),
      );
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);

      render(await HospitalSystemAuditPage());

      expect(screen.getByText('当前账号不可访问该栏目')).toBeInTheDocument();
      expect(
        wireMocks.resolveInstitutionAuditReadAuthorizationV1,
      ).not.toHaveBeenCalled();
      expect(
        wireMocks.resolveInstitutionCapabilityAuthorityStatusV1,
      ).not.toHaveBeenCalled();
      expect(fetchMock).not.toHaveBeenCalled();
      expect(screen.queryByRole('heading', { name: '审计日志' })).not.toBeInTheDocument();
    },
  );

  it('formal request authorization unavailable renders unavailable with empty navigation', async () => {
    wireMocks.resolveInstitutionServerAuthorizationV1.mockResolvedValueOnce(null);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    render(await HospitalSystemAuditPage());

    expect(screen.getByText('机构审计能力暂时不可用')).toBeInTheDocument();
    expect(
      wireMocks.authorizeCurrentInstitutionNavigationV1,
    ).not.toHaveBeenCalled();
    expect(
      wireMocks.resolveInstitutionAuditReadAuthorizationV1,
    ).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(
      within(screen.getByRole('navigation', { name: '机构端桌面导航' }))
        .queryAllByRole('link'),
    ).toHaveLength(0);
  });

  it.each(['reject', 'target_mismatch', 'non_genuine'] as const)(
    'navigation authorization %s fails closed before Audit owner and Authority',
    async (failure) => {
      if (failure === 'reject') {
        wireMocks.authorizeCurrentInstitutionNavigationV1.mockRejectedValueOnce(
          new Error('navigation unavailable'),
        );
      } else if (failure === 'target_mismatch') {
        wireMocks.authorizeCurrentInstitutionNavigationV1.mockResolvedValueOnce(
          mintNavigationDecision('analytics', 'allowed', allSectionIds),
        );
      } else {
        wireMocks.authorizeCurrentInstitutionNavigationV1.mockResolvedValueOnce({
          kind: 'institution_navigation_authorization',
          targetSectionId: 'system',
          targetAccess: 'allowed',
          availableSectionIds: allSectionIds,
        });
      }

      render(await HospitalSystemAuditPage());

      expect(screen.getByText('机构审计能力暂时不可用')).toBeInTheDocument();
      expect(
        wireMocks.resolveInstitutionAuditReadAuthorizationV1,
      ).not.toHaveBeenCalled();
      expect(
        wireMocks.resolveInstitutionCapabilityAuthorityStatusV1,
      ).not.toHaveBeenCalled();
      expect(screen.queryByRole('heading', { name: '审计日志' })).not.toBeInTheDocument();
    },
  );

  it.each(['unavailable', 'reject'] as const)(
    'Audit authorization %s renders unavailable without Authority or Audit data',
    async (failure) => {
      wireMocks.authorizeCurrentInstitutionNavigationV1.mockResolvedValueOnce(
        mintNavigationDecision('system', 'allowed', allSectionIds),
      );
      if (failure === 'unavailable') {
        wireMocks.resolveInstitutionAuditReadAuthorizationV1.mockResolvedValueOnce({
          kind: 'unavailable',
        });
      } else {
        wireMocks.resolveInstitutionAuditReadAuthorizationV1.mockRejectedValueOnce(
          new Error('Audit owner unavailable'),
        );
      }
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);

      render(await HospitalSystemAuditPage());

      expect(screen.getByText('机构审计能力暂时不可用')).toBeInTheDocument();
      expect(
        wireMocks.resolveInstitutionCapabilityAuthorityStatusV1,
      ).not.toHaveBeenCalled();
      expect(fetchMock).not.toHaveBeenCalled();
      expect(screen.queryByRole('heading', { name: '审计日志' })).not.toBeInTheDocument();
    },
  );

  it.each([
    {
      name: 'hidden',
      status: auditAuthorityStatus({
        decision: 'hidden',
        productionRelease: 'not_released',
        safeSummary: null,
      }),
    },
    { name: 'missing', status: auditAuthorityStatus({ missing: true }) },
    { name: 'duplicate', status: auditAuthorityStatus({ duplicate: true }) },
    {
      name: 'capability key mismatch',
      status: auditAuthorityStatus({ key: 'page_system_overview' }),
    },
    {
      name: 'shape mismatch',
      status: auditAuthorityStatus({ dataReadiness: 'ready' }),
    },
  ])('Authority $name renders capability-off without reading Audit data', async ({ status }) => {
    wireMocks.authorizeCurrentInstitutionNavigationV1.mockResolvedValueOnce(
      mintNavigationDecision('system', 'allowed', allSectionIds),
    );
    wireMocks.resolveInstitutionCapabilityAuthorityStatusV1.mockResolvedValueOnce(
      status,
    );
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    render(await HospitalSystemAuditPage());

    expect(screen.getByText('审计与安全尚未开放')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByRole('heading', { name: '审计日志' })).not.toBeInTheDocument();
  });

  it.each(['null', 'reject'] as const)(
    'Authority unavailable via %s renders unavailable without Audit data',
    async (failure) => {
      wireMocks.authorizeCurrentInstitutionNavigationV1.mockResolvedValueOnce(
        mintNavigationDecision('system', 'allowed', allSectionIds),
      );
      if (failure === 'null') {
        wireMocks.resolveInstitutionCapabilityAuthorityStatusV1.mockResolvedValueOnce(
          null,
        );
      } else {
        wireMocks.resolveInstitutionCapabilityAuthorityStatusV1.mockRejectedValueOnce(
          new Error('Authority unavailable'),
        );
      }
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);

      render(await HospitalSystemAuditPage());

      expect(screen.getByText('机构审计能力暂时不可用')).toBeInTheDocument();
      expect(fetchMock).not.toHaveBeenCalled();
      expect(screen.queryByRole('heading', { name: '审计日志' })).not.toBeInTheDocument();
    },
  );

  it('keeps the shared catch-all audit page and an unrelated hidden page unchanged', async () => {
    wireMocks.authorizeCurrentInstitutionNavigationV1.mockResolvedValue(
      mintNavigationDecision('system', 'allowed', allSectionIds),
    );

    const auditRoute = render(
      await HospitalCapabilityOffRoute({
        params: Promise.resolve({ slug: ['system', 'audit'] }),
      }),
    );
    expect(screen.getByText('审计与安全尚未开放')).toBeInTheDocument();
    expect(
      wireMocks.resolveInstitutionAuditReadAuthorizationV1,
    ).not.toHaveBeenCalled();
    auditRoute.unmount();

    render(
      await HospitalCapabilityOffRoute({
        params: Promise.resolve({ slug: ['system', 'privacy'] }),
      }),
    );
    expect(screen.getByText('数据与隐私尚未开放')).toBeInTheDocument();
    expect(
      wireMocks.resolveInstitutionCapabilityAuthorityStatusV1,
    ).not.toHaveBeenCalled();
  });
});
