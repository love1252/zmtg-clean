import { randomUUID } from 'node:crypto';

import {
  mapPlanCatalogRecordsToDto,
  parsePlanVersionDraftPayload,
  type PlanCatalogRecord,
  type PlanCatalogVersionRecord,
} from '@/modules/open-platform/domain/plan-catalog';
import type { PlanCatalogRepository } from './plan-catalog-repository';

type ServiceInput = {
  repository: PlanCatalogRepository;
};

type ActorInput = ServiceInput & {
  actorId: string;
};

function nowDate() {
  return new Date();
}

function shortId() {
  return randomUUID().slice(0, 8);
}

function versionDto(version: PlanCatalogVersionRecord) {
  return mapPlanCatalogRecordsToDto([
    {
      planId: version.planId,
      planName: '',
      planCode: '',
      planDescription: '',
      planStatus: 'active',
      versions: [version],
    },
  ]).plans[0].versions[0];
}

function latestVersion(versions: PlanCatalogVersionRecord[], status?: PlanCatalogVersionRecord['status']) {
  return versions
    .filter((version) => !status || version.status === status)
    .sort((left, right) => {
      const leftTime = new Date(left.publishedAt ?? left.updatedAt).getTime();
      const rightTime = new Date(right.publishedAt ?? right.updatedAt).getTime();
      return rightTime - leftTime;
    })[0];
}

export async function getPlanCatalogService(input: ServiceInput) {
  const records = await input.repository.listPlanCatalogRecords();
  return mapPlanCatalogRecordsToDto(records);
}

export async function createPlanVersionDraftService(
  input: ActorInput & { planId: string; sourceVersionId?: string },
) {
  const plan = await input.repository.findPlan(input.planId);
  if (!plan) {
    return { status: 'not_found' as const, errorCode: 'PLAN_NOT_FOUND' };
  }

  const versions = await input.repository.listVersionsByPlanId(input.planId);
  const source =
    (input.sourceVersionId
      ? versions.find((version) => version.versionId === input.sourceVersionId)
      : undefined) ??
    latestVersion(versions, 'published') ??
    latestVersion(versions);
  const createdAt = nowDate();
  const versionCode = `${createdAt.toISOString().slice(0, 10)}-draft-${shortId()}`;
  const record: PlanCatalogVersionRecord = {
    versionId: `plan-version-${plan.planCode}-${shortId()}`,
    planId: plan.planId,
    versionCode,
    status: 'draft',
    displayName: source?.displayName ?? plan.planName,
    displayPrice: source?.displayPrice ?? '—',
    priceNote: source?.priceNote ?? '',
    agentLimit: source?.agentLimit ?? null,
    seatLimit: source?.seatLimit ?? null,
    monthlyAiCallLimit: source?.monthlyAiCallLimit ?? null,
    knowledgeStorageGb: source?.knowledgeStorageGb ?? null,
    connectorEntitlementsJson: source?.connectorEntitlementsJson ?? {},
    serviceEntitlementsJson: source?.serviceEntitlementsJson ?? {},
    featureEntitlementsJson: source?.featureEntitlementsJson ?? {},
    quotaEntitlementsJson: source?.quotaEntitlementsJson ?? {},
    changeSummary: source ? `复制自 ${source.versionCode}` : '创建首个草稿',
    createdBy: input.actorId,
    updatedBy: input.actorId,
    publishedBy: null,
    publishedAt: null,
    retiredAt: null,
    createdAt,
    updatedAt: createdAt,
  };

  const created = await input.repository.createVersion(record);
  return {
    status: 'draft_created' as const,
    version: versionDto(created),
  };
}

export async function savePlanVersionDraftService(
  input: ActorInput & { versionId: string; payload: unknown },
) {
  const parsed = parsePlanVersionDraftPayload(input.payload);
  if (!parsed.ok) {
    return { status: 'validation_error' as const, errors: parsed.errors };
  }

  const version = await input.repository.findVersion(input.versionId);
  if (!version) {
    return { status: 'not_found' as const, errorCode: 'PLAN_VERSION_NOT_FOUND' };
  }
  if (version.status !== 'draft') {
    return { status: 'invalid_transition' as const, errorCode: 'PUBLISHED_VERSION_READONLY' };
  }

  const updated = await input.repository.updateVersionDraft(input.versionId, {
    ...parsed.value,
    updatedBy: input.actorId,
    updatedAt: nowDate(),
  });

  return {
    status: 'draft_saved' as const,
    version: versionDto(updated),
  };
}

export async function publishPlanVersionService(input: ActorInput & { versionId: string }) {
  const version = await input.repository.findVersion(input.versionId);
  if (!version) {
    return { status: 'not_found' as const, errorCode: 'PLAN_VERSION_NOT_FOUND' };
  }
  if (version.status !== 'draft') {
    return { status: 'invalid_transition' as const, errorCode: 'ONLY_DRAFT_CAN_BE_PUBLISHED' };
  }

  const publishedAt = nowDate();
  await input.repository.retirePublishedVersionsForPlan(version.planId, {
    exceptVersionId: version.versionId,
    updatedBy: input.actorId,
    retiredAt: publishedAt,
  });
  const published = await input.repository.updateVersionStatus(version.versionId, 'published', {
    updatedBy: input.actorId,
    updatedAt: publishedAt,
    publishedBy: input.actorId,
    publishedAt,
    retiredAt: null,
  });

  return {
    status: 'published' as const,
    version: versionDto(published),
  };
}

export async function retirePlanVersionService(input: ActorInput & { versionId: string }) {
  const version = await input.repository.findVersion(input.versionId);
  if (!version) {
    return { status: 'not_found' as const, errorCode: 'PLAN_VERSION_NOT_FOUND' };
  }
  if (version.status !== 'published') {
    return { status: 'invalid_transition' as const, errorCode: 'ONLY_PUBLISHED_CAN_BE_RETIRED' };
  }

  const retiredAt = nowDate();
  const retired = await input.repository.updateVersionStatus(version.versionId, 'retired', {
    updatedBy: input.actorId,
    updatedAt: retiredAt,
    retiredAt,
    publishedBy: version.publishedBy,
    publishedAt: version.publishedAt instanceof Date ? version.publishedAt : null,
  });

  return {
    status: 'retired' as const,
    version: versionDto(retired),
  };
}

export type PlanCatalogPlanRecord = Omit<PlanCatalogRecord, 'versions'>;
