import type {
  AppointmentRecordSummary,
  AppointmentStatus,
} from '@/modules/institution/domain/appointment-records';
import type {
  CustomerLifecycleStage,
  CustomerPriority,
  CustomerRecordSummary,
} from '@/modules/institution/domain/customer-records';
import type {
  FollowUpRiskLevel,
  FollowUpStatus,
  TenantFollowUpTask,
} from '@/modules/institution/domain/followup-workflow';

export const customerLifecycleLabels = {
  consulting: '咨询转化',
  scheduled: '预约到院',
  post_care: '术后关怀',
  repurchase_window: '复购窗口期',
  silent_reactivation: '沉默待激活',
} as const satisfies Record<CustomerLifecycleStage, string>;

export const customerPriorityLabels = {
  high: '高优先级',
  medium: '中优先级',
  observe: '观察',
} as const satisfies Record<CustomerPriority, string>;

export const appointmentStatusLabels = {
  pending_confirmation: '待确认',
  confirmed: '已确认',
  arrived: '已到院',
  completed: '已完成',
  reschedule_requested: '改约跟进',
  cancelled: '已取消',
} as const satisfies Record<AppointmentStatus, string>;

export const followUpStatusLabels = {
  scheduled: '已计划',
  due: '待处理',
  in_progress: '处理中',
  escalated: '已升级',
  completed: '已完成',
  cancelled: '已取消',
} as const satisfies Record<FollowUpStatus, string>;

export const followUpRiskLevelLabels = {
  normal: '普通',
  watch: '关注',
  urgent: '优先',
} as const satisfies Record<FollowUpRiskLevel, string>;

export const appointmentStatusOrder = [
  'pending_confirmation',
  'confirmed',
  'arrived',
  'completed',
  'reschedule_requested',
  'cancelled',
] as const satisfies readonly AppointmentStatus[];

export type CustomerSegmentKey =
  | 'high_priority'
  | 'post_care'
  | 'repurchase_window'
  | 'silent_reactivation';

export type CustomerSegmentStat = {
  key: CustomerSegmentKey;
  label: string;
  count: number;
};

export type AppointmentStatusGroup = {
  status: AppointmentStatus;
  label: string;
  count: number;
  records: AppointmentRecordSummary[];
};

const followUpTransitionMap = {
  scheduled: ['due', 'cancelled'],
  due: ['in_progress', 'escalated', 'cancelled'],
  in_progress: ['completed', 'escalated', 'cancelled'],
  escalated: ['in_progress', 'completed', 'cancelled'],
  completed: [],
  cancelled: [],
} as const satisfies Record<FollowUpStatus, readonly FollowUpStatus[]>;

const followUpRiskRank = {
  urgent: 0,
  watch: 1,
  normal: 2,
} as const satisfies Record<FollowUpRiskLevel, number>;

export function buildCustomerSegmentStats(
  records: CustomerRecordSummary[],
): CustomerSegmentStat[] {
  return [
    {
      key: 'high_priority',
      label: '高意向待承接',
      count: records.filter((record) => record.priority === 'high').length,
    },
    {
      key: 'post_care',
      label: '术后关怀中',
      count: records.filter((record) => record.lifecycle === 'post_care').length,
    },
    {
      key: 'repurchase_window',
      label: '复购窗口期',
      count: records.filter((record) => record.lifecycle === 'repurchase_window').length,
    },
    {
      key: 'silent_reactivation',
      label: '沉默待激活',
      count: records.filter((record) => record.lifecycle === 'silent_reactivation').length,
    },
  ];
}

export function groupAppointmentsByStatus(
  records: AppointmentRecordSummary[],
): AppointmentStatusGroup[] {
  return appointmentStatusOrder.map((status) => {
    const statusRecords = records.filter((record) => record.status === status);
    return {
      status,
      label: appointmentStatusLabels[status],
      count: statusRecords.length,
      records: statusRecords,
    };
  });
}

export function getAllowedFollowUpNextStatuses(status: FollowUpStatus): FollowUpStatus[] {
  return [...followUpTransitionMap[status]];
}

function timestampForSort(value: string) {
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time;
}

export function sortFollowUpTasksForWorkQueue(
  tasks: TenantFollowUpTask[],
): TenantFollowUpTask[] {
  return [...tasks].sort((left, right) => {
    const riskDelta =
      followUpRiskRank[left.riskLevel] - followUpRiskRank[right.riskLevel];
    if (riskDelta !== 0) return riskDelta;

    const dueDelta = timestampForSort(left.dueAt) - timestampForSort(right.dueAt);
    if (dueDelta !== 0) return dueDelta;

    return left.id.localeCompare(right.id);
  });
}

export function formatBusinessDateTime(value: string, timeZone = 'Asia/Shanghai') {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );

  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}
