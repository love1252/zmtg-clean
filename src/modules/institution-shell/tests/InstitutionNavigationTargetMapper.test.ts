import { describe, expect, it } from 'vitest';
import type {
  CapabilityStatusDecisionV1,
  CapabilityStatusV1,
} from '@/modules/institution-contracts/v1/institution-capability';
import {
  INSTITUTION_CAPABILITY_REGISTRY_V1,
  type InstitutionCapabilityKeyV1,
} from '@/modules/institution-contracts/v1/institution-capability-registry';
import { INSTITUTION_NAVIGATION_SECTION_IDS_V1 } from '@/modules/institution-contracts/v1/institution-navigation';
import { mapInstitutionAvailableNavigationTargetsV1 } from '@/modules/institution-shell/server/institution-navigation-target-mapper';

const releasedPages = new Set<InstitutionCapabilityKeyV1>([
  'page_workbench',
  'page_customer_list',
  'page_conversation_queue',
  'page_care_appointments',
  'page_care_followups',
  'page_knowledge_library',
  'page_analytics_overview',
  'page_system_ai_usage',
  'page_system_audit',
]);

function capabilityStatus(
  decisions: Readonly<Partial<Record<InstitutionCapabilityKeyV1, CapabilityStatusDecisionV1>>> = {},
): CapabilityStatusV1 {
  const freshness = {
    observedAt: '2026-08-24T01:00:00.000Z',
    freshUntil: '2026-08-24T01:00:05.000Z',
  };
  const capabilities = INSTITUTION_CAPABILITY_REGISTRY_V1.map((definition) => {
    const decision = decisions[definition.key]
      ?? (releasedPages.has(definition.key) ? 'read_only' : 'hidden');
    const released = decision !== 'hidden';
    return {
      key: definition.key,
      decision,
      dimensions: {
        codeMaturity: released ? 'verified' as const : 'unverified' as const,
        institutionAuthorization: released ? 'authorized' as const : 'not_authorized' as const,
        connectionAvailability: 'not_required' as const,
        dataReadiness: released ? 'ready' as const : 'not_required' as const,
        productionRelease: released ? 'pilot_released' as const : 'not_released' as const,
      },
      safeSummary: null,
      diagnosticTargetKey: null,
    };
  });

  return {
    contractVersion: 'v1',
    scope: { tenantId: 'tenant-navigation-001', institutionId: 'institution-navigation-001' },
    readiness: 'ready',
    freshness,
    partitions: INSTITUTION_CAPABILITY_REGISTRY_V1.map((definition) => ({
      key: definition.key,
      readiness: 'ready',
      freshness,
      failureCode: null,
    })),
    data: { capabilities },
    failureCode: null,
  };
}

describe('机构端服务端页面级导航目标映射', () => {
  it('只输出当前 AccessContext 已放行的正式页面 Capability', () => {
    expect(
      mapInstitutionAvailableNavigationTargetsV1(
        capabilityStatus(),
        INSTITUTION_NAVIGATION_SECTION_IDS_V1,
      ).map((target) => target.pathname),
    ).toEqual([
      '/hospital',
      '/hospital/customers',
      '/hospital/conversations',
      '/hospital/care/appointments',
      '/hospital/care/followups',
      '/hospital/knowledge',
      '/hospital/analytics',
      '/hospital/system/ai-usage',
      '/hospital/system/audit',
    ]);
  });

  it('栏目可见时仍排除页面级 hidden 或未授权 Capability', () => {
    const status = capabilityStatus({
      page_care_appointments: 'hidden',
      page_care_followups: 'read_only',
    });
    const appointments = status.data?.capabilities.find(
      (item) => item.key === 'page_care_appointments',
    );
    if (appointments) {
      appointments.dimensions.institutionAuthorization = 'not_authorized';
    }

    const paths = mapInstitutionAvailableNavigationTargetsV1(
      status,
      INSTITUTION_NAVIGATION_SECTION_IDS_V1,
    ).map((target) => target.pathname);

    expect(paths).not.toContain('/hospital/care/appointments');
    expect(paths).toContain('/hospital/care/followups');
  });

  it('同时要求真实栏目授权，不从页面 Capability 反推栏目权限', () => {
    const targets = mapInstitutionAvailableNavigationTargetsV1(
      capabilityStatus(),
      ['workbench', 'care'],
    );
    expect(targets.map((target) => target.pathname)).toEqual([
      '/hospital',
      '/hospital/care/appointments',
      '/hospital/care/followups',
    ]);
  });

  it('对 envelope 失败、重复栏目和重复页面分区保持 fail-closed', () => {
    expect(mapInstitutionAvailableNavigationTargetsV1(null, ['workbench'])).toEqual([]);
    expect(
      mapInstitutionAvailableNavigationTargetsV1(
        capabilityStatus(),
        ['workbench', 'workbench'],
      ),
    ).toEqual([]);

    const status = capabilityStatus();
    const workbench = status.data?.capabilities.find((item) => item.key === 'page_workbench');
    if (!workbench || !status.data) throw new Error('workbench fixture missing');
    status.data.capabilities.push({ ...workbench });
    expect(
      mapInstitutionAvailableNavigationTargetsV1(status, ['workbench']),
    ).toEqual([]);
  });
});
