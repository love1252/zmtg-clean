import { createMembershipCommandExternalTransactionAdapter } from '@/modules/access-control/server/membership-command-external-transaction';
import { createTenantPlanBindingRepository } from '@/modules/open-platform/server/tenant-plan-binding-repository';
import type { TenantPlanBindingRepository } from '@/modules/open-platform/server/tenant-plan-binding-service';
import type { TenantDatabase } from '@/server/db/client';

/**
 * App-level composition root：只在正式租户开通路径注入 Access Control Owner
 * command 适配器；不持有事务、不构造 command，也不暴露品牌类型。
 */
export function createTenantPlanBindingRepositoryForTenantOnboarding(
  database: TenantDatabase,
): TenantPlanBindingRepository {
  return createTenantPlanBindingRepository(database, {
    membershipCommandExternalTransaction:
      createMembershipCommandExternalTransactionAdapter(),
  });
}
