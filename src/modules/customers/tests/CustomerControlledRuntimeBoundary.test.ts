
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('Customer controlled-write runtime boundary', () => {
  it('locks auth, quota, exact scope, CAS, owner validation and audit', () => {
    const runtime = readFileSync(
      resolve(
        process.cwd(),
        'src/server/orchestration/institution-customer-controlled-write-runtime.ts',
      ),
      'utf8',
    );
    const repo = readFileSync(
      resolve(
        process.cwd(),
        'src/modules/customers/server/customer-command-repository.ts',
      ),
      'utf8',
    );
    const dto = readFileSync(
      resolve(
        process.cwd(),
        'src/modules/customers/application/customer-controlled-view.ts',
      ),
      'utf8',
    );

    expect(runtime).toContain('resolveInstitutionCustomerWriteAuthorizationV1');
    expect(runtime).toContain('lockTenantCustomerCreateQuotaV1');
    expect(runtime).toContain('checkTenantQuotaForCreate');
    expect(runtime.indexOf('lockTenantCustomerCreateQuotaV1({')).toBeLessThan(
      runtime.indexOf('checkTenantQuotaForCreate({'),
    );
    expect(runtime).toContain("resource: 'customers'");
    expect(runtime).toContain('resolveCurrentOwner');
    expect(runtime).toContain('resolveInstitutionAuditWriterVerifiedAttributionV1');
    expect(repo).toContain('gte(customers.updatedAt, expectedUpdatedAt)');
    expect(repo).toContain('lt(customers.updatedAt, expectedUpperBound)');
    expect(repo).toContain('Math.max(Date.now(), expectedUpperBound.getTime())');
    expect(dto).not.toMatch(/notes|birthDate|gender|referralSource|maskedPhone|maskedMedicalRecordNo/u);
    expect(`${runtime}\n${repo}`).not.toMatch(
      /wecom|real[_-]?send|his[_/-].*write|integrations\//iu,
    );
  });
});
