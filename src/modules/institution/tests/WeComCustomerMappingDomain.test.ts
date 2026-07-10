import { describe, expect, it } from 'vitest';
import {
  decideWeComCustomerMappingTransition,
  type PersistedWeComCustomerMappingStatus,
  type WeComCustomerMappingAction,
} from '@/modules/institution/domain/wecom-customer-mapping';

type Case = {
  currentStatus: PersistedWeComCustomerMappingStatus | 'unreviewed';
  currentCustomerId?: string;
  action: WeComCustomerMappingAction;
  customerId: string;
  expectedKind: 'transition' | 'idempotent' | 'conflict' | 'invalid_transition';
  expectedStatus?: PersistedWeComCustomerMappingStatus;
};

const cases: Case[] = [
  { currentStatus: 'unreviewed', action: 'confirm', customerId: 'customer-a', expectedKind: 'transition', expectedStatus: 'confirmed' },
  { currentStatus: 'unreviewed', action: 'reject', customerId: 'customer-a', expectedKind: 'transition', expectedStatus: 'rejected' },
  { currentStatus: 'unreviewed', action: 'revoke', customerId: 'customer-a', expectedKind: 'invalid_transition' },
  { currentStatus: 'confirmed', currentCustomerId: 'customer-a', action: 'confirm', customerId: 'customer-a', expectedKind: 'idempotent', expectedStatus: 'confirmed' },
  { currentStatus: 'confirmed', currentCustomerId: 'customer-a', action: 'confirm', customerId: 'customer-b', expectedKind: 'conflict' },
  { currentStatus: 'confirmed', currentCustomerId: 'customer-a', action: 'reject', customerId: 'customer-a', expectedKind: 'invalid_transition' },
  { currentStatus: 'confirmed', currentCustomerId: 'customer-a', action: 'revoke', customerId: 'customer-a', expectedKind: 'transition', expectedStatus: 'revoked' },
  { currentStatus: 'confirmed', currentCustomerId: 'customer-a', action: 'revoke', customerId: 'customer-b', expectedKind: 'invalid_transition' },
  { currentStatus: 'rejected', currentCustomerId: 'customer-a', action: 'confirm', customerId: 'customer-b', expectedKind: 'transition', expectedStatus: 'confirmed' },
  { currentStatus: 'rejected', currentCustomerId: 'customer-a', action: 'reject', customerId: 'customer-a', expectedKind: 'idempotent', expectedStatus: 'rejected' },
  { currentStatus: 'rejected', currentCustomerId: 'customer-a', action: 'reject', customerId: 'customer-b', expectedKind: 'invalid_transition' },
  { currentStatus: 'rejected', currentCustomerId: 'customer-a', action: 'revoke', customerId: 'customer-a', expectedKind: 'invalid_transition' },
  { currentStatus: 'revoked', currentCustomerId: 'customer-a', action: 'confirm', customerId: 'customer-b', expectedKind: 'transition', expectedStatus: 'confirmed' },
  { currentStatus: 'revoked', currentCustomerId: 'customer-a', action: 'reject', customerId: 'customer-b', expectedKind: 'transition', expectedStatus: 'rejected' },
  { currentStatus: 'revoked', currentCustomerId: 'customer-a', action: 'revoke', customerId: 'customer-a', expectedKind: 'idempotent', expectedStatus: 'revoked' },
  { currentStatus: 'revoked', currentCustomerId: 'customer-a', action: 'revoke', customerId: 'customer-b', expectedKind: 'invalid_transition' },
];

describe('WeComCustomerMapping domain', () => {
  it.each(cases)(
    '$currentStatus + $action($customerId) => $expectedKind',
    ({ currentStatus, currentCustomerId, action, customerId, expectedKind, expectedStatus }) => {
      const result = decideWeComCustomerMappingTransition({
        current:
          currentStatus === 'unreviewed'
            ? null
            : { status: currentStatus, customerId: currentCustomerId ?? 'customer-a' },
        action,
        customerId,
      });

      expect(result.kind).toBe(expectedKind);
      if (expectedStatus && (result.kind === 'transition' || result.kind === 'idempotent')) {
        expect(result.kind === 'transition' ? result.toStatus : result.status).toBe(expectedStatus);
      }
    },
  );

  it('失败决策不返回可持久化状态', () => {
    const conflict = decideWeComCustomerMappingTransition({
      current: { status: 'confirmed', customerId: 'customer-a' },
      action: 'confirm',
      customerId: 'customer-b',
    });
    const invalid = decideWeComCustomerMappingTransition({
      current: null,
      action: 'revoke',
      customerId: 'customer-a',
    });

    expect(conflict).toEqual({ kind: 'conflict' });
    expect(invalid).toEqual({ kind: 'invalid_transition' });
  });
});
