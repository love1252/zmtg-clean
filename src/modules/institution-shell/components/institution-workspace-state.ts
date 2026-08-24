import type { InstitutionNavigationSectionIdV1 } from '@/modules/institution-contracts/v1/institution-navigation';

export const INSTITUTION_WORKSPACE_STORAGE_KEY_V1 =
  'zmtg:institution-workspace-paths:v1' as const;
export const INSTITUTION_WORKSPACE_STORAGE_KEY_PREFIX_V2 =
  'zmtg:institution-workspace-paths:v2:' as const;
export const INSTITUTION_WORKSPACE_MAX_TABS_V1 = 8 as const;

const WORKSPACE_SCOPE_KEY_V2 = /^[A-Za-z0-9_-]{43}$/u;

export type InstitutionWorkspaceTabV1 = Readonly<{
  pathname: string;
  label: string;
  sectionId: InstitutionNavigationSectionIdV1;
  authorizationPath: string;
  fixed: boolean;
  objectTab: boolean;
}>;

export function resolveInstitutionWorkspaceStorageKeyV2(
  workspaceScopeKey: unknown,
): string | null {
  return typeof workspaceScopeKey === 'string'
    && WORKSPACE_SCOPE_KEY_V2.test(workspaceScopeKey)
    ? `${INSTITUTION_WORKSPACE_STORAGE_KEY_PREFIX_V2}${workspaceScopeKey}`
    : null;
}

const staticTabs = Object.freeze([
  {
    pathname: '/hospital',
    label: '工作台',
    sectionId: 'workbench',
    authorizationPath: '/hospital',
    fixed: true,
    objectTab: false,
  },
  {
    pathname: '/hospital/customers',
    label: '客户列表',
    sectionId: 'customers',
    authorizationPath: '/hospital/customers',
    fixed: false,
    objectTab: false,
  },
  {
    pathname: '/hospital/conversations',
    label: '会话队列',
    sectionId: 'conversations',
    authorizationPath: '/hospital/conversations',
    fixed: false,
    objectTab: false,
  },
  {
    pathname: '/hospital/care/appointments',
    label: '预约管理',
    sectionId: 'care',
    authorizationPath: '/hospital/care/appointments',
    fixed: false,
    objectTab: false,
  },
  {
    pathname: '/hospital/care/followups',
    label: '随访任务',
    sectionId: 'care',
    authorizationPath: '/hospital/care/followups',
    fixed: false,
    objectTab: false,
  },
  {
    pathname: '/hospital/knowledge',
    label: '资料库',
    sectionId: 'knowledge',
    authorizationPath: '/hospital/knowledge',
    fixed: false,
    objectTab: false,
  },
  {
    pathname: '/hospital/analytics',
    label: '经营总览',
    sectionId: 'analytics',
    authorizationPath: '/hospital/analytics',
    fixed: false,
    objectTab: false,
  },
  {
    pathname: '/hospital/system/ai-usage',
    label: 'AI 与额度',
    sectionId: 'system',
    authorizationPath: '/hospital/system/ai-usage',
    fixed: false,
    objectTab: false,
  },
  {
    pathname: '/hospital/system/audit',
    label: '审计与安全',
    sectionId: 'system',
    authorizationPath: '/hospital/system/audit',
    fixed: false,
    objectTab: false,
  },
] as const satisfies readonly InstitutionWorkspaceTabV1[]);

const safeObjectId = '[A-Za-z0-9][A-Za-z0-9._:-]{0,127}';
const objectTabPatterns = Object.freeze([
  {
    pattern: new RegExp(`^/hospital/customers/${safeObjectId}$`, 'u'),
    reservedSegment: 'treatments',
    labelPrefix: '客户',
    sectionId: 'customers',
    authorizationPath: '/hospital/customers',
  },
  {
    pattern: new RegExp(`^/hospital/conversations/${safeObjectId}$`, 'u'),
    reservedSegment: 'automations',
    labelPrefix: '会话',
    sectionId: 'conversations',
    authorizationPath: '/hospital/conversations',
  },
  {
    pattern: new RegExp(`^/hospital/care/appointments/${safeObjectId}$`, 'u'),
    reservedSegment: null,
    labelPrefix: '预约',
    sectionId: 'care',
    authorizationPath: '/hospital/care/appointments',
  },
  {
    pattern: new RegExp(`^/hospital/care/followups/${safeObjectId}$`, 'u'),
    reservedSegment: null,
    labelPrefix: '随访',
    sectionId: 'care',
    authorizationPath: '/hospital/care/followups',
  },
] as const satisfies readonly Readonly<{
  pattern: RegExp;
  reservedSegment: string | null;
  labelPrefix: string;
  sectionId: InstitutionNavigationSectionIdV1;
  authorizationPath: string;
}>[]);

function hasReservedTail(pathname: string, reservedSegment: string | null) {
  return reservedSegment !== null && pathname.endsWith(`/${reservedSegment}`);
}

function opaqueObjectIdTail(pathname: string) {
  const opaqueId = pathname.slice(pathname.lastIndexOf('/') + 1);
  return opaqueId.slice(-4);
}

export function resolveInstitutionWorkspaceTabV1(
  pathname: unknown,
): InstitutionWorkspaceTabV1 | null {
  if (
    typeof pathname !== 'string'
    || pathname.length < 9
    || pathname.length > 320
    || pathname.includes('?')
    || pathname.includes('#')
    || pathname.includes('//')
  ) {
    return null;
  }

  const staticTab = staticTabs.find((candidate) => candidate.pathname === pathname);
  if (staticTab) return staticTab;

  const objectTab = objectTabPatterns.find(
    (candidate) =>
      !hasReservedTail(pathname, candidate.reservedSegment)
      && candidate.pattern.test(pathname),
  );
  if (!objectTab) return null;

  return Object.freeze({
    pathname,
    label: `${objectTab.labelPrefix} · ${opaqueObjectIdTail(pathname)}`,
    sectionId: objectTab.sectionId,
    authorizationPath: objectTab.authorizationPath,
    fixed: false,
    objectTab: true,
  });
}

export function parseInstitutionWorkspaceStoredPathsV1(
  value: unknown,
): readonly string[] {
  if (!Array.isArray(value) || value.length > INSTITUTION_WORKSPACE_MAX_TABS_V1 * 2) {
    return Object.freeze([]);
  }

  const paths: string[] = [];
  for (const item of value) {
    const tab = resolveInstitutionWorkspaceTabV1(item);
    if (!tab || tab.fixed || paths.includes(tab.pathname)) continue;
    paths.push(tab.pathname);
  }

  return Object.freeze(paths.slice(-INSTITUTION_WORKSPACE_MAX_TABS_V1 + 1));
}

export function mergeInstitutionWorkspaceTabsV1(
  storedPaths: unknown,
  currentPathname: unknown,
): readonly InstitutionWorkspaceTabV1[] {
  const paths = [...parseInstitutionWorkspaceStoredPathsV1(storedPaths)];
  const currentTab = resolveInstitutionWorkspaceTabV1(currentPathname);

  if (currentTab && !currentTab.fixed && !paths.includes(currentTab.pathname)) {
    paths.push(currentTab.pathname);
  }

  const closeablePaths = paths.slice(-INSTITUTION_WORKSPACE_MAX_TABS_V1 + 1);
  const tabs: InstitutionWorkspaceTabV1[] = [staticTabs[0]];
  for (const pathname of closeablePaths) {
    const tab = resolveInstitutionWorkspaceTabV1(pathname);
    if (tab) tabs.push(tab);
  }

  return Object.freeze(tabs);
}

export function closeInstitutionWorkspaceTabV1(
  tabs: readonly InstitutionWorkspaceTabV1[],
  pathname: unknown,
): readonly InstitutionWorkspaceTabV1[] {
  if (typeof pathname !== 'string' || pathname === '/hospital') return tabs;

  const next = tabs.filter((tab) => tab.fixed || tab.pathname !== pathname);
  return Object.freeze(next);
}

export function closeOtherInstitutionWorkspaceTabsV1(
  tabs: readonly InstitutionWorkspaceTabV1[],
  currentPathname: unknown,
): readonly InstitutionWorkspaceTabV1[] {
  if (typeof currentPathname !== 'string') return tabs;
  const current = tabs.find((tab) => tab.pathname === currentPathname);
  if (!current) return tabs;

  return Object.freeze(
    tabs.filter((tab) => tab.fixed || tab.pathname === current.pathname),
  );
}

export function closeRightInstitutionWorkspaceTabsV1(
  tabs: readonly InstitutionWorkspaceTabV1[],
  currentPathname: unknown,
): readonly InstitutionWorkspaceTabV1[] {
  if (typeof currentPathname !== 'string') return tabs;
  const currentIndex = tabs.findIndex((tab) => tab.pathname === currentPathname);
  if (currentIndex < 0) return tabs;

  return Object.freeze(
    tabs.filter((tab, index) => tab.fixed || index <= currentIndex),
  );
}

export function closeAllInstitutionWorkspaceTabsV1(
  tabs: readonly InstitutionWorkspaceTabV1[],
): readonly InstitutionWorkspaceTabV1[] {
  const fixedTabs = tabs.filter((tab) => tab.fixed);
  return Object.freeze(fixedTabs);
}

export function filterInstitutionWorkspaceTabsByPagePathsV1(
  tabs: readonly InstitutionWorkspaceTabV1[],
  availablePagePaths: readonly string[],
): readonly InstitutionWorkspaceTabV1[] {
  const allowedPaths = new Set(
    availablePagePaths.filter((pathname) =>
      staticTabs.some((tab) => tab.pathname === pathname),
    ),
  );

  return Object.freeze(
    tabs.filter((tab) => allowedPaths.has(tab.authorizationPath)),
  );
}
