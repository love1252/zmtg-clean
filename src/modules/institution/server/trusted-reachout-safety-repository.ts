import { and, eq } from 'drizzle-orm';
import type {
  WeComReachOutConsentSourceType,
  WeComReachOutConsentStatus,
} from '@/modules/institution/domain/trusted-reachout-safety';
import type { WeComOfficialDryRunConfigStatus } from '@/modules/institution/domain/wecom-official-dry-run-config';
import type { RealChannelPreflightStatus } from '@/modules/institution/domain/real-channel-preflight';
import type { TenantDatabase } from '@/server/db/client';
import {
  customerChannelContactConsents,
  customerChannelFrequencyStates,
  institutionChannelDryRunSnapshots,
} from '@/server/db/schema';

export type WeComReachOutSafetyScope = {
  tenantId: string;
  institutionId: string;
  customerId: string;
};

export type CustomerChannelContactConsent = WeComReachOutSafetyScope & {
  id: string;
  channelType: 'wechat_work';
  status: WeComReachOutConsentStatus;
  sourceType: WeComReachOutConsentSourceType;
  evidenceRef: string;
  recordedBy: string;
  recordedAt: string;
  version: number;
};

export type CustomerChannelFrequencyState = WeComReachOutSafetyScope & {
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
};

export type InstitutionChannelDryRunSnapshot = {
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
};

function mapConsent(row: typeof customerChannelContactConsents.$inferSelect): CustomerChannelContactConsent {
  return {
    ...row,
    channelType: 'wechat_work',
    recordedAt: row.recordedAt.toISOString(),
  };
}

function mapFrequency(row: typeof customerChannelFrequencyStates.$inferSelect): CustomerChannelFrequencyState {
  return {
    ...row,
    channelType: 'wechat_work',
    maxPreparedCount: 1,
    maxCompletedCount: 1,
    windowStartedAt: row.windowStartedAt.toISOString(),
    windowEndsAt: row.windowEndsAt.toISOString(),
    nextAllowedAt: row.nextAllowedAt.toISOString(),
  };
}

function mapSnapshot(row: typeof institutionChannelDryRunSnapshots.$inferSelect): InstitutionChannelDryRunSnapshot {
  return {
    ...row,
    channelType: 'wechat_work',
    configStatus: row.configStatus as WeComOfficialDryRunConfigStatus,
    preflightStatus: row.preflightStatus as RealChannelPreflightStatus | 'not_configured',
    evaluatedAt: row.evaluatedAt.toISOString(),
    allowRealSend: false,
    externalChannelEnabled: false,
    realSendAllowed: false,
    dryRunOnly: true,
  };
}

function customerScopeWhere(scope: WeComReachOutSafetyScope) {
  return and(
    eq(customerChannelContactConsents.tenantId, scope.tenantId),
    eq(customerChannelContactConsents.institutionId, scope.institutionId),
    eq(customerChannelContactConsents.customerId, scope.customerId),
    eq(customerChannelContactConsents.channelType, 'wechat_work'),
  );
}

function frequencyScopeWhere(scope: WeComReachOutSafetyScope) {
  return and(
    eq(customerChannelFrequencyStates.tenantId, scope.tenantId),
    eq(customerChannelFrequencyStates.institutionId, scope.institutionId),
    eq(customerChannelFrequencyStates.customerId, scope.customerId),
    eq(customerChannelFrequencyStates.channelType, 'wechat_work'),
  );
}

function dryRunSnapshotScopeWhere(input: { tenantId: string; institutionId: string }) {
  return and(
    eq(institutionChannelDryRunSnapshots.tenantId, input.tenantId),
    eq(institutionChannelDryRunSnapshots.institutionId, input.institutionId),
    eq(institutionChannelDryRunSnapshots.channelType, 'wechat_work'),
  );
}

export function createTrustedReachOutSafetyRepository(database: TenantDatabase) {
  return {
    async findConsent(scope: WeComReachOutSafetyScope) {
      const [row] = await database
        .select()
        .from(customerChannelContactConsents)
        .where(customerScopeWhere(scope));
      return row ? mapConsent(row) : null;
    },

    async findConsentForUpdate(scope: WeComReachOutSafetyScope) {
      const [row] = await database
        .select()
        .from(customerChannelContactConsents)
        .where(customerScopeWhere(scope))
        .for('update');
      return row ? mapConsent(row) : null;
    },

    async upsertConsent(input: WeComReachOutSafetyScope & {
      id: string;
      status: Exclude<WeComReachOutConsentStatus, 'unknown'>;
      sourceType: WeComReachOutConsentSourceType;
      evidenceRef: string;
      recordedBy: string;
      recordedAt: Date;
      expectedVersion: number | null;
    }): Promise<CustomerChannelContactConsent | null> {
      void input;
      throw new Error('legacy_wecom_reachout_safety_writer_disabled');
    },

    async findFrequency(scope: WeComReachOutSafetyScope) {
      const [row] = await database
        .select()
        .from(customerChannelFrequencyStates)
        .where(frequencyScopeWhere(scope));
      return row ? mapFrequency(row) : null;
    },

    async createFrequencyIfAbsent(input: WeComReachOutSafetyScope & {
      id: string;
      operationRef: string;
      now: Date;
      windowEndsAt: Date;
    }): Promise<CustomerChannelFrequencyState | null> {
      void input;
      throw new Error('legacy_wecom_reachout_safety_writer_disabled');
    },

    async updateFrequencyWhenVersion(input: WeComReachOutSafetyScope & {
      operationRef: string;
      now: Date;
      windowStartedAt: Date;
      windowEndsAt: Date;
      preparedCount: number;
      completedCount: number;
      nextAllowedAt: Date;
      expectedVersion: number;
    }): Promise<CustomerChannelFrequencyState | null> {
      void input;
      throw new Error('legacy_wecom_reachout_safety_writer_disabled');
    },

    async findDryRunSnapshot(input: { tenantId: string; institutionId: string }) {
      const [row] = await database
        .select()
        .from(institutionChannelDryRunSnapshots)
        .where(dryRunSnapshotScopeWhere(input));
      return row ? mapSnapshot(row) : null;
    },

    async findDryRunSnapshotForUpdate(input: { tenantId: string; institutionId: string }) {
      const [row] = await database
        .select()
        .from(institutionChannelDryRunSnapshots)
        .where(dryRunSnapshotScopeWhere(input))
        .for('update');
      return row ? mapSnapshot(row) : null;
    },

    async upsertDryRunSnapshot(
      input: Omit<InstitutionChannelDryRunSnapshot, 'version' | 'evaluatedAt'> & {
        evaluatedAt: Date;
      },
    ): Promise<InstitutionChannelDryRunSnapshot | null> {
      void input;
      throw new Error('legacy_wecom_reachout_safety_writer_disabled');
    },
  };
}

export type TrustedReachOutSafetyRepository = ReturnType<typeof createTrustedReachOutSafetyRepository>;
