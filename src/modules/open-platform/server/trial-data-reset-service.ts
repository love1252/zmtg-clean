import { sql } from 'drizzle-orm';
import type { TenantAuditEvent } from '@/modules/audit/domain/audit-events';
import type { TenantDatabase } from '@/server/db/client';
import {
  appointments,
  auditEvents,
  customers,
  followUpTasks,
  tenantCommercialRecords,
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

export const trialDataResetDisabledErrorCode = 'TRIAL_DATA_RESET_UNAVAILABLE';

export type TrialDataResetResult = {
  status: 'capability_disabled';
  errorCode: typeof trialDataResetDisabledErrorCode;
};

const trialDataResetDisabledResult = Object.freeze<TrialDataResetResult>({
  status: 'capability_disabled',
  errorCode: trialDataResetDisabledErrorCode,
});

/**
 * 获取当前体验/演示数据概览，用于页面展示。
 * 统计所有 tenant 相关表的行数，不区分 demo tenant 和手工创建的机构。
 */
export async function getTrialDataOverview(
  database: TenantDatabase,
): Promise<TrialDataOverview> {
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
 * 旧体验数据物理重置入口已关闭。
 *
 * Membership 生命周期只能由 Access Control Owner command 管理；该入口不能被机械改写为
 * revoke，也不得访问传入的数据库或审计输入。GET 概览保持独立只读能力。
 */
export async function resetTrialData(
  database: TenantDatabase,
  input: TrialDataResetInput,
): Promise<TrialDataResetResult> {
  void database;
  void input;
  return trialDataResetDisabledResult;
}
