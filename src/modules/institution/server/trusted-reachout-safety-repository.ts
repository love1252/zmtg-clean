import { and, eq, sql } from 'drizzle-orm';
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
    }) {
      if (input.expectedVersion === null) {
        const [row] = await database
          .insert(customerChannelContactConsents)
          .values({
            id: input.id,
            tenantId: input.tenantId,
            institutionId: input.institutionId,
            customerId: input.customerId,
            channelType: 'wechat_work',
            status: input.status,
            sourceType: input.sourceType,
            evidenceRef: input.evidenceRef,
            recordedBy: input.recordedBy,
            recordedAt: input.recordedAt,
          })
          .onConflictDoNothing()
          .returning();
        return row ? mapConsent(row) : null;
      }

      const [row] = await database
        .update(customerChannelContactConsents)
        .set({
          status: input.status,
          sourceType: input.sourceType,
          evidenceRef: input.evidenceRef,
          recordedBy: input.recordedBy,
          recordedAt: input.recordedAt,
          version: input.expectedVersion + 1,
          updatedAt: input.recordedAt,
        })
        .where(and(customerScopeWhere(input), eq(customerChannelContactConsents.version, input.expectedVersion)))
        .returning();
      return row ? mapConsent(row) : null;
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
    }) {
      const [row] = await database
        .insert(customerChannelFrequencyStates)
        .values({
          id: input.id,
          tenantId: input.tenantId,
          institutionId: input.institutionId,
          customerId: input.customerId,
          channelType: 'wechat_work',
          windowStartedAt: input.now,
          windowEndsAt: input.windowEndsAt,
          preparedCount: 1,
          completedCount: 0,
          maxPreparedCount: 1,
          maxCompletedCount: 1,
          nextAllowedAt: input.windowEndsAt,
          lastPreparedRef: input.operationRef,
        })
        .onConflictDoNothing()
        .returning();
      return row ? mapFrequency(row) : null;
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
    }) {
      const [row] = await database
        .update(customerChannelFrequencyStates)
        .set({
          windowStartedAt: input.windowStartedAt,
          windowEndsAt: input.windowEndsAt,
          preparedCount: input.preparedCount,
          completedCount: input.completedCount,
          maxPreparedCount: 1,
          maxCompletedCount: 1,
          nextAllowedAt: input.nextAllowedAt,
          lastPreparedRef: input.operationRef,
          version: input.expectedVersion + 1,
          updatedAt: input.now,
        })
        .where(and(
          frequencyScopeWhere(input),
          eq(customerChannelFrequencyStates.version, input.expectedVersion),
        ))
        .returning();
      return row ? mapFrequency(row) : null;
    },

    async findDryRunSnapshot(input: { tenantId: string; institutionId: string }) {
      const [row] = await database
        .select()
        .from(institutionChannelDryRunSnapshots)
        .where(and(
          eq(institutionChannelDryRunSnapshots.tenantId, input.tenantId),
          eq(institutionChannelDryRunSnapshots.institutionId, input.institutionId),
          eq(institutionChannelDryRunSnapshots.channelType, 'wechat_work'),
        ));
      return row ? mapSnapshot(row) : null;
    },

    async upsertDryRunSnapshot(input: Omit<InstitutionChannelDryRunSnapshot, 'version' | 'evaluatedAt'> & { evaluatedAt: Date }) {
      const [row] = await database
        .insert(institutionChannelDryRunSnapshots)
        .values({
          id: input.id,
          tenantId: input.tenantId,
          institutionId: input.institutionId,
          channelType: 'wechat_work',
          officialRoute: input.officialRoute,
          proofInstitutionRef: input.proofInstitutionRef,
          callbackPlaceholderRef: input.callbackPlaceholderRef,
          configStatus: input.configStatus,
          preflightStatus: input.preflightStatus,
          proofEligibleMock: input.proofEligibleMock,
          evaluatedBy: input.evaluatedBy,
          evaluatedAt: input.evaluatedAt,
          allowRealSend: false,
          externalChannelEnabled: false,
          realSendAllowed: false,
          dryRunOnly: true,
        })
        .onConflictDoUpdate({
          target: [
            institutionChannelDryRunSnapshots.tenantId,
            institutionChannelDryRunSnapshots.institutionId,
            institutionChannelDryRunSnapshots.channelType,
          ],
          set: {
            officialRoute: input.officialRoute,
            proofInstitutionRef: input.proofInstitutionRef,
            callbackPlaceholderRef: input.callbackPlaceholderRef,
            configStatus: input.configStatus,
            preflightStatus: input.preflightStatus,
            proofEligibleMock: input.proofEligibleMock,
            evaluatedBy: input.evaluatedBy,
            evaluatedAt: input.evaluatedAt,
            allowRealSend: false,
            externalChannelEnabled: false,
            realSendAllowed: false,
            dryRunOnly: true,
            version: sql`${institutionChannelDryRunSnapshots.version} + 1`,
            updatedAt: input.evaluatedAt,
          },
          setWhere: sql`${institutionChannelDryRunSnapshots.evaluatedAt} < ${input.evaluatedAt}`,
        })
        .returning();
      return row ? mapSnapshot(row) : null;
    },
  };
}

export type TrustedReachOutSafetyRepository = ReturnType<typeof createTrustedReachOutSafetyRepository>;
