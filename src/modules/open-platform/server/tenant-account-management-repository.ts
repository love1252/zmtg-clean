import { and, eq } from 'drizzle-orm';

import { mapAuditEventToInsert } from '@/modules/audit/server/audit-event-repository';
import { insertOneCommercialRecord } from '@/modules/open-platform/server/tenant-commercial-records-repository';
import type {
  TenantAccountManagementRecord,
  TenantAccountManagementRepository,
  TenantAccountOperationInput,
} from '@/modules/open-platform/server/tenant-account-management-service';
import type { TenantDatabase } from '@/server/db/client';
import {
  authUsers,
  auditEvents,
  tenantContacts,
  tenantMembers,
} from '@/server/db/schema';

type AccountRow = typeof authUsers.$inferSelect;
type MemberRow = typeof tenantMembers.$inferSelect;
type ContactRow = typeof tenantContacts.$inferSelect;

type InitialAdminQueryRow = {
  account: AccountRow;
  contact: ContactRow;
  member: MemberRow;
};

function mapInitialAdminRow(row: InitialAdminQueryRow): TenantAccountManagementRecord {
  return {
    tenantId: row.contact.tenantId,
    accountId: row.account.id,
    tenantMemberId: row.member.id,
    username: row.account.username,
    displayName: row.member.displayName || row.account.displayName,
    role: 'tenant_admin',
    status: row.account.status,
    passwordResetRequired: row.account.passwordResetRequired,
  };
}

function buildAccountUpdate(input: TenantAccountOperationInput) {
  if (input.passwordHash) {
    return {
      failedLoginCount: 0,
      lockedUntil: input.lockedUntil,
      passwordHash: input.passwordHash,
      passwordResetRequired: input.passwordResetRequired,
      passwordUpdatedAt: input.passwordUpdatedAt,
      status: input.nextStatus,
      updatedAt: input.updatedAt,
      updatedBy: input.updatedBy,
    };
  }

  return {
    lockedUntil: input.lockedUntil,
    status: input.nextStatus,
    updatedAt: input.updatedAt,
    updatedBy: input.updatedBy,
  };
}

export function createTenantAccountManagementRepository(
  database: TenantDatabase,
): TenantAccountManagementRepository {
  return {
    async findInitialAdminAccountByTenantId(tenantId: string) {
      const rows = await database
        .select({
          account: authUsers,
          contact: tenantContacts,
          member: tenantMembers,
        })
        .from(tenantContacts)
        .innerJoin(authUsers, eq(authUsers.id, tenantContacts.initialAdminUserId))
        .innerJoin(
          tenantMembers,
          and(
            eq(tenantMembers.tenantId, tenantContacts.tenantId),
            eq(tenantMembers.userId, authUsers.id),
            eq(tenantMembers.lifecycleStatus, 'active'),
          ),
        )
        .where(eq(tenantContacts.tenantId, tenantId))
        .limit(1);

      const row = rows[0] as InitialAdminQueryRow | undefined;
      return row ? mapInitialAdminRow(row) : null;
    },

    async applyTenantAccountOperation(input) {
      await database.transaction(async (transactionDatabase) => {
        const tx = transactionDatabase as unknown as TenantDatabase;
        await tx
          .update(authUsers)
          .set(buildAccountUpdate(input))
          .where(eq(authUsers.id, input.account.accountId));
        await tx.insert(auditEvents).values(mapAuditEventToInsert(input.auditEvent));
        // 账号状态变更商业记录
        const actionLabel =
          input.action === 'disable' ? '停用' : input.action === 'enable' ? '启用' : '重置密码';
        await insertOneCommercialRecord(tx, {
          id: `${input.account.tenantId}-commercial-account-status-${input.auditEvent.eventId.slice(-12)}`,
          tenantId: input.account.tenantId,
          recordType: 'account_status_change',
          displayCode: `账号${actionLabel}-${input.account.username}`,
          note: `管理员账号“${input.account.displayName}”${actionLabel}`,
          occurredAt: input.updatedAt,
          createdBy: input.updatedBy,
          updatedBy: input.updatedBy,
        });
      });

      return {
        status: 'account_updated' as const,
        action: input.action,
        auditEventId: input.auditEvent.eventId,
        account: {
          ...input.account,
          status: input.nextStatus,
          passwordResetRequired: input.passwordResetRequired,
          updatedAt: input.updatedAt.toISOString(),
        },
      };
    },
  };
}
