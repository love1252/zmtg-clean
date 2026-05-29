export type FollowUpJourneySummary = {
  id: string;
  name: string;
  stageCount: number;
  activeCustomers: number;
  conversionHint: string;
};

export type FollowUpTask = {
  id: string;
  customerName: string;
  stage: string;
  dueLabel: string;
  suggestedAction: string;
  riskLevel: '普通' | '关注' | '优先';
};

export type FollowUpMessageSuggestion = {
  title: string;
  content: string;
};

export const followUpJourneys: FollowUpJourneySummary[] = [
  { id: 'journey_post_care', name: '术后 D0-D30 关怀', stageCount: 6, activeCustomers: 126, conversionHint: '异常反馈优先转人工' },
  { id: 'journey_repurchase', name: '复购窗口召回', stageCount: 4, activeCustomers: 42, conversionHint: '补水修复类项目响应更高' },
  { id: 'journey_silent', name: '沉默客户唤醒', stageCount: 3, activeCustomers: 73, conversionHint: '轻量内容优先，避免过度打扰' },
];

export const followUpTasks: FollowUpTask[] = [
  { id: 'task_wang_d28', customerName: '王女士', stage: 'D28 复购建议', dueLabel: '今天 18:00 前', suggestedAction: '人工回访并推荐修复组合', riskLevel: '优先' },
  { id: 'task_zhao_d3', customerName: '赵女士', stage: 'D3 异常反馈', dueLabel: '30 分钟内', suggestedAction: '客服回访并记录恢复情况', riskLevel: '优先' },
  { id: 'task_li_silent', customerName: '李女士', stage: '48h 沉默唤醒', dueLabel: '今天', suggestedAction: '发送轻量唤醒话术', riskLevel: '普通' },
  { id: 'task_han_new', customerName: '韩女士', stage: '首次到院前提醒', dueLabel: '明早 09:30', suggestedAction: '发送到院路线与注意事项', riskLevel: '关注' },
];

export const followUpMessageSuggestions: FollowUpMessageSuggestion[] = [
  {
    title: '术后关怀提醒',
    content: '这是 demo 话术：请根据客户真实恢复情况由专业人员确认后再发送。',
  },
  {
    title: '复购窗口提醒',
    content: '这是 demo 话术：可邀请客户预约复查，不承诺具体医疗效果。',
  },
  {
    title: '沉默客户唤醒',
    content: '这是 demo 话术：保持低频、轻量、可退出的沟通方式。',
  },
];
