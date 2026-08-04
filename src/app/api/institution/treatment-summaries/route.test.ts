import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROUTE_PATH = 'src/app/api/institution/treatment-summaries/route.ts';

describe('BASE-B4-ROUTE-THIRD-02 Route Guard wiring', () => {
  it('uses the frozen care Section Guard and preserves the existing handler boundary', async () => {
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
    expect(source).toContain("sectionId: 'care'");
    expect(source).toContain('handler: GET');
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
