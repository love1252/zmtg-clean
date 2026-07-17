function freezeContractValueV1<const T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }

  for (const nestedValue of Object.values(value as Record<string, unknown>)) {
    freezeContractValueV1(nestedValue);
  }

  Object.freeze(value);
  return value;
}

export const INSTITUTION_ROLES_V1 = freezeContractValueV1([
  'tenant_admin',
  'tenant_operator',
  'consultant',
  'customer_service',
] as const);

export type InstitutionRoleV1 = (typeof INSTITUTION_ROLES_V1)[number];

export const INSTITUTION_NAVIGATION_SECTION_IDS_V1 = freezeContractValueV1([
  'workbench',
  'customers',
  'conversations',
  'care',
  'knowledge',
  'analytics',
  'system',
] as const);

export type InstitutionNavigationSectionIdV1 =
  (typeof INSTITUTION_NAVIGATION_SECTION_IDS_V1)[number];

type InstitutionNavigationSectionDefinitionV1 = Readonly<{
  id: InstitutionNavigationSectionIdV1;
  label: string;
  rootPath: string;
  roleAudience: readonly InstitutionRoleV1[];
}>;

const ALL_INSTITUTION_ROLES_V1 = INSTITUTION_ROLES_V1;

const MANAGEMENT_INSTITUTION_ROLES_V1 = freezeContractValueV1([
  'tenant_admin',
  'tenant_operator',
] as const satisfies readonly InstitutionRoleV1[]);

export const INSTITUTION_NAVIGATION_SECTIONS_V1 = freezeContractValueV1([
  {
    id: 'workbench',
    label: '工作台',
    rootPath: '/hospital',
    roleAudience: ALL_INSTITUTION_ROLES_V1,
  },
  {
    id: 'customers',
    label: '客户中心',
    rootPath: '/hospital/customers',
    roleAudience: ALL_INSTITUTION_ROLES_V1,
  },
  {
    id: 'conversations',
    label: '会话工作台',
    rootPath: '/hospital/conversations',
    roleAudience: ALL_INSTITUTION_ROLES_V1,
  },
  {
    id: 'care',
    label: '预约与随访',
    rootPath: '/hospital/care',
    roleAudience: ALL_INSTITUTION_ROLES_V1,
  },
  {
    id: 'knowledge',
    label: '知识库',
    rootPath: '/hospital/knowledge',
    roleAudience: MANAGEMENT_INSTITUTION_ROLES_V1,
  },
  {
    id: 'analytics',
    label: '经营分析',
    rootPath: '/hospital/analytics',
    roleAudience: MANAGEMENT_INSTITUTION_ROLES_V1,
  },
  {
    id: 'system',
    label: '管理中心',
    rootPath: '/hospital/system',
    roleAudience: MANAGEMENT_INSTITUTION_ROLES_V1,
  },
] as const satisfies readonly InstitutionNavigationSectionDefinitionV1[]);

export type InstitutionNavigationSectionV1 =
  (typeof INSTITUTION_NAVIGATION_SECTIONS_V1)[number];

export const INSTITUTION_MOBILE_NAVIGATION_ENTRY_IDS_V1 = freezeContractValueV1([
  'workbench',
  'customers',
  'conversations',
  'care',
  'more',
] as const);

export type InstitutionMobileNavigationEntryIdV1 =
  (typeof INSTITUTION_MOBILE_NAVIGATION_ENTRY_IDS_V1)[number];

export const INSTITUTION_MOBILE_NAVIGATION_V1 = freezeContractValueV1([
  {
    id: 'workbench',
    label: '工作台',
    sectionId: 'workbench',
    href: '/hospital',
  },
  {
    id: 'customers',
    label: '客户',
    sectionId: 'customers',
    href: '/hospital/customers',
  },
  {
    id: 'conversations',
    label: '会话',
    sectionId: 'conversations',
    href: '/hospital/conversations',
  },
  {
    id: 'care',
    label: '待办',
    sectionId: 'care',
    href: '/hospital/care',
  },
  {
    id: 'more',
    label: '更多',
    sectionId: null,
    href: null,
  },
] as const satisfies readonly Readonly<{
  id: InstitutionMobileNavigationEntryIdV1;
  label: string;
  sectionId: InstitutionNavigationSectionIdV1 | null;
  href: string | null;
}>[]);

export const INSTITUTION_MOBILE_MORE_SECTION_IDS_V1 = freezeContractValueV1([
  'knowledge',
  'analytics',
  'system',
] as const satisfies readonly InstitutionNavigationSectionIdV1[]);

export function isInstitutionRoleV1(value: unknown): value is InstitutionRoleV1 {
  return INSTITUTION_ROLES_V1.some((role) => role === value);
}

export function isInstitutionNavigationSectionIdV1(
  value: unknown,
): value is InstitutionNavigationSectionIdV1 {
  return INSTITUTION_NAVIGATION_SECTION_IDS_V1.some((sectionId) => sectionId === value);
}

/** Static product-audience check only; not a release, page, object, or action authorization. */
export function isRoleInInstitutionSectionAudienceV1(
  role: InstitutionRoleV1,
  sectionId: InstitutionNavigationSectionIdV1,
): boolean {
  const section = INSTITUTION_NAVIGATION_SECTIONS_V1.find((item) => item.id === sectionId);

  return section?.roleAudience.some((audienceRole) => audienceRole === role) ?? false;
}

/**
 * Returns role-audience candidates only. Consumers must still apply the authoritative
 * server-side capability decision and object/action authorization before rendering or acting.
 */
export function getRoleCandidateInstitutionMobileMoreSectionsV1(
  role: InstitutionRoleV1,
): readonly InstitutionNavigationSectionV1[] {
  return INSTITUTION_MOBILE_MORE_SECTION_IDS_V1.flatMap((sectionId) => {
    const section = INSTITUTION_NAVIGATION_SECTIONS_V1.find((item) => item.id === sectionId);

    if (!section || !isRoleInInstitutionSectionAudienceV1(role, sectionId)) {
      return [];
    }

    return [section];
  });
}
