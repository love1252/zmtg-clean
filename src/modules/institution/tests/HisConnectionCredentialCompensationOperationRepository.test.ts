import { describe, expect, it, vi } from 'vitest';

import { createHisConnectionCredentialCompensationOperationRepository } from '@/modules/institution/server/his-connection-credential-compensation-operation-repository';
import type { TenantDatabase } from '@/server/db/client';

describe('legacy credential compensation operation repository', () => {
  it('fails closed at factory construction before any DB mutation', () => {
    const insert = vi.fn();
    const update = vi.fn();
    const database = { insert, update } as unknown as TenantDatabase;

    expect(() =>
      createHisConnectionCredentialCompensationOperationRepository(database),
    ).toThrow('legacy_institution_credential_compensation_operation_repository_disabled');

    expect(insert).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });
});
