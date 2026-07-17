import { describe, expect, expectTypeOf, it } from 'vitest';

import {
  CARE_ACTION_PARTITION_KEYS_V1,
  CARE_ACTION_PRIORITIES_V1,
  CARE_ACTION_RISK_LEVELS_V1,
  CARE_ACTION_SAFE_SUMMARY_MAX_LENGTH_V1,
  CARE_APPOINTMENT_BUSINESS_STATES_V1,
  CARE_FOLLOW_UP_BUSINESS_STATES_V1,
  isCareActionPartitionKeyV1,
  isCareAppointmentBusinessStateV1,
  isCareFollowUpBusinessStateV1,
  type CareActionCardV1,
  type CareActionItemV1,
  type CareActionOwnerV1,
  type CareActionPartitionKeyV1,
  type CareActionPayloadV1,
  type CareActionSourceV1,
  type CareAppointmentActionItemV1,
  type CareFollowUpActionItemV1,
} from '@/modules/institution-contracts/v1/care-action';
import type { CustomerReferenceV1 } from '@/modules/institution-contracts/v1/customer';
import type { InstitutionActionSortSignalV1 } from '@/modules/institution-contracts/v1/institution-action';
import type { InstitutionRoleV1 } from '@/modules/institution-contracts/v1/institution-navigation';
import type { InstitutionSourceEnvelopeV1 } from '@/modules/institution-contracts/v1/institution-source';

describe('CareActionContractV1', () => {
  it('freezes the exact partition, business-state, risk and priority vocabularies', () => {
    expect(CARE_ACTION_PARTITION_KEYS_V1).toEqual([
      'pending_confirmation_appointments',
      'reschedule_requested_appointments',
      'overdue_followups',
      'today_due_followups',
    ]);
    expect(CARE_APPOINTMENT_BUSINESS_STATES_V1).toEqual([
      'pending_confirmation',
      'confirmed',
      'arrived',
      'completed',
      'cancelled',
      'no_show',
    ]);
    expect(CARE_FOLLOW_UP_BUSINESS_STATES_V1).toEqual([
      'pending',
      'in_progress',
      'waiting_customer',
      'escalated',
      'completed',
      'cancelled',
    ]);
    expect(CARE_ACTION_RISK_LEVELS_V1).toEqual(['normal', 'watch', 'urgent']);
    expect(CARE_ACTION_PRIORITIES_V1).toEqual(['normal', 'high']);
    expect(CARE_ACTION_SAFE_SUMMARY_MAX_LENGTH_V1).toBe(120);

    for (const values of [
      CARE_ACTION_PARTITION_KEYS_V1,
      CARE_APPOINTMENT_BUSINESS_STATES_V1,
      CARE_FOLLOW_UP_BUSINESS_STATES_V1,
      CARE_ACTION_RISK_LEVELS_V1,
      CARE_ACTION_PRIORITIES_V1,
    ]) {
      expect(Object.isFrozen(values)).toBe(true);
    }
  });

  it('keeps scalar guards shallow and rejects legacy derived states', () => {
    expect(isCareActionPartitionKeyV1('overdue_followups')).toBe(true);
    expect(isCareActionPartitionKeyV1('unknown')).toBe(false);
    expect(isCareAppointmentBusinessStateV1('pending_confirmation')).toBe(true);
    expect(isCareAppointmentBusinessStateV1('reschedule_requested')).toBe(false);
    expect(isCareFollowUpBusinessStateV1('waiting_customer')).toBe(true);
    expect(isCareFollowUpBusinessStateV1('overdue')).toBe(false);
    expect(isCareFollowUpBusinessStateV1('today_due')).toBe(false);
  });

  it('binds each card key to its canonical href and non-null count declaration', () => {
    expectTypeOf<CareActionCardV1>().toEqualTypeOf<
      | {
          key: 'pending_confirmation_appointments';
          count: number;
          canonicalHref: '/hospital/care/appointments?status=pending_confirmation';
        }
      | {
          key: 'reschedule_requested_appointments';
          count: number;
          canonicalHref: '/hospital/care/appointments?status=reschedule_requested';
        }
      | {
          key: 'overdue_followups';
          count: number;
          canonicalHref: '/hospital/care/followups?bucket=overdue';
        }
      | {
          key: 'today_due_followups';
          count: number;
          canonicalHref: '/hospital/care/followups?bucket=today';
        }
    >();
    expectTypeOf<keyof CareActionCardV1>().toEqualTypeOf<
      'key' | 'count' | 'canonicalHref'
    >();
  });

  it('declares the exact low-sensitivity owner variants', () => {
    expectTypeOf<CareActionOwnerV1>().toEqualTypeOf<
      | { kind: 'user'; userId: string; displayName: string }
      | { kind: 'role_pool'; role: InstitutionRoleV1 }
    >();

    const userOwner = {
      kind: 'user',
      userId: 'user-safe-reference',
      displayName: '机构成员',
    } satisfies CareActionOwnerV1;
    const rolePoolOwner = {
      kind: 'role_pool',
      role: 'customer_service',
    } satisfies CareActionOwnerV1;

    expect(Object.keys(userOwner).sort()).toEqual(['displayName', 'kind', 'userId']);
    expect(Object.keys(rolePoolOwner).sort()).toEqual(['kind', 'role']);
  });

  it('declares the exact fifteen-field discriminated action union', () => {
    type ExpectedActionKeys =
      | 'entityType'
      | 'objectId'
      | 'sourceVersion'
      | 'customer'
      | 'businessState'
      | 'cardKeys'
      | 'sortSignals'
      | 'appointmentAt'
      | 'dueAt'
      | 'slaAt'
      | 'riskLevel'
      | 'priority'
      | 'owner'
      | 'safeSummary'
      | 'detailHref';

    expectTypeOf<keyof CareActionItemV1>().toEqualTypeOf<ExpectedActionKeys>();
    expectTypeOf<keyof CareAppointmentActionItemV1>().toEqualTypeOf<ExpectedActionKeys>();
    expectTypeOf<keyof CareFollowUpActionItemV1>().toEqualTypeOf<ExpectedActionKeys>();

    expectTypeOf<CareAppointmentActionItemV1['entityType']>().toEqualTypeOf<'appointment'>();
    expectTypeOf<CareAppointmentActionItemV1['businessState']>().toEqualTypeOf<
      'pending_confirmation' | 'confirmed' | 'arrived' | 'completed' | 'cancelled' | 'no_show'
    >();
    expectTypeOf<CareAppointmentActionItemV1['detailHref']>().toEqualTypeOf<
      `/hospital/care/appointments/${string}`
    >();
    expectTypeOf<CareFollowUpActionItemV1['entityType']>().toEqualTypeOf<'followup'>();
    expectTypeOf<CareFollowUpActionItemV1['businessState']>().toEqualTypeOf<
      'pending' | 'in_progress' | 'waiting_customer' | 'escalated' | 'completed' | 'cancelled'
    >();
    expectTypeOf<CareFollowUpActionItemV1['detailHref']>().toEqualTypeOf<
      `/hospital/care/followups/${string}`
    >();

    expectTypeOf<CareActionItemV1['objectId']>().toEqualTypeOf<string>();
    expectTypeOf<CareActionItemV1['sourceVersion']>().toEqualTypeOf<string>();
    expectTypeOf<CareActionItemV1['customer']>().toEqualTypeOf<CustomerReferenceV1>();
    expectTypeOf<CareActionItemV1['cardKeys']>().toEqualTypeOf<CareActionPartitionKeyV1[]>();
    expectTypeOf<CareActionItemV1['sortSignals']>().toEqualTypeOf<
      InstitutionActionSortSignalV1[]
    >();
    expectTypeOf<CareActionItemV1['appointmentAt']>().toEqualTypeOf<string | null>();
    expectTypeOf<CareActionItemV1['dueAt']>().toEqualTypeOf<string | null>();
    expectTypeOf<CareActionItemV1['slaAt']>().toEqualTypeOf<string | null>();
    expectTypeOf<CareActionItemV1['riskLevel']>().toEqualTypeOf<
      'normal' | 'watch' | 'urgent'
    >();
    expectTypeOf<CareActionItemV1['priority']>().toEqualTypeOf<'normal' | 'high'>();
    expectTypeOf<CareActionItemV1['owner']>().toEqualTypeOf<CareActionOwnerV1 | null>();
    expectTypeOf<CareActionItemV1['safeSummary']>().toEqualTypeOf<string | null>();
  });

  it('keeps payload and source declarations structurally exact', () => {
    expectTypeOf<keyof CareActionPayloadV1>().toEqualTypeOf<'cards' | 'actions'>();
    expectTypeOf<CareActionPayloadV1['cards']>().toEqualTypeOf<CareActionCardV1[]>();
    expectTypeOf<CareActionPayloadV1['actions']>().toEqualTypeOf<CareActionItemV1[]>();
    expectTypeOf<CareActionSourceV1>().toEqualTypeOf<
      InstitutionSourceEnvelopeV1<CareActionPayloadV1, CareActionPartitionKeyV1>
    >();
  });

  it('documents disabled, stale and scope-mismatch source declarations without parsing them', () => {
    const scope = {
      tenantId: 'tenant-safe-reference',
      institutionId: 'institution-safe-reference',
    };

    const disabledWithoutHis = {
      contractVersion: 'v1',
      scope,
      readiness: 'partial',
      freshness: null,
      partitions: [
        {
          key: 'pending_confirmation_appointments',
          readiness: 'disabled',
          freshness: null,
          failureCode: 'not_released',
        },
        {
          key: 'reschedule_requested_appointments',
          readiness: 'disabled',
          freshness: null,
          failureCode: 'not_released',
        },
        {
          key: 'overdue_followups',
          readiness: 'empty',
          freshness: {
            observedAt: '2026-07-17T00:00:00.000Z',
            freshUntil: '2026-07-17T00:05:00.000Z',
          },
          failureCode: null,
        },
        {
          key: 'today_due_followups',
          readiness: 'empty',
          freshness: {
            observedAt: '2026-07-17T00:00:00.000Z',
            freshUntil: '2026-07-17T00:05:00.000Z',
          },
          failureCode: null,
        },
      ],
      data: {
        cards: [
          {
            key: 'overdue_followups',
            count: 0,
            canonicalHref: '/hospital/care/followups?bucket=overdue',
          },
          {
            key: 'today_due_followups',
            count: 0,
            canonicalHref: '/hospital/care/followups?bucket=today',
          },
        ],
        actions: [],
      },
      failureCode: null,
    } satisfies CareActionSourceV1;

    const staleSnapshot = {
      contractVersion: 'v1',
      scope,
      readiness: 'stale',
      freshness: {
        observedAt: '2026-07-17T00:00:00.000Z',
        freshUntil: '2026-07-17T00:05:00.000Z',
      },
      partitions: [
        {
          key: 'pending_confirmation_appointments',
          readiness: 'stale',
          freshness: {
            observedAt: '2026-07-17T00:00:00.000Z',
            freshUntil: '2026-07-17T00:05:00.000Z',
          },
          failureCode: 'data_incomplete',
        },
        {
          key: 'reschedule_requested_appointments',
          readiness: 'stale',
          freshness: {
            observedAt: '2026-07-17T00:00:00.000Z',
            freshUntil: '2026-07-17T00:05:00.000Z',
          },
          failureCode: 'data_incomplete',
        },
        {
          key: 'overdue_followups',
          readiness: 'stale',
          freshness: {
            observedAt: '2026-07-17T00:00:00.000Z',
            freshUntil: '2026-07-17T00:05:00.000Z',
          },
          failureCode: 'data_incomplete',
        },
        {
          key: 'today_due_followups',
          readiness: 'stale',
          freshness: {
            observedAt: '2026-07-17T00:00:00.000Z',
            freshUntil: '2026-07-17T00:05:00.000Z',
          },
          failureCode: 'data_incomplete',
        },
      ],
      data: {
        cards: [
          {
            key: 'pending_confirmation_appointments',
            count: 1,
            canonicalHref: '/hospital/care/appointments?status=pending_confirmation',
          },
          {
            key: 'reschedule_requested_appointments',
            count: 1,
            canonicalHref: '/hospital/care/appointments?status=reschedule_requested',
          },
          {
            key: 'overdue_followups',
            count: 2,
            canonicalHref: '/hospital/care/followups?bucket=overdue',
          },
          {
            key: 'today_due_followups',
            count: 1,
            canonicalHref: '/hospital/care/followups?bucket=today',
          },
        ],
        actions: [],
      },
      failureCode: 'data_incomplete',
    } satisfies CareActionSourceV1;

    const scopeMismatch = {
      contractVersion: 'v1',
      scope,
      readiness: 'denied',
      freshness: null,
      partitions: CARE_ACTION_PARTITION_KEYS_V1.map((key) => ({
        key,
        readiness: 'denied' as const,
        freshness: null,
        failureCode: 'scope_mismatch' as const,
      })),
      data: null,
      failureCode: 'scope_mismatch',
    } satisfies CareActionSourceV1;

    expect(disabledWithoutHis.data.actions).toEqual([]);
    expect(disabledWithoutHis.data.cards.map((card) => card.key)).toEqual([
      'overdue_followups',
      'today_due_followups',
    ]);
    expect(staleSnapshot.data.actions).toEqual([]);
    expect(scopeMismatch.data).toBeNull();
  });

  it('provides declaration fixtures for appointment and follow-up actions', () => {
    const customer = {
      contractVersion: 'v1',
      customerId: 'customer-safe-reference',
      displayName: '客户',
      maskedReference: '客户-001',
    } satisfies CustomerReferenceV1;

    const appointment = {
      entityType: 'appointment',
      objectId: 'appointment-safe-reference',
      sourceVersion: 'source-version-safe-reference',
      customer,
      businessState: 'pending_confirmation',
      cardKeys: ['pending_confirmation_appointments'],
      sortSignals: ['today'],
      appointmentAt: '2026-07-17T02:00:00.000Z',
      dueAt: null,
      slaAt: null,
      riskLevel: 'normal',
      priority: 'normal',
      owner: { kind: 'user', userId: 'user-safe-reference', displayName: '机构成员' },
      safeSummary: null,
      detailHref: '/hospital/care/appointments/appointment-safe-reference',
    } satisfies CareActionItemV1;

    const followUp = {
      entityType: 'followup',
      objectId: 'followup-safe-reference',
      sourceVersion: 'source-version-safe-reference',
      customer,
      businessState: 'waiting_customer',
      cardKeys: ['overdue_followups'],
      sortSignals: ['overdue', 'high_priority'],
      appointmentAt: null,
      dueAt: '2026-07-16T02:00:00.000Z',
      slaAt: '2026-07-17T03:00:00.000Z',
      riskLevel: 'watch',
      priority: 'high',
      owner: { kind: 'role_pool', role: 'customer_service' },
      safeSummary: '等待人工继续处理',
      detailHref: '/hospital/care/followups/followup-safe-reference',
    } satisfies CareActionItemV1;

    expect(Object.keys(appointment).sort()).toEqual(Object.keys(followUp).sort());
    expect(appointment.entityType).toBe('appointment');
    expect(followUp.entityType).toBe('followup');
  });
});
