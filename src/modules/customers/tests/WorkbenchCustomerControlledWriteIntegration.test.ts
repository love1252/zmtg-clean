
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('Workbench Customer controlled-write integration', () => {
  it('gates customer/appointment/follow-up quick create independently', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/app/hospital/page.tsx'),
      'utf8',
    );
    expect(source).toContain("'action_customer_create'");
    expect(source).toContain("'action_care_appointment_create'");
    expect(source).toContain("'action_care_followup_create'");
    expect(source).toContain('canCurrentInstitutionCreateFormalCustomerV1');
    expect(source).toContain('canCurrentInstitutionCreateFormalAppointmentV1');
    expect(source).toContain('canCurrentInstitutionCreateFormalFollowUpV1');
  });
});
