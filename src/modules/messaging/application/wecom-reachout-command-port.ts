
import type {
  WeComReachOutConsentSourceType,
  WeComReachOutConsentStatus,
} from '@/modules/institution/domain/trusted-reachout-safety';
import type { RealChannelPreflightStatus } from '@/modules/institution/domain/real-channel-preflight';
import type { WeComOfficialDryRunConfigStatus } from '@/modules/institution/domain/wecom-official-dry-run-config';
import type {
  WeComRealSendProofOperation,
  WeComRealSendProofProviderResultCategory,
} from '@/modules/institution/domain/wecom-real-send-proof';

export type WeComReachOutSafetyScope = Readonly<{
  tenantId: string;
  institutionId: string;
  customerId: string;
}>;

export type CustomerChannelContactConsent = WeComReachOutSafetyScope & Readonly<{
  id: string;
  channelType: 'wechat_work';
  status: WeComReachOutConsentStatus;
  sourceType: WeComReachOutConsentSourceType;
  evidenceRef: string;
  recordedBy: string;
  recordedAt: string;
  version: number;
}>;

export type CustomerChannelFrequencyState = WeComReachOutSafetyScope & Readonly<{
  id: string;
  channelType: 'wechat_work';
  windowStartedAt: string;
  windowEndsAt: string;
  preparedCount: number;
  completedCount: number;
  maxPreparedCount: 1;
  maxCompletedCount: 1;
  nextAllowedAt: string;
  lastPreparedRef: string | null;
  lastCompletedRef: string | null;
  version: number;
}>;

export type InstitutionChannelDryRunSnapshot = Readonly<{
  id: string;
  tenantId: string;
  institutionId: string;
  channelType: 'wechat_work';
  officialRoute: string;
  proofInstitutionRef: string;
  callbackPlaceholderRef: string;
  configStatus: WeComOfficialDryRunConfigStatus;
  preflightStatus: RealChannelPreflightStatus | 'not_configured';
  proofEligibleMock: boolean;
  evaluatedBy: string;
  evaluatedAt: string;
  allowRealSend: false;
  externalChannelEnabled: false;
  realSendAllowed: false;
  dryRunOnly: true;
  version: number;
}>;

export type WeComRealSendProofOperationCreateInput = Omit<
  WeComRealSendProofOperation,
  | 'status'
  | 'confirmationIssuedAt'
  | 'confirmationExpiresAt'
  | 'confirmationConsumedAt'
  | 'requestedAt'
  | 'attemptedAt'
  | 'terminalAt'
  | 'attemptCount'
  | 'providerResultCategory'
  | 'completedFrequencyRef'
  | 'version'
> & Readonly<{
  confirmationIssuedAt: Date;
  confirmationExpiresAt: Date;
  requestedAt: Date;
}>;

export interface WeComReachOutCommandWriter {
  upsertConsent(input: WeComReachOutSafetyScope & Readonly<{
    id: string;
    status: Exclude<WeComReachOutConsentStatus, 'unknown'>;
    sourceType: WeComReachOutConsentSourceType;
    evidenceRef: string;
    recordedBy: string;
    recordedAt: Date;
    expectedVersion: number | null;
  }>): Promise<CustomerChannelContactConsent | null>;

  createFrequencyIfAbsent(input: WeComReachOutSafetyScope & Readonly<{
    id: string;
    operationRef: string;
    now: Date;
    windowEndsAt: Date;
  }>): Promise<CustomerChannelFrequencyState | null>;

  updateFrequencyWhenVersion(input: WeComReachOutSafetyScope & Readonly<{
    operationRef: string;
    now: Date;
    windowStartedAt: Date;
    windowEndsAt: Date;
    preparedCount: number;
    completedCount: number;
    nextAllowedAt: Date;
    expectedVersion: number;
  }>): Promise<CustomerChannelFrequencyState | null>;

  upsertDryRunSnapshot(
    input: Omit<InstitutionChannelDryRunSnapshot, 'version' | 'evaluatedAt'> &
      Readonly<{ evaluatedAt: Date }>,
  ): Promise<InstitutionChannelDryRunSnapshot | null>;

  createRealSendOperation(
    input: WeComRealSendProofOperationCreateInput,
  ): Promise<WeComRealSendProofOperation | null>;

  consumeRealSendConfirmation(input: Readonly<{
    operationRef: string;
    tenantId: string;
    institutionId: string;
    tokenDigest: string;
    operatorId: string;
    now: Date;
  }>): Promise<WeComRealSendProofOperation | null>;

  abortRealSendOperation(input: Readonly<{
    operationRef: string;
    tenantId: string;
    institutionId: string;
    operatorId: string;
    now: Date;
  }>): Promise<WeComRealSendProofOperation | null>;

  finalizeRealSendNonSuccess(input: Readonly<{
    operationRef: string;
    tenantId: string;
    institutionId: string;
    operatorId: string;
    status: 'failed' | 'unknown_outcome';
    providerResultCategory: Exclude<
      WeComRealSendProofProviderResultCategory,
      'accepted'
    >;
    now: Date;
  }>): Promise<WeComRealSendProofOperation | null>;

  recordCompletedFrequency(input: Readonly<{
    operation: WeComRealSendProofOperation;
    now: Date;
  }>): Promise<CustomerChannelFrequencyState | null>;

  markRealSendSucceeded(input: Readonly<{
    operationRef: string;
    tenantId: string;
    institutionId: string;
    operatorId: string;
    completedFrequencyRef: string;
    now: Date;
  }>): Promise<WeComRealSendProofOperation | null>;
}
