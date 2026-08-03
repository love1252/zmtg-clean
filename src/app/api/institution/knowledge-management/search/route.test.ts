import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROUTE_PATH = 'src/app/api/institution/knowledge-management/search/route.ts';

describe('BASE-B4-ROUTE-04 first-batch Route Guard wiring', () => {
  it('uses only the frozen knowledge Section Guard boundary', async () => {
    const source = await readFile(
      resolve(process.cwd(), ROUTE_PATH),
      'utf8',
    );

    expect(source).toContain(
      "from '@/app/api/institution/_shared/institution-route-guard'",
    );
    expect(source).toContain(
      "const _base02B4GuardedGET = withInstitutionSectionRouteGuardV1({",
    );
    expect(source).toContain("sectionId: 'knowledge'");
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
  });
});
