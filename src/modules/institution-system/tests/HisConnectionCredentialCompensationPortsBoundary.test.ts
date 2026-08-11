import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('Institution System compensation port ownership boundary', () => {
  it('keeps the canonical worker on domain/application ports without server or legacy imports', () => {
    const source = readFileSync(
      join(
        process.cwd(),
        'src/modules/institution-system/application/his-connection-credential-compensation-worker.ts',
      ),
      'utf8',
    );

    expect(source).toContain(
      '@/modules/institution-system/application/his-connection-credential-compensation-ports',
    );
    expect(source).toContain(
      '@/modules/institution-system/application/his-connection-credential-compensation-retry-policy',
    );
    expect(source).toContain(
      '@/modules/institution-system/domain/his-connection-credential-compensation',
    );
    expect(source).not.toContain('@/modules/institution/server/');
    expect(source).not.toContain('@/modules/institution-system/server/');
    expect(source).not.toContain('@/server/db/client');
    expect(source).not.toContain('database.transaction');
  });

  it('keeps canonical repositories as server adapters that explicitly implement application ports', () => {
    const operation = readFileSync(
      join(
        process.cwd(),
        'src/modules/institution-system/server/his-connection-credential-compensation-operation-repository.ts',
      ),
      'utf8',
    );
    const job = readFileSync(
      join(
        process.cwd(),
        'src/modules/institution-system/server/his-connection-credential-compensation-job-queue-repository.ts',
      ),
      'utf8',
    );

    expect(operation).toContain('HisConnectionCredentialCompensationOperationRepositoryPort');
    expect(job).toContain('HisConnectionCredentialCompensationJobQueueRepositoryPort');
    expect(operation).not.toContain('@/modules/institution/server/');
    expect(job).not.toContain('@/modules/institution/server/');
  });
});
