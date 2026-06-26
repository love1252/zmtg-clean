import { inArray, sql } from 'drizzle-orm';
import type { TenantAuditEvent } from '@/modules/audit/domain/audit-events';
import { mapAuditEventToInsert } from '@/modules/audit/server/audit-event-repository';
import type { TenantDatabase } from '@/server/db/client';
import {
  appointments,
  auditEvents,
  authUsers,
  customers,
  followUpTasks,
  tenantAuthorizationSnapshots,
  tenantCommercialRecords,
  tenantContacts,
  tenantMembers,
  tenantPlanAssignments,
  tenantPlanChangeRecords,
  tenantQuotaSnapshots,
  tenants,
  treatmentSummaries,
} from '@/server/db/schema';

export type TrialDataOverview = {
  /** 当前非平台机构总数 */
  tenantCount: number;
  /** 客户总数 */
  customerCount: number;
  /** 预约总数 */
  appointmentCount: number;
  /** 治疗摘要总数 */
  treatmentSummaryCount: number;
  /** 随访任务总数 */
  followUpTaskCount: number;
  /** 商业记录总数 */
  commercialRecordCount: number;
  /** 关联机构的审计事件总数 */
  auditEventCount: number;
};

export type TrialDataResetInput = {
  /** 审计事件构建所需 */
  auditEvent: TenantAuditEvent;
};

export type TrialDataResetResult =
  | { status: 'reset_completed'; deletedCounts: Record<string, number> }
  | { status: 'no_tenant_data'; note: string };

/**
 * 获取当前体验/演示数据概览，用于页面展示。
 * 统计所有 tenant 相关表的行数，不区分 demo tenant 和手工创建的机构。
 */
export async function getTrialDataOverview(
  database: TenantDatabase,
): Promise<TrialDataOverview> {
  const now = new Date();

  const [
    tenantRows,
    customerRows,
    appointmentRows,
    treatmentSummaryRows,
    followUpTaskRows,
    commercialRecordRows,
    auditEventRows,
  ] = await Promise.all([
    database.select({ count: sql<number>`count(*)::int` }).from(tenants),
    database.select({ count: sql<number>`count(*)::int` }).from(customers),
    database.select({ count: sql<number>`count(*)::int` }).from(appointments),
    database.select({ count: sql<number>`count(*)::int` }).from(treatmentSummaries),
    database.select({ count: sql<number>`count(*)::int` }).from(followUpTasks),
    database.select({ count: sql<number>`count(*)::int` }).from(tenantCommercialRecords),
    database
      .select({ count: sql<number>`count(*)::int` })
      .from(auditEvents)
      .where(sql`${auditEvents.tenantId} is not null`),
  ]);

  void now;

  return {
    tenantCount: tenantRows[0]?.count ?? 0,
    customerCount: customerRows[0]?.count ?? 0,
    appointmentCount: appointmentRows[0]?.count ?? 0,
    treatmentSummaryCount: treatmentSummaryRows[0]?.count ?? 0,
    followUpTaskCount: followUpTaskRows[0]?.count ?? 0,
    commercialRecordCount: commercialRecordRows[0]?.count ?? 0,
    auditEventCount: auditEventRows[0]?.count ?? 0,
  };
}

/**
 * 按外键安全顺序重置体验/演示数据。
 *
 * 清理范围（按序）：
 * 1. 关联租户的审计事件
 * 2. 随访任务
 * 3. 治疗摘要
 * 4. 预约
 * 5. 客户
 * 6. 商业记录
 * 7. 套餐变更记录
 * 8. 授权快照
 * 9. 配额快照
 * 10. 租户成员
 * 11. 套餐分配
 * 12. 租户联系人
 * 13. 租户主体
 * 14. 关联机构账号（非平台管理员）
 *
 * 不清理：
 * - 平台账号 platform（demo-user-platform）
 * - 套餐目录和套餐版本
 * - 平台级 AI / HIS / 知识库 / 首页品牌配置
 * - scope='platform' 的审计事件
 */
export async function resetTrialData(
  database: TenantDatabase,
  input: TrialDataResetInput,
): Promise<TrialDataResetResult> {
  return database.transaction(async (tx) => {
    const db = tx as unknown as TenantDatabase;

    // 获取所有租户 ID
    const tenantRows = await db.select({ id: tenants.id }).from(tenants);
    const allTenantIds = tenantRows.map((r) => r.id);

    if (allTenantIds.length === 0) {
      return { status: 'no_tenant_data' as const, note: '当前无机构数据，无需清理。' };
    }

    // 收集需要删除的 authUser IDs（在删除 tenantMembers/tenantContacts 之前）
    const memberUserRows = await db
      .selectDistinct({ userId: tenantMembers.userId })
      .from(tenantMembers)
      .where(inArray(tenantMembers.tenantId, allTenantIds));
    const memberUserIds = memberUserRows.map((r) => r.userId);

    const contactUserRows = await db
      .selectDistinct({ userId: tenantContacts.initialAdminUserId })
      .from(tenantContacts)
      .where(inArray(tenantContacts.tenantId, allTenantIds));
    const contactUserIds = contactUserRows.map((r) => r.userId);

    // 按外键安全顺序删除（子表在前，父表在后）

    // 1. 审计事件（有 tenantId 的）
    await db
      .delete(auditEvents)
      .where(inArray(auditEvents.tenantId, allTenantIds));

    // 2. 随访任务
    await db
      .delete(followUpTasks)
      .where(inArray(followUpTasks.tenantId, allTenantIds));

    // 3. 治疗摘要
    await db
      .delete(treatmentSummaries)
      .where(inArray(treatmentSummaries.tenantId, allTenantIds));

    // 4. 预约
    await db
      .delete(appointments)
      .where(inArray(appointments.tenantId, allTenantIds));

    // 5. 客户
    await db
      .delete(customers)
      .where(inArray(customers.tenantId, allTenantIds));

    // 6. 商业记录
    await db
      .delete(tenantCommercialRecords)
      .where(inArray(tenantCommercialRecords.tenantId, allTenantIds));

    // 7. 套餐变更记录
    await db
      .delete(tenantPlanChangeRecords)
      .where(inArray(tenantPlanChangeRecords.tenantId, allTenantIds));

    // 8. 授权快照（先于 tenantPlanAssignments）
    await db
      .delete(tenantAuthorizationSnapshots)
      .where(inArray(tenantAuthorizationSnapshots.tenantId, allTenantIds));

    // 9. 配额快照
    await db
      .delete(tenantQuotaSnapshots)
      .where(inArray(tenantQuotaSnapshots.tenantId, allTenantIds));

    // 10. 删除租户成员
    await db
      .delete(tenantMembers)
      .where(inArray(tenantMembers.tenantId, allTenantIds));

    // 11. 删除套餐分配
    await db
      .delete(tenantPlanAssignments)
      .where(inArray(tenantPlanAssignments.tenantId, allTenantIds));

    // 12. 删除租户联系人
    await db
      .delete(tenantContacts)
      .where(inArray(tenantContacts.tenantId, allTenantIds));

    // 13. 删除租户主体
    await db
      .delete(tenants)
      .where(inArray(tenants.id, allTenantIds));

    // 14. 删除关联机构账号（非平台管理员 platform）
    const userIdsToDelete = [...new Set([...memberUserIds, ...contactUserIds])].filter(
      (uid) => uid !== 'demo-user-platform',
    );
    if (userIdsToDelete.length > 0) {
      await db
        .delete(authUsers)
        .where(inArray(authUsers.id, userIdsToDelete));
    }

    // 写入审计日志
    await tx.insert(auditEvents).values(mapAuditEventToInsert(input.auditEvent));

    // 重新统计清理后状态
    const afterCounts = await getTrialDataOverview(db);
    return {
      status: 'reset_completed' as const,
      deletedCounts: {
        tenants: allTenantIds.length,
        authUsers: userIdsToDelete.length,
        ...afterCounts,
      },
    };
  });
}
