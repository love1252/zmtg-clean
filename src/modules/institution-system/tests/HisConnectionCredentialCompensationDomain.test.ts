import { describe, expect, it } from 'vitest';

import {
  hisConnectionCredentialCompensationDeadLetterReasons,
  hisConnectionCredentialCompensationJobStates,
  hisConnectionCredentialCompensationOperationTypes,
  hisConnectionCredentialCompensationProviderExecutionResultStatuses,
  hisConnectionCredentialCompensationStates,
  hisConnectionCredentialProviderFailureCategories,
  isSafeHisConnectionCredentialCompensationOperationId,
} from '@/modules/institution-system/domain/his-connection-credential-compensation';
import {
  hisConnectionCredentialCompensationOperationTypes as legacyOperationTypes,
  hisConnectionCredentialCompensationStates as legacyStates,
  hisConnectionCredentialProviderFailureCategories as legacyFailureCategories,
  isSafeHisConnectionCredentialCompensationOperationId as legacySafeOperationId,
} from '@/modules/institution/server/his-connection-credential-provider-failure';
import {
  hisConnectionCredentialCompensationDeadLetterReasons as legacyDeadLetterReasons,
  hisConnectionCredentialCompensationJobStates as legacyJobStates,
} from '@/modules/institution/server/his-connection-credential-compensation-job-queue-repository';
import {
  hisConnectionCredentialCompensationProviderExecutionResultStatuses as legacyProviderResults,
} from '@/modules/institution/server/his-connection-credential-compensation-worker';

describe('Institution System credential compensation domain', () => {
  it('locks compensation literals to legacy compatibility evidence', () => {
    expect(hisConnectionCredentialProviderFailureCategories).toEqual(legacyFailureCategories);
    expect(hisConnectionCredentialCompensationStates).toEqual(legacyStates);
    expect(hisConnectionCredentialCompensationOperationTypes).toEqual(legacyOperationTypes);
    expect(hisConnectionCredentialCompensationJobStates).toEqual(legacyJobStates);
    expect(hisConnectionCredentialCompensationDeadLetterReasons).toEqual(legacyDeadLetterReasons);
    expect(hisConnectionCredentialCompensationProviderExecutionResultStatuses).toEqual(
      legacyProviderResults,
    );
  });

  it('preserves the safe operation-id contract', () => {
    const valid = `his_cred_comp_op_${'a'.repeat(32)}`;
    expect(isSafeHisConnectionCredentialCompensationOperationId(valid)).toBe(true);
    expect(legacySafeOperationId(valid)).toBe(true);
    for (const invalid of [
      `his_cred_comp_op_${'a'.repeat(31)}`,
      `his_cred_comp_op_${'A'.repeat(32)}`,
      'cred_ref_should_never_be_an_operation_id',
      '',
    ]) {
      expect(isSafeHisConnectionCredentialCompensationOperationId(invalid)).toBe(false);
      expect(legacySafeOperationId(invalid)).toBe(false);
    }
  });
});
