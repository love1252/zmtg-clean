import { createAppointmentListReaderV1 } from '@/modules/care/application/appointment-list-reader';
import type { WorkbenchAppointmentResultV1 } from '@/modules/care/application/workbench-appointment-view';
import { createAppointmentListRepository } from '@/modules/care/server/appointment-list-repository';
import type { TenantDatabase } from '@/server/db/client';

/** 日期、状态先在全量范围过滤，三个列表及计数共享只读快照。 */
export async function readWorkbenchAppointmentsV1(database: TenantDatabase, input: Readonly<{
  tenantId: string;
  institutionId: string;
  referenceTime: string;
}>): Promise<WorkbenchAppointmentResultV1> {
  const instant = Date.parse(input.referenceTime);
  if (!Number.isFinite(instant)) return { kind: 'unavailable' };
  const businessDate = new Date(instant + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
  try {
    return await database.transaction(async transaction => {
      const reader = createAppointmentListReaderV1({ source: createAppointmentListRepository(transaction) });
      const read = (query: Record<string, string>) => reader.read({
        tenantId: input.tenantId,
        institutionId: input.institutionId,
        searchParams: new URLSearchParams({ page: '1', pageSize: '10', ...query }),
      });
      const today = await read({ startDate: businessDate, endDate: businessDate });
      const pending = await read({ status: 'pending_confirmation' });
      const rescheduled = await read({ status: 'reschedule_requested' });
      if (today.kind !== 'ready' || pending.kind !== 'ready' || rescheduled.kind !== 'ready') {
        return { kind: 'unavailable' } as const;
      }
      return {
        kind: 'ready', businessDate, timeZone: 'Asia/Shanghai', observedAt: input.referenceTime,
        today: { total: today.pageInfo.total, records: today.records.slice(0, 6) },
        pending: { total: pending.pageInfo.total, records: pending.records.slice(0, 6) },
        rescheduled: { total: rescheduled.pageInfo.total, records: rescheduled.records.slice(0, 6) },
      } as const;
    }, { isolationLevel: 'repeatable read', accessMode: 'read only' });
  } catch {
    return { kind: 'unavailable' };
  }
}
