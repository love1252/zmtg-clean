import { describe, expect, it } from 'vitest';
import {
  INSTITUTION_WORKSPACE_MAX_TABS_V1,
  closeAllInstitutionWorkspaceTabsV1,
  closeInstitutionWorkspaceTabV1,
  closeOtherInstitutionWorkspaceTabsV1,
  closeRightInstitutionWorkspaceTabsV1,
  filterInstitutionWorkspaceTabsByPagePathsV1,
  mergeInstitutionWorkspaceTabsV1,
  parseInstitutionWorkspaceStoredPathsV1,
  resolveInstitutionWorkspaceStorageKeyV2,
  resolveInstitutionWorkspaceTabV1,
} from '@/modules/institution-shell/components/institution-workspace-state';

describe('机构端工作区低敏 canonical 路径状态', () => {
  it('只接受服务端 opaque 作用域摘要构造 V2 Key', () => {
    expect(resolveInstitutionWorkspaceStorageKeyV2('A'.repeat(43))).toBe(
      `zmtg:institution-workspace-paths:v2:${'A'.repeat(43)}`,
    );
    expect(resolveInstitutionWorkspaceStorageKeyV2(null)).toBeNull();
    expect(resolveInstitutionWorkspaceStorageKeyV2('tenant-a:institution-a')).toBeNull();
    expect(resolveInstitutionWorkspaceStorageKeyV2('A'.repeat(42))).toBeNull();
  });

  it('只接受正式页面和受控对象详情路径，并用不透明 ID 尾号区分对象标签', () => {
    expect(resolveInstitutionWorkspaceTabV1('/hospital/customers')).toMatchObject({
      label: '客户列表',
      sectionId: 'customers',
      authorizationPath: '/hospital/customers',
      objectTab: false,
    });
    expect(
      resolveInstitutionWorkspaceTabV1('/hospital/customers/customer-00000123'),
    ).toMatchObject({
      label: '客户 · 0123',
      sectionId: 'customers',
      authorizationPath: '/hospital/customers',
      objectTab: true,
    });
    expect(
      resolveInstitutionWorkspaceTabV1('/hospital/conversations/conversation-00008842'),
    ).toMatchObject({ label: '会话 · 8842', authorizationPath: '/hospital/conversations' });
    expect(
      resolveInstitutionWorkspaceTabV1('/hospital/care/appointments/appointment-00004567'),
    ).toMatchObject({ label: '预约 · 4567', authorizationPath: '/hospital/care/appointments' });
    expect(
      resolveInstitutionWorkspaceTabV1('/hospital/care/followups/followup-00009876'),
    ).toMatchObject({ label: '随访 · 9876', authorizationPath: '/hospital/care/followups' });
    expect(resolveInstitutionWorkspaceTabV1('/hospital/customers/treatments')).toBeNull();
    expect(resolveInstitutionWorkspaceTabV1('/hospital/conversations/automations')).toBeNull();
    expect(resolveInstitutionWorkspaceTabV1('/hospital/system/channels')).toBeNull();
    expect(resolveInstitutionWorkspaceTabV1('/hospital/customers/bad id')).toBeNull();
    expect(resolveInstitutionWorkspaceTabV1('/hospital/customers/customer-001?tab=ai')).toBeNull();
  });

  it('丢弃损坏、未知和重复路径，不持久化固定工作台标签', () => {
    expect(
      parseInstitutionWorkspaceStoredPathsV1([
        '/hospital',
        '/hospital/customers/customer-00000123',
        '/hospital/customers/customer-00000123',
        '/hospital/system/channels',
        42,
      ]),
    ).toEqual(['/hospital/customers/customer-00000123']);
    expect(parseInstitutionWorkspaceStoredPathsV1({ pathname: '/hospital' })).toEqual([]);
  });

  it('同一对象路径去重，不同对象路径保留可区分标签和原有可见顺序', () => {
    const tabs = mergeInstitutionWorkspaceTabsV1(
      [
        '/hospital/customers/customer-00000123',
        '/hospital/customers/customer-00008842',
        '/hospital/customers/customer-00000123',
      ],
      '/hospital/customers/customer-00000123',
    );

    expect(tabs.map((tab) => tab.pathname)).toEqual([
      '/hospital',
      '/hospital/customers/customer-00000123',
      '/hospital/customers/customer-00008842',
    ]);
    expect(tabs.map((tab) => tab.label)).toEqual([
      '工作台',
      '客户 · 0123',
      '客户 · 8842',
    ]);
  });

  it('实现关闭当前、其他、右侧和全部，同时始终保留固定工作台', () => {
    const tabs = mergeInstitutionWorkspaceTabsV1(
      [
        '/hospital/customers',
        '/hospital/conversations',
        '/hospital/care/appointments',
      ],
      '/hospital/conversations',
    );

    expect(closeInstitutionWorkspaceTabV1(tabs, '/hospital')).toBe(tabs);
    expect(
      closeInstitutionWorkspaceTabV1(tabs, '/hospital/conversations').map((tab) => tab.pathname),
    ).toEqual(['/hospital', '/hospital/customers', '/hospital/care/appointments']);
    expect(
      closeOtherInstitutionWorkspaceTabsV1(tabs, '/hospital/conversations').map(
        (tab) => tab.pathname,
      ),
    ).toEqual(['/hospital', '/hospital/conversations']);
    expect(
      closeRightInstitutionWorkspaceTabsV1(tabs, '/hospital/conversations').map(
        (tab) => tab.pathname,
      ),
    ).toEqual(['/hospital', '/hospital/customers', '/hospital/conversations']);
    expect(closeAllInstitutionWorkspaceTabsV1(tabs).map((tab) => tab.pathname)).toEqual([
      '/hospital',
    ]);
  });

  it('页面级 Capability 过滤静态与对象标签，权限变化后不保留原路径', () => {
    const tabs = mergeInstitutionWorkspaceTabsV1(
      [
        '/hospital/customers/customer-00000123',
        '/hospital/conversations/conversation-00008842',
      ],
      '/hospital/customers/customer-00000123',
    );

    expect(
      filterInstitutionWorkspaceTabsByPagePathsV1(tabs, [
        '/hospital',
        '/hospital/conversations',
      ]).map((tab) => tab.pathname),
    ).toEqual(['/hospital', '/hospital/conversations/conversation-00008842']);
  });

  it('异常授权结果不含固定入口时，关闭操作不注入未授权工作台', () => {
    const customerTab = resolveInstitutionWorkspaceTabV1('/hospital/customers');
    if (!customerTab) throw new Error('customer tab fixture missing');

    expect(closeAllInstitutionWorkspaceTabsV1([customerTab])).toEqual([]);
    expect(
      closeInstitutionWorkspaceTabV1([customerTab], customerTab.pathname),
    ).toEqual([]);
  });

  it('最多保留八个标签且工作台不可关闭', () => {
    const storedPaths = Array.from(
      { length: INSTITUTION_WORKSPACE_MAX_TABS_V1 + 4 },
      (_, index) => `/hospital/customers/customer-${index}`,
    );
    const tabs = mergeInstitutionWorkspaceTabsV1(
      storedPaths,
      '/hospital/customers/customer-current',
    );

    expect(tabs).toHaveLength(INSTITUTION_WORKSPACE_MAX_TABS_V1);
    expect(tabs.at(0)).toMatchObject({ pathname: '/hospital', fixed: true });
    expect(tabs.at(-1)?.pathname).toBe('/hospital/customers/customer-current');
    expect(closeInstitutionWorkspaceTabV1(tabs, '/hospital')).toBe(tabs);
  });
});
