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

export const followUpJourneys: FollowUpJourneySummary[] = [];

export const followUpTasks: FollowUpTask[] = [];

export const followUpMessageSuggestions: FollowUpMessageSuggestion[] = [];
