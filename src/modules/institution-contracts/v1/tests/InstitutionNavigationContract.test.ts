import { describe, expect, it } from 'vitest';

import {
  getRoleCandidateInstitutionMobileMoreSectionsV1,
  INSTITUTION_MOBILE_MORE_SECTION_IDS_V1,
  INSTITUTION_MOBILE_NAVIGATION_V1,
  INSTITUTION_NAVIGATION_SECTIONS_V1,
  INSTITUTION_ROLES_V1,
  isInstitutionNavigationSectionIdV1,
  isInstitutionRoleV1,
  isRoleInInstitutionSectionAudienceV1,
} from '@/modules/institution-contracts/v1/institution-navigation';

describe('InstitutionNavigationContractV1', () => {
  it('freezes the four institution roles', () => {
    expect(INSTITUTION_ROLES_V1).toEqual([
      'tenant_admin',
      'tenant_operator',
      'consultant',
      'customer_service',
    ]);
    expect(Object.isFrozen(INSTITUTION_ROLES_V1)).toBe(true);

    for (const role of INSTITUTION_ROLES_V1) {
      expect(isInstitutionRoleV1(role)).toBe(true);
    }

    expect(isInstitutionRoleV1('platform_admin')).toBe(false);
    expect(isInstitutionRoleV1('unknown')).toBe(false);
  });

  it('freezes the seven desktop sections, labels, order, and root paths', () => {
    expect(Object.isFrozen(INSTITUTION_NAVIGATION_SECTIONS_V1)).toBe(true);

    expect(
      INSTITUTION_NAVIGATION_SECTIONS_V1.map(({ id, label, rootPath }) => ({
        id,
        label,
        rootPath,
      })),
    ).toEqual([
      { id: 'workbench', label: '工作台', rootPath: '/hospital' },
      { id: 'customers', label: '客户中心', rootPath: '/hospital/customers' },
      {
        id: 'conversations',
        label: '会话工作台',
        rootPath: '/hospital/conversations',
      },
      { id: 'care', label: '预约与随访', rootPath: '/hospital/care' },
      { id: 'knowledge', label: '知识库', rootPath: '/hospital/knowledge' },
      { id: 'analytics', label: '经营分析', rootPath: '/hospital/analytics' },
      { id: 'system', label: '管理中心', rootPath: '/hospital/system' },
    ]);

    for (const section of INSTITUTION_NAVIGATION_SECTIONS_V1) {
      expect(isInstitutionNavigationSectionIdV1(section.id)).toBe(true);
      expect(Object.isFrozen(section)).toBe(true);
      expect(Object.isFrozen(section.roleAudience)).toBe(true);
    }

    expect(isInstitutionNavigationSectionIdV1('customer_operations')).toBe(false);
  });

  it('freezes the static role audience without claiming release or authorization', () => {
    const candidateSectionIdsByRole = Object.fromEntries(
      INSTITUTION_ROLES_V1.map((role) => [
        role,
        INSTITUTION_NAVIGATION_SECTIONS_V1.filter((section) =>
          isRoleInInstitutionSectionAudienceV1(role, section.id),
        ).map((section) => section.id),
      ]),
    );

    expect(candidateSectionIdsByRole).toEqual({
      tenant_admin: [
        'workbench',
        'customers',
        'conversations',
        'care',
        'knowledge',
        'analytics',
        'system',
      ],
      tenant_operator: [
        'workbench',
        'customers',
        'conversations',
        'care',
        'knowledge',
        'analytics',
        'system',
      ],
      consultant: ['workbench', 'customers', 'conversations', 'care'],
      customer_service: ['workbench', 'customers', 'conversations', 'care'],
    });

    for (const section of INSTITUTION_NAVIGATION_SECTIONS_V1) {
      expect(Object.keys(section).sort()).toEqual(
        ['roleAudience', 'id', 'label', 'rootPath'].sort(),
      );
    }
  });

  it('freezes the five mobile entries and keeps more as a menu affordance', () => {
    expect(Object.isFrozen(INSTITUTION_MOBILE_NAVIGATION_V1)).toBe(true);

    expect(INSTITUTION_MOBILE_NAVIGATION_V1).toEqual([
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
      { id: 'more', label: '更多', sectionId: null, href: null },
    ]);

    for (const entry of INSTITUTION_MOBILE_NAVIGATION_V1) {
      expect(Object.isFrozen(entry)).toBe(true);
    }

    expect(INSTITUTION_MOBILE_NAVIGATION_V1.map((entry) => entry.href)).not.toContain(
      '/hospital/more',
    );
  });

  it('keeps the more section candidates ordered and filters their static role audience', () => {
    expect(Object.isFrozen(INSTITUTION_MOBILE_MORE_SECTION_IDS_V1)).toBe(true);
    expect(INSTITUTION_MOBILE_MORE_SECTION_IDS_V1).toEqual([
      'knowledge',
      'analytics',
      'system',
    ]);

    expect(getRoleCandidateInstitutionMobileMoreSectionsV1('tenant_admin').map((item) => item.id)).toEqual(
      ['knowledge', 'analytics', 'system'],
    );
    expect(
      getRoleCandidateInstitutionMobileMoreSectionsV1('tenant_operator').map((item) => item.id),
    ).toEqual(['knowledge', 'analytics', 'system']);
    expect(getRoleCandidateInstitutionMobileMoreSectionsV1('consultant')).toEqual([]);
    expect(getRoleCandidateInstitutionMobileMoreSectionsV1('customer_service')).toEqual([]);
  });
});
