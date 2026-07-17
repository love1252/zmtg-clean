import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  INSTITUTION_NAVIGATION_SECTION_IDS_V1,
  INSTITUTION_NAVIGATION_SECTIONS_V1,
} from '@/modules/institution-contracts/v1/institution-navigation';
import { InstitutionCapabilityOffPage, resolveInstitutionRouteSectionV1 } from '@/modules/institution/components/InstitutionCapabilityOffPage';
import { InstitutionNavigationShell } from '@/modules/institution/components/InstitutionNavigationShell';

const allSectionIds = INSTITUTION_NAVIGATION_SECTION_IDS_V1;

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

  it('为未发布深链显示统一安全状态，不渲染业务空壳或假数字', () => {
    const customers = INSTITUTION_NAVIGATION_SECTIONS_V1.find(
      (section) => section.id === 'customers',
    );

    if (!customers) throw new Error('customers section must exist');

    render(<InstitutionCapabilityOffPage section={customers} />);

    expect(screen.getByText('客户中心尚未开放')).toBeInTheDocument();
    expect(screen.getByText(/当前机构尚未获得该能力的生产放行。/u)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '返回工作台' })).toHaveAttribute(
      'href',
      '/hospital',
    );
    expect(screen.queryByText(/开发中|mock|fixture/i)).not.toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });
});
