import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('Formal follow-up runtime boundary', () => {
  const runtime = readFileSync(
    join(
      process.cwd(),
      'src/server/orchestration/institution-formal-follow-up-runtime.ts',
    ),
    'utf8',
  );
  const repository = readFileSync(
    join(
      process.cwd(),
      'src/modules/care/server/formal-follow-up-repository.ts',
    ),
    'utf8',
  );

  it('uses transactions, CAS, append-only events and institution audit for writes', () => {
    expect(
      runtime.match(/database\.transaction/gu)
        ?.length,
    ).toBeGreaterThanOrEqual(2);
    expect(runtime).toContain(
      'auditChanged(',
    );
    expect(repository).toContain(
      'careFormalFollowUpEvents',
    );
    expect(repository).toMatch(
      /eq\(\s*careFormalFollowUpTasks\.revision,\s*input\.expectedRevision/um,
    );
  });

  it('never introduces real send, inbound, HIS mutation or external provider calls', () => {
    expect(runtime).not.toMatch(
      /wecom|aibotk|webhook|sendmessage|provider_payload|raw_payload/iu,
    );
    expect(runtime).toContain(
      'his_completion_not_released',
    );
    expect(runtime).not.toMatch(
      /\bfetch\s*\(/u,
    );
  });

  it('does not accept caller tenant/institution scope', () => {
    expect(runtime).toContain(
      'resolveInstitutionCareWriteAuthorizationV1',
    );
    expect(runtime).toContain(
      'actor.tenantId',
    );
    expect(runtime).toContain(
      'actor.institutionId',
    );
    expect(runtime).not.toMatch(
      /raw\.tenantId|raw\.institutionId/u,
    );
  });
});
