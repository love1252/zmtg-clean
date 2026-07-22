import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
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
});
