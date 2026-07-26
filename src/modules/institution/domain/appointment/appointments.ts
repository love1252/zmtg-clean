export type AppointmentSummary = {
  id: string;
  customerName: string;
  project: string;
  time: string;
  consultant: string;
  note: string;
};

export type AppointmentPipelineGroup = {
  status: '待确认' | '已确认' | '已到院' | '改约跟进';
  count: number;
  items: AppointmentSummary[];
};

export type AppointmentAlert = {
  title: string;
  description: string;
  tone: 'amber' | 'rose' | 'blue';
};

export const appointmentPipelineGroups: AppointmentPipelineGroup[] = [];

export const appointmentAlerts: AppointmentAlert[] = [];
