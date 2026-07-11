import { createAuditEvent } from '@/modules/audit/domain/audit-events';
import type { AuditEventRepository } from '@/modules/audit/server/audit-event-repository';
import {
  createDefaultWeComOfficialDryRunConfigInput,
  evaluateWeComOfficialDryRunConfig,
  officialWeComDryRunRoutes,
  type OfficialWeComDryRunRoute,
} from '@/modules/institution/domain/wecom-official-dry-run-config';
import type { TrustedReachOutSafetyRepository } from '@/modules/institution/server/trusted-reachout-safety-repository';
import type { AccessContext } from '@/modules/security/domain/access-control';

export const weComDryRunSnapshotConfirmation = '我确认仅保存低敏 dry-run 评估快照且不启用真实发送';
export const trustedReadyWeComOfficialRoute = 'official_wecom_self_built' as const;

const placeholderRefPattern = /(?:placeholder|mock|dry[-_ ]?run|example|test|低敏|占位)/iu;
const unsafeRefPattern = /secret|token|corp[_-]?id|userid|user_id|agent[_-]?id|encodingaeskey|qyapi|webhook|process\.env|\.env\.local/iu;

export function deriveWeComDryRunServerPreflight(input: {
  officialRoute: OfficialWeComDryRunRoute;
  proofInstitutionRef: string;
  callbackPlaceholderRef: string;
  hasTestWeComEnvironment: boolean;
  hasSecretKeeperConfirmed: boolean;
  confirmation: string;
}) {
  const hasManualConfirmation = input.confirmation === weComDryRunSnapshotConfirmation;
  const hasProofInstitutionRef = Boolean(input.proofInstitutionRef.trim()) && !unsafeRefPattern.test(input.proofInstitutionRef);
  const hasCallbackDomainPlaceholder = placeholderRefPattern.test(input.callbackPlaceholderRef) &&
    !unsafeRefPattern.test(input.callbackPlaceholderRef);
  const hasOfficialRoute = officialWeComDryRunRoutes.includes(input.officialRoute);
  const hasTrustedReadyRoute = input.officialRoute === trustedReadyWeComOfficialRoute;
  const proofEligibleMock = Boolean(
    hasTrustedReadyRoute &&
    hasProofInstitutionRef &&
    hasCallbackDomainPlaceholder &&
    input.hasTestWeComEnvironment &&
    input.hasSecretKeeperConfirmed &&
    hasManualConfirmation
  );
  const preflightStatus = proofEligibleMock
    ? 'mock_ready' as const
    : !hasManualConfirmation
      ? 'blocked_missing_manual_confirmation' as const
      : !hasOfficialRoute || !hasTrustedReadyRoute || !hasProofInstitutionRef || !hasCallbackDomainPlaceholder
        ? 'blocked_route_unverified' as const
        : 'blocked_safety_switch' as const;

  return {
    hasManualConfirmation,
    hasCallbackDomainPlaceholder,
    proofEligibleMock,
    preflightStatus,
  };
}

export async function evaluateAndPersistWeComDryRunSnapshot(input: {
  context: AccessContext;
  tenantId: string;
  institutionId: string;
  officialRoute: OfficialWeComDryRunRoute;
  proofInstitutionRef: string;
  callbackPlaceholderRef: string;
  hasTestWeComEnvironment: boolean;
  hasSecretKeeperConfirmed: boolean;
  confirmation: string;
  occurredAt: string;
  createId: () => string;
  repositories: {
    safetyRepository: TrustedReachOutSafetyRepository;
    auditRepository: Pick<AuditEventRepository, 'record'>;
  };
}) {
  const derived = deriveWeComDryRunServerPreflight(input);
  const config = evaluateWeComOfficialDryRunConfig(createDefaultWeComOfficialDryRunConfigInput({
    tenantId: input.tenantId,
    institutionId: input.institutionId,
    operatorRole: input.context.role,
    officialRoute: input.officialRoute,
    proofInstitutionRef: input.proofInstitutionRef,
    callbackUrlPlaceholder: input.callbackPlaceholderRef,
    hasTestWeComEnvironment: input.hasTestWeComEnvironment,
    hasCallbackDomainPlaceholder: derived.hasCallbackDomainPlaceholder,
    hasSecretKeeperConfirmed: input.hasSecretKeeperConfirmed,
    hasManualConfirmation: derived.hasManualConfirmation,
    preflightStatus: derived.preflightStatus,
    proofEligibleMock: derived.proofEligibleMock,
    allowRealSend: false,
    externalChannelEnabled: false,
    realSendAllowed: false,
    dryRunOnly: true,
    hasRealNetworkAttempt: false,
    hasRealSendAttempt: false,
    hasSensitiveValueInput: false,
    hasSecretReadAttempt: false,
  }));
  const writtenSnapshot = await input.repositories.safetyRepository.upsertDryRunSnapshot({
    id: input.createId(),
    tenantId: input.tenantId,
    institutionId: input.institutionId,
    channelType: 'wechat_work',
    officialRoute: String(config.officialRoute ?? 'not_selected'),
    proofInstitutionRef: config.proofInstitutionRef ?? 'institution-placeholder',
    callbackPlaceholderRef: config.callbackUrlPlaceholder ?? 'callback-placeholder',
    configStatus: config.configStatus,
    preflightStatus: derived.preflightStatus,
    proofEligibleMock: derived.proofEligibleMock,
    evaluatedBy: input.context.userId,
    evaluatedAt: new Date(input.occurredAt),
    allowRealSend: false,
    externalChannelEnabled: false,
    realSendAllowed: false,
    dryRunOnly: true,
  });
  const snapshot = writtenSnapshot ?? await input.repositories.safetyRepository.findDryRunSnapshot({
    tenantId: input.tenantId,
    institutionId: input.institutionId,
  });
  if (!snapshot) throw new Error('dry_run_snapshot_stale_without_current');
  const finalReady = snapshot.configStatus === 'dry_run_ready';
  await input.repositories.auditRepository.record(createAuditEvent({
    eventId: input.createId(),
    context: input.context,
    resource: 'real_channel',
    action: 'review',
    result: finalReady ? 'transitioned' : 'denied',
    reason: finalReady
      ? 'wecom_reachout_dry_run_snapshot_ready'
      : 'wecom_reachout_dry_run_snapshot_blocked',
    occurredAt: input.occurredAt,
  }));
  return { config, snapshot };
}
