
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('/hospital/care/appointments/[appointmentId] controlled detail', () => {
  it('uses target capability + orchestration runtime and keeps direct persistence/external integrations out', () => {
    const path = resolve(
      process.cwd(),
      'src/app/hospital/care/appointments/[appointmentId]/page.tsx',
    );
    expect(existsSync(path)).toBe(true);
    const source = readFileSync(path, 'utf8');
    expect(source).toContain(
      'readCurrentInstitutionAppointmentControlledV1',
    );
    expect(source).toContain(
      "'page_care_appointments'",
    );
    expect(source).not.toContain('getDatabase');
    expect(source).not.toMatch(
      /appointment-command-repository|wecom|his|integrations\//iu,
    );
  });
});
