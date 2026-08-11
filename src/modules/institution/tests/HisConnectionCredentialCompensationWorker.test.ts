import { describe, expect, it, vi } from 'vitest';

import { createHisConnectionCredentialCompensationWorker } from '@/modules/institution/server/his-connection-credential-compensation-worker';

describe('legacy credential compensation worker', () => {
  it('fails closed before repository or provider execution', () => {
    const operationRepository = new Proxy({}, {
      get() {
        throw new Error('legacy operation repository must not be touched');
      },
    });
    const jobQueueRepository = new Proxy({}, {
      get() {
        throw new Error('legacy job repository must not be touched');
      },
    });
    const providerExecutor = vi.fn();

    expect(() =>
      createHisConnectionCredentialCompensationWorker({
        operationRepository,
        jobQueueRepository,
        providerExecutor,
      }),
    ).toThrow('legacy_institution_credential_compensation_worker_disabled');

    expect(providerExecutor).not.toHaveBeenCalled();
  });
});
