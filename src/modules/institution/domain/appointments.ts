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

export const appointmentPipelineGroups: AppointmentPipelineGroup[] = [
  {
    status: '待确认',
    count: 12,
    items: [
      { id: 'appt_pending_1', customerName: '刘女士', project: '水光补水', time: '明日 10:30', consultant: '许咨询', note: '待同步术前注意事项' },
      { id: 'appt_pending_2', customerName: '韩女士', project: '皮肤检测', time: '明日 14:00', consultant: '林咨询', note: '新客首次到院' },
    ],
  },
  {
    status: '已确认',
    count: 21,
    items: [
      { id: 'appt_confirmed_1', customerName: '周女士', project: '面部抗衰方案', time: '今日 15:30', consultant: '周咨询', note: '专家档期已锁定' },
    ],
  },
  {
    status: '已到院',
    count: 8,
    items: [
      { id: 'appt_arrived_1', customerName: '秦女士', project: '玻尿酸复诊', time: '今日 11:20', consultant: '前台 A 组', note: '等待治疗记录回填' },
    ],
  },
  {
    status: '改约跟进',
    count: 5,
    items: [
      { id: 'appt_reschedule_1', customerName: '唐女士', project: '热玛吉面诊', time: '原定今日 16:00', consultant: '林咨询', note: '需协调专家下周档期' },
    ],
  },
];

export const appointmentAlerts: AppointmentAlert[] = [
  {
    title: '3 位客户存在爽约风险',
    description: '超过 24 小时未确认到院，建议咨询师优先电话确认。',
    tone: 'amber',
  },
  {
    title: '1 个专家档期冲突',
    description: '热玛吉面诊与复诊时间重叠，建议先处理高价值复购客户。',
    tone: 'rose',
  },
  {
    title: '今日到院转化可追踪',
    description: '已到院客户等待治疗记录回填，后续可触发术后关怀旅程。',
    tone: 'blue',
  },
];
