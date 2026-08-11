import { describe, expect, it, vi } from 'vitest';

import { createHisConnectionCredentialCompensationJobQueueRepository } from '@/modules/institution/server/his-connection-credential-compensation-job-queue-repository';
import type { TenantDatabase } from '@/server/db/client';

describe('legacy credential compensation job repository', () => {
  it('fails closed at factory construction before any DB mutation', () => {
    const insert = vi.fn();
    const update = vi.fn();
    const database = { insert, update } as unknown as TenantDatabase;

    expect(() =>
      createHisConnectionCredentialCompensationJobQueueRepository(database),
    ).toThrow('legacy_institution_credential_compensation_job_repository_disabled');

    expect(insert).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });
});
