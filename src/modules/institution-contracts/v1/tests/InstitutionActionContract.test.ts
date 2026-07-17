import { describe, expect, expectTypeOf, it } from 'vitest';

import {
  INSTITUTION_ACTION_SORT_SIGNALS_V1,
  isInstitutionActionSortSignalV1,
  type InstitutionActionSortSignalV1,
} from '@/modules/institution-contracts/v1/institution-action';

describe('InstitutionActionContractV1', () => {
  it('freezes the shared five-signal priority order', () => {
    expect(INSTITUTION_ACTION_SORT_SIGNALS_V1).toEqual([
      'urgent',
      'overdue',
      'sla_due',
      'today',
      'high_priority',
    ]);
    expect(Object.isFrozen(INSTITUTION_ACTION_SORT_SIGNALS_V1)).toBe(true);

    for (const signal of INSTITUTION_ACTION_SORT_SIGNALS_V1) {
      expect(isInstitutionActionSortSignalV1(signal)).toBe(true);
    }

    expect(isInstitutionActionSortSignalV1('normal')).toBe(false);
    expect(isInstitutionActionSortSignalV1('today_due')).toBe(false);
    expect(isInstitutionActionSortSignalV1(1)).toBe(false);
  });

  it('keeps the public signal type exact', () => {
    expectTypeOf<InstitutionActionSortSignalV1>().toEqualTypeOf<
      'urgent' | 'overdue' | 'sla_due' | 'today' | 'high_priority'
    >();
  });
});
