import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROUTE_PATH = 'src/app/api/institution/ai-service-usage/route.ts';

describe('BASE-B4-ROUTE-FOURTH-01 Route Guard wiring', () => {
  it('uses the frozen system Section Guard and preserves the 410 capability-off handler', async () => {
    const source = await readFile(
      resolve(process.cwd(), ROUTE_PATH),
      'utf8',
    );
    const imports = source
      .split('\n')
      .filter((line) => line.startsWith('import '));

    expect(imports).toEqual([
      "import { withInstitutionSectionRouteGuardV1 } from '@/app/api/institution/_shared/institution-route-guard';",
      "import { NextResponse } from 'next/server';",
    ]);
    expect(source).toContain(
      'const _base02B4GuardedGET = withInstitutionSectionRouteGuardV1({',
    );
    expect(source).toContain("sectionId: 'system'");
    expect(source).toContain('handler: GET');
    expect(source).toContain('status: 410');
    expect(source).toContain(
      'export { _base02B4GuardedGET as GET };',
    );
    expect(source).not.toContain(
      'authorizeCurrentInstitutionActionV1',
    );
    expect(source).not.toContain(
      'authorizeCurrentInstitutionObjectV1',
    );
    expect(source.match(/withInstitutionSectionRouteGuardV1/g)).toHaveLength(2);
  });
});
