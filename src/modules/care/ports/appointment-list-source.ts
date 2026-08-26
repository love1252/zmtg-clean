export const APPOINTMENT_LIST_STATUSES_V1 = Object.freeze([
  'pending_confirmation',
  'confirmed',
  'arrived',
  'completed',
  'reschedule_requested',
  'cancelled',
] as const);

export type AppointmentListStatusV1 =
  (typeof APPOINTMENT_LIST_STATUSES_V1)[number];

export type AppointmentListSourceQueryV1 = Readonly<{
  tenantId: string;
  institutionId: string;
  status: AppointmentListStatusV1 | null;
  keyword: string | null;
  scheduledFrom: string | null;
  scheduledBefore: string | null;
  limit: number;
  offset: number;
}>;

export type AppointmentListSourceSummaryQueryV1 = Readonly<{
  tenantId: string;
  institutionId: string;
  keyword: string | null;
  scheduledFrom: string | null;
  scheduledBefore: string | null;
}>;

export type AppointmentListSourceRowV1 = Readonly<{
  appointmentId: string;
  customerDisplayName: string;
  project: string;
  scheduledAt: string;
  status: AppointmentListStatusV1;
  updatedAt: string;
  tenantId: string;
  institutionId: string;
}>;

export type AppointmentListSourceSummaryRowV1 = Readonly<{
  status: AppointmentListStatusV1;
  total: number;
  tenantId: string;
  institutionId: string;
}>;

export type AppointmentListSourceV1 = Readonly<{
  list: (
    query: AppointmentListSourceQueryV1,
  ) => Promise<readonly AppointmentListSourceRowV1[]>;
  summarize: (
    query: AppointmentListSourceSummaryQueryV1,
  ) => Promise<readonly AppointmentListSourceSummaryRowV1[]>;
}>;
