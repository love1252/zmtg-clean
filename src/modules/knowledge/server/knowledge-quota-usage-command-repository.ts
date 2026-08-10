import { randomUUID } from 'node:crypto';

import type {
  KnowledgeQuotaUsageCommandRepository,
  NormalizedKnowledgeQuotaUsageAppend,
} from '@/modules/knowledge/application/quota/knowledge-quota-usage-command-service';
import type { TenantDatabase } from '@/server/db/client';
import { knowledgeQuotaUsageRecords } from '@/server/db/schema';

function quotaUsageRecordId() {
  return `kb-quota-usage-${randomUUID()}`;
}

export function createKnowledgeQuotaUsageCommandRepository(
  database: TenantDatabase,
): KnowledgeQuotaUsageCommandRepository {
  return Object.freeze({
    async append(input: NormalizedKnowledgeQuotaUsageAppend) {
      await database.insert(knowledgeQuotaUsageRecords).values({
        id: quotaUsageRecordId(),
        tenantId: input.scope.tenantId,
        institutionId:
          input.scope.kind === 'institution'
            ? input.scope.institutionId
            : null,
        actorUserId: input.actorUserId,
        resourceKey: input.resourceKey,
        action: input.action,
        status: input.status,
        quantity: input.quantity,
        safeReasonCode: input.safeReasonCode,
        createdAt: new Date(),
      });
    },
  });
}
