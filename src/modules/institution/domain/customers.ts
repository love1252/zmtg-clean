export type CustomerPriority = '高优先级' | '中优先级' | '观察';

export type CustomerSummary = {
  id: string;
  name: string;
  lifecycle: string;
  priority: CustomerPriority;
  owner: string;
  projectInterest: string;
  lastTouch: string;
  nextAction: string;
  tags: string[];
};

export type CustomerSegment = {
  label: string;
  value: string;
  trend: string;
  tone: 'blue' | 'emerald' | 'amber' | 'rose';
};

export type CustomerInsightItem = {
  title: string;
  description: string;
};

export const customerSegments: CustomerSegment[] = [
  { label: '高意向待承接', value: '18', trend: '人工优先承接', tone: 'blue' },
  { label: '术后关怀中', value: '126', trend: '7 位需人工', tone: 'emerald' },
  { label: '复购窗口期', value: '42', trend: '本周 +9', tone: 'amber' },
  { label: '沉默待激活', value: '73', trend: '话术已生成', tone: 'rose' },
];

export const demoCustomers: CustomerSummary[] = [
  {
    id: 'cust_wang_repurchase',
    name: '王女士',
    lifecycle: '复购窗口期',
    priority: '高优先级',
    owner: '林咨询',
    projectInterest: '热玛吉修复组合',
    lastTouch: '术后第 28 天',
    nextAction: '安排资深咨询师人工回访',
    tags: ['高价值', '近期咨询补水', '适合人工承接'],
  },
  {
    id: 'cust_chen_conversion',
    name: '陈女士',
    lifecycle: '咨询转化',
    priority: '高优先级',
    owner: '周咨询',
    projectInterest: '玻尿酸联合方案',
    lastTouch: '浏览案例页 3 次',
    nextAction: '发送案例对比与价格解释',
    tags: ['预算明确', '价格异议', '需跟进'],
  },
  {
    id: 'cust_liu_arrival',
    name: '刘女士',
    lifecycle: '预约到院',
    priority: '中优先级',
    owner: '许咨询',
    projectInterest: '水光补水',
    lastTouch: '明日 10:30 到院',
    nextAction: '同步术前注意事项',
    tags: ['已预约', '待确认', '新客'],
  },
  {
    id: 'cust_zhao_care',
    name: '赵女士',
    lifecycle: '术后关怀',
    priority: '高优先级',
    owner: '客服 A 组',
    projectInterest: '光电修复',
    lastTouch: 'D3 红肿反馈',
    nextAction: '转人工回访并记录恢复情况',
    tags: ['敏感词', '需安抚', '术后 D3'],
  },
  {
    id: 'cust_li_silent',
    name: '李女士',
    lifecycle: '沉默激活',
    priority: '观察',
    owner: 'AI 助手',
    projectInterest: '面部年轻化',
    lastTouch: '48 小时未回复',
    nextAction: '发送轻量唤醒话术',
    tags: ['沉默', '可自动触达', '低风险'],
  },
];

export const customerInsightItems: CustomerInsightItem[] = [
  {
    title: '客户分层来自演示规则',
    description: '当前仅用于演示优先级，不代表真实客户画像或医疗判断。',
  },
  {
    title: '高优先级客户建议人工承接',
    description: '复购窗口、价格异议、术后异常反馈会进入人工待办。',
  },
  {
    title: '禁止在静态数据中加入敏感标识',
    description: '本阶段不展示手机号、身份证、病历号或真实机构客户资料。',
  },
];
