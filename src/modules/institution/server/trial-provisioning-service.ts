import type { TenantDatabase } from '@/server/db/client';

type ProvisionDemoDataInput = {
  db: TenantDatabase;
  tenantId: string;
  institutionId: string;
  userId: string;
};

export async function provisionDemoDataForTenant(
  _input: ProvisionDemoDataInput,
): Promise<{ provisioned: boolean; customerCount: number; followUpCount: number }> {
  throw new Error('legacy_institution_trial_provisioning_disabled');
}
