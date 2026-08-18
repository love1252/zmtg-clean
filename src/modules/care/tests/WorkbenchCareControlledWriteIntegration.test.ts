import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('Workbench Care controlled-write integration', () => {
  it('consumes formal CareActionSource and exposes quick-create only after target role authorization', () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        'src/app/hospital/page.tsx',
      ),
      'utf8',
    );

    expect(source).toContain(
      "'page_care_followups'",
    );
    expect(source).toContain(
      'readCurrentInstitutionCareActionSourceV1',
    );
    expect(source).toContain(
      'buildWorkbenchActionProjection',
    );
    const componentSource = readFileSync(
      resolve(
        process.cwd(),
        'src/modules/institution-workbench/components/InstitutionWorkbenchCapabilityOff.tsx',
      ),
      'utf8',
    );
    expect(componentSource).toContain(
      "'controlled-write-pilot'",
    );
    expect(source).toContain(
      "quickCreate.items[0]?.key !== 'action_care_followup_create'",
    );
    expect(source).toContain(
      'canCurrentInstitutionCreateFormalFollowUpV1',
    );
    expect(source).toMatch(
      /quickCreateMenu:\s*allowCareCreate\s*\?\s*quickCreate\s*:\s*null/um,
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
