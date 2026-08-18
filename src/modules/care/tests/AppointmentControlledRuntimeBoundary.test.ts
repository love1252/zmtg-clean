
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('Appointment controlled-write runtime boundary', () => {
  it('keeps exact scope, target authorization, CAS, audit and external-system boundaries', () => {
    const runtime = readFileSync(
      resolve(
        process.cwd(),
        'src/server/orchestration/institution-appointment-controlled-write-runtime.ts',
      ),
      'utf8',
    );
    const repository = readFileSync(
      resolve(
        process.cwd(),
        'src/modules/care/server/appointment-command-repository.ts',
      ),
      'utf8',
    );

    expect(runtime).toContain(
      'resolveInstitutionCareWriteAuthorizationV1',
    );
    expect(runtime).toContain(
      "'page_care_appointments'",
    );
    expect(runtime).toContain(
      "'action_care_appointment_create'",
    );
    expect(runtime).toContain(
      'resolveInstitutionAuditWriterVerifiedAttributionV1',
    );
    expect(runtime).toContain(
      "resource: 'appointment'",
    );
    expect(repository).toContain(
      'eq(appointments.tenantId, input.tenantId)',
    );
    expect(repository).toContain(
      'eq(appointments.institutionId, input.institutionId)',
    );
    expect(repository).toContain(
      'eq(appointments.updatedAt, new Date(input.expectedUpdatedAt))',
    );
    expect(`${runtime}\n${repository}`).not.toMatch(
      /wecom|real[_-]?send|his[_-]?mutation|integrations\//iu,
    );
  });
});
