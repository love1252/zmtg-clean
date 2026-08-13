import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const verifiedCallers = [
  'src/modules/institution/server/followup-message-draft-service.ts',
  'src/modules/institution/server/trusted-reachout-safety-service.ts',
  'src/modules/institution/server/wecom-customer-mapping-service.ts',
  'src/modules/institution/server/wecom-dry-run-snapshot-service.ts',
  'src/modules/institution/server/wecom-real-send-proof-service.ts',
] as const;

const notApplicableCallers = [
  'src/app/api/auth/login/route.ts',
  'src/app/api/v1/open-platform/ai-model-config/route.ts',
  'src/app/api/v1/open-platform/ai-model-config/sync/route.ts',
  'src/app/api/v1/open-platform/ai-model-config/test/route.ts',
  'src/modules/institution/server/his-connection-credential-service.ts',
  'src/modules/institution/server/his-connection-status-service.ts',
  'src/modules/institution/server/his-connection-test-connection-service.ts',
  'src/modules/institution/server/his-connection-write-service.ts',
  'src/modules/open-platform/server/platform-knowledge-management-service.ts',
  'src/modules/open-platform/server/tenant-account-management-service.ts',
  'src/modules/open-platform/server/tenant-plan-binding-service.ts',
  'src/modules/open-platform/server/tenant-plan-change-service.ts',
] as const;

const attemptedDenialCallers = [
  'src/modules/institution/server/followup-message-draft-api.ts',
  'src/modules/institution/server/tenant-business-api.ts',
] as const;

const canonicalCallers = [
  ...verifiedCallers,
  ...notApplicableCallers,
  ...attemptedDenialCallers,
] as const;

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

describe('S10 Audit Writer caller migration residual guard', () => {
  it('freezes exactly 19 classified production callers with no legacy persistence', () => {
    expect(canonicalCallers).toHaveLength(19);
    expect(new Set(canonicalCallers).size).toBe(19);

    for (const path of canonicalCallers) {
      const callerSource = source(path);
      expect(callerSource, path).not.toMatch(/\.record\s*\(/u);
      expect(callerSource, path).not.toContain('mapAuditEventToInsert(');
      expect(callerSource, path).toMatch(
        /create(?:VerifiedInstitution|Institution)?AttributedTenantAuditEventV1\s*\(/u,
      );
    }
  });

  it('keeps verified, not-applicable and attempted-denial classifications exact', () => {
    for (const path of verifiedCallers) {
      expect(source(path), path).toContain(
        'createVerifiedInstitutionAttributedTenantAuditEventV1(',
      );
    }

    for (const path of notApplicableCallers) {
      const callerSource = source(path);
      expect(callerSource, path).toContain('createAttributedTenantAuditEventV1(');
      expect(callerSource, path).toContain("institutionAttribution: 'not_applicable'");
    }

    for (const path of attemptedDenialCallers) {
      expect(source(path), path).toContain(
        'createInstitutionAttributedTenantAuditEventV1(',
      );
    }
  });

  it('keeps transaction repositories on attributed mappers or canonical repository methods', () => {
    const transactionFiles = [
      'src/modules/institution/server/his-connection-credential-service.ts',
      'src/modules/institution/server/his-connection-status-service.ts',
      'src/modules/institution/server/his-connection-write-service.ts',
      'src/modules/institution/server/tenant-business-audit-transaction.ts',
      'src/modules/institution/server/wecom-customer-mapping-transaction.ts',
      'src/modules/institution/server/wecom-real-send-proof-repository.ts',
      'src/modules/open-platform/server/tenant-account-management-repository.ts',
      'src/modules/open-platform/server/tenant-plan-binding-repository.ts',
      'src/modules/open-platform/server/tenant-plan-change-repository.ts',
      'src/server/orchestration/care-follow-up-transaction.ts',
      'src/server/orchestration/wecom-reachout-transaction.ts',
    ] as const;

    for (const path of transactionFiles) {
      expect(source(path), path).not.toContain('mapAuditEventToInsert(');
    }
  });
});
