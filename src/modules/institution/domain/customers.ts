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

export const customerSegments: CustomerSegment[] = [];

export const demoCustomers: CustomerSummary[] = [];

export const customerInsightItems: CustomerInsightItem[] = [];
