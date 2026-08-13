import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROUTE_PATH = 'src/app/api/institution/audit-events/route.ts';

describe('机构端审计日志正式 Route wiring', () => {
  it('保留 system Section Guard，并只连接 parser 与 orchestration Reader', async () => {
    const source = await readFile(
      resolve(process.cwd(), ROUTE_PATH),
      'utf8',
    );
    const imports = source
      .split('\n')
      .filter((line) => line.startsWith('import '));

    expect(imports).toEqual([
      "import { withInstitutionSectionRouteGuardV1 } from '@/app/api/institution/_shared/institution-route-guard';",
      "import { parseAuditEventQueryParams } from '@/modules/audit/server/audit-event-query-parser';",
      "import { readCurrentInstitutionAuditEventsV1 } from '@/server/orchestration/institution-audit-reader';",
      "import { NextResponse } from 'next/server';",
    ]);
    expect(source).toContain('parseAuditEventQueryParams');
    expect(source).toContain('readCurrentInstitutionAuditEventsV1');
    expect(source).toContain(
      'const _base02B4GuardedGET = withInstitutionSectionRouteGuardV1({',
    );
    expect(source).toContain("sectionId: 'system'");
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
    expect(source).not.toContain('getDemoAccessContextFromRequest');
    expect(source).not.toContain('createAuditEventRepository');
    expect(source).not.toContain('getDatabase');
    expect(source).not.toContain('page_system_audit');
    expect(source).not.toContain('pilot_released');
    expect(source.match(/withInstitutionSectionRouteGuardV1/g)).toHaveLength(2);
  });
});
