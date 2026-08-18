import { buildFormalCareActionSourceV1 } from '@/modules/care/application/formal-care-action-source';
import { createFormalFollowUpRepositoryV1 } from '@/modules/care/server/formal-follow-up-repository';
import { readInstitutionOperatingContextForCareV1 } from '@/modules/institution/server/institution-operating-context-reader';
import { getDatabase } from '@/server/db/client';
import { resolveInstitutionCapabilityAuthorityStatusV1 } from '@/server/orchestration/institution-capability-authority';
import {
  consumeInstitutionCareWriteAuthorizationV1,
  resolveInstitutionCareWriteAuthorizationV1,
} from '@/server/orchestration/institution-care-write-authorization';

export async function readCurrentInstitutionCareActionSourceV1() {
  const resolution =
    await resolveInstitutionCareWriteAuthorizationV1();
  if (resolution.kind !== 'allowed') return null;

  const actor =
    consumeInstitutionCareWriteAuthorizationV1(
      resolution.authorization,
    );
  if (!actor) return null;

  const capabilityStatus =
    await resolveInstitutionCapabilityAuthorityStatusV1();
  const pageCapabilities =
    capabilityStatus?.data?.capabilities.filter(
      (item) => item.key === 'page_care_followups',
    ) ?? [];
  const pagePartitions =
    capabilityStatus?.partitions.filter(
      (item) => item.key === 'page_care_followups',
    ) ?? [];

  if (
    capabilityStatus?.contractVersion !== 'v1'
    || capabilityStatus.scope.tenantId !== actor.tenantId
    || capabilityStatus.scope.institutionId !== actor.institutionId
    || capabilityStatus.readiness !== 'ready'
    || capabilityStatus.failureCode !== null
    || pageCapabilities.length !== 1
    || pagePartitions.length !== 1
    || pageCapabilities[0]?.decision !== 'operational'
    || pageCapabilities[0].dimensions.productionRelease
      !== 'pilot_released'
    || pageCapabilities[0].safeSummary !== '随访任务可用'
    || pagePartitions[0]?.readiness !== 'ready'
    || pagePartitions[0].failureCode !== null
  ) {
    return null;
  }

  const database = getDatabase();
  const [tasks, context] = await Promise.all([
    createFormalFollowUpRepositoryV1(
      database,
    ).listVisible({
      tenantId: actor.tenantId,
      institutionId: actor.institutionId,
      actorId: actor.accountId,
      actorRole: actor.role,
      limit: 101,
    }),
    readInstitutionOperatingContextForCareV1(
      database,
      {
        tenantId: actor.tenantId,
        institutionId: actor.institutionId,
      },
    ),
  ]);

  if (!context || tasks.length > 101) {
    return null;
  }

  return buildFormalCareActionSourceV1({
    tenantId: actor.tenantId,
    institutionId: actor.institutionId,
    tasks,
    referenceTime:
      new Date(Date.now()).toISOString(),
    timeZone: context.timeZone,
    operatingContextVersion: context.version,
  });
}
