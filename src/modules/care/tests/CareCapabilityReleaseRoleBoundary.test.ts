import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('Care controlled-write capability/role boundary', () => {
  it('keeps Capability Authority role-agnostic and target write authorization role-aware', () => {
    const authority = readFileSync(
      resolve(
        process.cwd(),
        'src/server/orchestration/institution-capability-authority.ts',
      ),
      'utf8',
    );
    const writeAuthorization = readFileSync(
      resolve(
        process.cwd(),
        'src/server/orchestration/institution-care-write-authorization.ts',
      ),
      'utf8',
    );
    const runtime = readFileSync(
      resolve(
        process.cwd(),
        'src/server/orchestration/institution-formal-follow-up-runtime.ts',
      ),
      'utf8',
    );

    expect(authority).toContain(
      "definition.key === 'action_care_followup_create'",
    );
    expect(authority).not.toMatch(
      /context\.role|membership\.role|actorRole/u,
    );
    expect(writeAuthorization).toContain(
      "action: 'update'",
    );
    expect(runtime).toContain(
      'isManagement(actor.role)',
    );
  });
});
