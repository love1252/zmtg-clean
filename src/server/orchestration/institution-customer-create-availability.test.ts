
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('Customer create availability boundary', () => {
  it('requires formal write auth, management role and exact release capability', () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        'src/server/orchestration/institution-customer-create-availability.ts',
      ),
      'utf8',
    );
    expect(source).toContain('resolveInstitutionCustomerWriteAuthorizationV1');
    expect(source).toContain("actor.role !== 'tenant_admin'");
    expect(source).toContain("actor.role !== 'tenant_operator'");
    expect(source).toContain("'action_customer_create'");
    expect(source).toContain("'operational'");
    expect(source).toContain("'pilot_released'");
  });
});
