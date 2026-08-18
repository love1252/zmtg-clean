
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('Workbench Care controlled-write integration', () => {
  it('keeps CareActionSource and gates both Care quick-create actions through target authorization', () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        'src/app/hospital/page.tsx',
      ),
      'utf8',
    );

    expect(source).toContain("'page_care_followups'");
    expect(source).toContain("'page_care_appointments'");
    expect(source).toContain(
      'readCurrentInstitutionCareActionSourceV1',
    );
    expect(source).toContain(
      'buildWorkbenchActionProjection',
    );
    expect(source).toContain(
      "'action_care_appointment_create'",
    );
    expect(source).toContain(
      "'action_care_followup_create'",
    );
    expect(source).toContain(
      'canCurrentInstitutionCreateFormalAppointmentV1',
    );
    expect(source).toContain(
      'canCurrentInstitutionCreateFormalFollowUpV1',
    );
    expect(source).toContain(
      "readiness: 'disabled'",
    );
    expect(source).toContain(
      "key: 'waiting_human'",
    );
    expect(source).toContain(
      "key: 'unresolved_risk'",
    );
  });
});
