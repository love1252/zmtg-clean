
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('/hospital/customers/[customerId] controlled detail', () => {
  it('uses capability + orchestration and excludes direct persistence/external integrations', () => {
    const path = resolve(
      process.cwd(),
      'src/app/hospital/customers/[customerId]/page.tsx',
    );
    expect(existsSync(path)).toBe(true);
    const source = readFileSync(path, 'utf8');
    expect(source).toContain('readCurrentInstitutionCustomerControlledV1');
    expect(source).toContain("'page_customer_list'");
    expect(source).not.toContain('getDatabase');
    expect(source).not.toMatch(/customer-command-repository|wecom|his|integrations\//iu);
  });
});
