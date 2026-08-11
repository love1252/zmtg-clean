import type {
  CapabilityStatusItemV1,
  CapabilityStatusV1,
} from '@/modules/institution-contracts/v1/institution-capability';
import {
  INSTITUTION_CAPABILITY_REGISTRY_V1,
  isInstitutionDiagnosticTargetCapabilityKeyV1,
} from '@/modules/institution-contracts/v1/institution-capability-registry';
import {
  consumeInstitutionCapabilityAuthorityRuntimeContextV1,
  resolveInstitutionCapabilityAuthorityRuntimeContextV1,
} from '@/modules/institution/server/institution-server-runtime';

export const INSTITUTION_CAPABILITY_AUTHORITY_REVISION_V1 =
  'r1a-orchestration-hidden-v1' as const;

function buildHiddenCapabilityStatus(
  context: NonNullable<
    ReturnType<typeof consumeInstitutionCapabilityAuthorityRuntimeContextV1>
  >,
): CapabilityStatusV1 {
  const freshness = Object.freeze({
    observedAt: context.observedAt,
    freshUntil: context.observedAt,
  });

  const availableSections = new Set(context.availableSectionIds);
  const systemAvailable = availableSections.has('system');

  const capabilities: CapabilityStatusItemV1[] =
    INSTITUTION_CAPABILITY_REGISTRY_V1.map((definition) =>
      Object.freeze({
        key: definition.key,
        decision: 'hidden',
        dimensions: Object.freeze({
          codeMaturity: 'unverified',
          institutionAuthorization: availableSections.has(
            definition.sectionId,
          )
            ? 'authorized'
            : 'not_authorized',
          connectionAvailability: 'not_required',
          dataReadiness: 'not_required',
          productionRelease: 'not_released',
        }),
        safeSummary: null,
        diagnosticTargetKey:
          systemAvailable &&
          isInstitutionDiagnosticTargetCapabilityKeyV1(definition.key)
            ? definition.key
            : null,
      } satisfies CapabilityStatusItemV1),
    );

  const partitions: CapabilityStatusV1['partitions'] =
    INSTITUTION_CAPABILITY_REGISTRY_V1.map((definition) =>
      Object.freeze({
        key: definition.key,
        readiness: 'ready',
        freshness,
        failureCode: null,
      }),
    );

  Object.freeze(capabilities);
  Object.freeze(partitions);

  return Object.freeze({
    contractVersion: 'v1',
    scope: Object.freeze({
      tenantId: context.tenantId,
      institutionId: context.institutionId,
    }),
    readiness: 'ready',
    freshness,
    partitions,
    data: Object.freeze({
      capabilities,
    }),
    failureCode: null,
  } satisfies CapabilityStatusV1);
}

/**
 * POST-V2-R1A authority foundation.
 *
 * This is not wired to any Route. It consumes one opaque current server authority context and
 * emits the public CapabilityStatusV1 wire shape in a hidden-only / not-released state.
 */
export async function resolveInstitutionCapabilityAuthorityStatusV1(): Promise<CapabilityStatusV1 | null> {
  try {
    const handle =
      await resolveInstitutionCapabilityAuthorityRuntimeContextV1();
    if (!handle) return null;

    const context =
      consumeInstitutionCapabilityAuthorityRuntimeContextV1(handle);
    if (!context) return null;

    return buildHiddenCapabilityStatus(context);
  } catch {
    return null;
  }
}
