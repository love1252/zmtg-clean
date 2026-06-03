import type { AppointmentRecordSummary } from '@/modules/institution/domain/appointment-records';
import type { CustomerRecordSummary } from '@/modules/institution/domain/customer-records';
import type { TenantFollowUpTask } from '@/modules/institution/domain/followup-workflow';
import {
  appointmentStatusLabels,
  formatBusinessDateTime,
  sortFollowUpTasksForWorkQueue,
} from '@/modules/institution/domain/tenant-business-view-models';

export type InstitutionDashboardMetricKey =
  | 'customer_total'
  | 'high_priority_customers'
  | 'pending_appointments'
  | 'due_followups';

export type InstitutionDashboardSupportingStatKey =
  | 'repurchase_window'
  | 'post_care'
  | 'reschedule_appointments'
  | 'urgent_followups';

export type InstitutionDashboardMetricTone = 'blue' | 'violet' | 'emerald' | 'amber';

export type InstitutionDashboardMetric = {
  key: InstitutionDashboardMetricKey;
  label: string;
  value: string;
  helper: string;
  tone: InstitutionDashboardMetricTone;
};

export type InstitutionDashboardSupportingStat = {
  key: InstitutionDashboardSupportingStatKey;
  label: string;
  value: string;
  helper: string;
};

export type InstitutionDashboardActionSource = 'followup' | 'appointment' | 'customer';

export type InstitutionDashboardActionItem = {
  id: string;
  source: InstitutionDashboardActionSource;
  badge: string;
  title: string;
  detail: string;
};

export type InstitutionDashboardJourneyLane = {
  key: 'consulting' | 'scheduled' | 'post_care' | 'repurchase_window';
  title: string;
  count: number;
  detail: string;
};

export type InstitutionDashboardSummary = {
  metrics: InstitutionDashboardMetric[];
  supportingStats: InstitutionDashboardSupportingStat[];
  actionItems: InstitutionDashboardActionItem[];
  journeyLanes: InstitutionDashboardJourneyLane[];
  isEmpty: boolean;
};

export type InstitutionDashboardSummaryInput = {
  customers: readonly CustomerRecordSummary[];
  appointments: readonly AppointmentRecordSummary[];
  followUpTasks: readonly TenantFollowUpTask[];
};

function formatCount(count: number) {
  return count.toLocaleString('en-US');
}

function countCustomers(
  customers: readonly CustomerRecordSummary[],
  predicate: (customer: CustomerRecordSummary) => boolean,
) {
  return customers.filter(predicate).length;
}

function countAppointments(
  appointments: readonly AppointmentRecordSummary[],
  predicate: (appointment: AppointmentRecordSummary) => boolean,
) {
  return appointments.filter(predicate).length;
}

function countFollowUps(
  followUpTasks: readonly TenantFollowUpTask[],
  predicate: (task: TenantFollowUpTask) => boolean,
) {
  return followUpTasks.filter(predicate).length;
}

function buildActionItems(input: InstitutionDashboardSummaryInput) {
  const followUpActions = sortFollowUpTasksForWorkQueue(
    input.followUpTasks.filter(
      (task) =>
        task.status === 'due' ||
        task.status === 'in_progress' ||
        task.status === 'escalated' ||
        task.riskLevel === 'urgent',
    ),
  )
    .slice(0, 2)
    .map((task): InstitutionDashboardActionItem => ({
      id: `followup:${task.id}`,
      source: 'followup',
      badge: '随访',
      title: `${task.customerDisplayName}：${task.stage}`,
      detail: `${task.suggestedAction} · 到期 ${formatBusinessDateTime(task.dueAt)}`,
    }));

  const appointmentActions = [...input.appointments]
    .filter(
      (appointment) =>
        appointment.status === 'pending_confirmation' ||
        appointment.status === 'reschedule_requested',
    )
    .sort(
      (left, right) =>
        new Date(left.scheduledAt).getTime() - new Date(right.scheduledAt).getTime(),
    )
    .slice(0, 2)
    .map((appointment): InstitutionDashboardActionItem => ({
      id: `appointment:${appointment.id}`,
      source: 'appointment',
      badge: '预约',
      title: `${appointment.customerDisplayName}：${appointment.project}`,
      detail: `${appointmentStatusLabels[appointment.status]} · ${formatBusinessDateTime(
        appointment.scheduledAt,
      )} · ${appointment.note}`,
    }));

  const customerActions = input.customers
    .filter((customer) => customer.priority === 'high')
    .slice(0, 2)
    .map((customer): InstitutionDashboardActionItem => ({
      id: `customer:${customer.id}`,
      source: 'customer',
      badge: '客户',
      title: `${customer.displayName}：${customer.projectInterest}`,
      detail: customer.nextAction,
    }));

  return [...followUpActions, ...appointmentActions, ...customerActions].slice(0, 5);
}

function buildJourneyLanes(customers: readonly CustomerRecordSummary[]) {
  const lanes: InstitutionDashboardJourneyLane[] = [
    {
      key: 'consulting',
      title: '咨询转化',
      count: countCustomers(customers, (customer) => customer.lifecycle === 'consulting'),
      detail: '客户仍在方案沟通阶段',
    },
    {
      key: 'scheduled',
      title: '预约到院',
      count: countCustomers(customers, (customer) => customer.lifecycle === 'scheduled'),
      detail: '预约作为客户旅程节点沉淀',
    },
    {
      key: 'post_care',
      title: '术后关怀',
      count: countCustomers(customers, (customer) => customer.lifecycle === 'post_care'),
      detail: '治疗后服务重点客户',
    },
    {
      key: 'repurchase_window',
      title: '复购窗口',
      count: countCustomers(
        customers,
        (customer) => customer.lifecycle === 'repurchase_window',
      ),
      detail: '需人工判断复诊和复购机会',
    },
  ];

  return lanes;
}

export function buildInstitutionDashboardSummary(
  input: InstitutionDashboardSummaryInput,
): InstitutionDashboardSummary {
  const highPriorityCustomers = countCustomers(
    input.customers,
    (customer) => customer.priority === 'high',
  );
  const pendingAppointments = countAppointments(
    input.appointments,
    (appointment) => appointment.status === 'pending_confirmation',
  );
  const dueFollowUps = countFollowUps(
    input.followUpTasks,
    (task) => task.status === 'due',
  );

  return {
    metrics: [
      {
        key: 'customer_total',
        label: '当前演示客户',
        value: formatCount(input.customers.length),
        helper: '受控 demo 数据',
        tone: 'blue',
      },
      {
        key: 'high_priority_customers',
        label: '高优先级客户',
        value: formatCount(highPriorityCustomers),
        helper: '待人工承接',
        tone: 'violet',
      },
      {
        key: 'pending_appointments',
        label: '待确认预约',
        value: formatCount(pendingAppointments),
        helper: '客户旅程节点',
        tone: 'emerald',
      },
      {
        key: 'due_followups',
        label: '待处理随访',
        value: formatCount(dueFollowUps),
        helper: '今日运营重点',
        tone: 'amber',
      },
    ],
    supportingStats: [
      {
        key: 'repurchase_window',
        label: '复购窗口期',
        value: formatCount(
          countCustomers(
            input.customers,
            (customer) => customer.lifecycle === 'repurchase_window',
          ),
        ),
        helper: '客户旅程分层',
      },
      {
        key: 'post_care',
        label: '术后关怀中',
        value: formatCount(
          countCustomers(input.customers, (customer) => customer.lifecycle === 'post_care'),
        ),
        helper: '治疗后服务',
      },
      {
        key: 'reschedule_appointments',
        label: '改约跟进',
        value: formatCount(
          countAppointments(
            input.appointments,
            (appointment) => appointment.status === 'reschedule_requested',
          ),
        ),
        helper: '需人工协调',
      },
      {
        key: 'urgent_followups',
        label: '重点随访',
        value: formatCount(
          countFollowUps(input.followUpTasks, (task) => task.riskLevel === 'urgent'),
        ),
        helper: '优先处理',
      },
    ],
    actionItems: buildActionItems(input),
    journeyLanes: buildJourneyLanes(input.customers),
    isEmpty:
      input.customers.length === 0 &&
      input.appointments.length === 0 &&
      input.followUpTasks.length === 0,
  };
}
