import type { FollowUpRiskLevel } from '@/modules/institution/domain/followup-workflow';

export type TreatmentFollowUpSuggestionPriority = 'low' | 'medium' | 'high';

export type TreatmentFollowUpSuggestionRuleKey =
  | 'urgent_risk_followup'
  | 'watch_risk_followup'
  | 'early_recovery_care_check'
  | 'next_care_action_followup'
  | 'category_laser_repair_care'
  | 'category_skin_repair_care'
  | 'category_injection_review_care'
  | 'category_skin_check_care'
  | 'lightweight_post_care_check';

export type TreatmentFollowUpSuggestionSourceField =
  | 'riskLevel'
  | 'recoveryStage'
  | 'treatmentStage'
  | 'nextCareAction'
  | 'treatmentCategory'
  | 'treatmentProject'
  | 'treatmentDate'
  | 'tags';

export type TreatmentFollowUpSuggestionInput = {
  id: string;
  customerId: string;
  appointmentId: string | null;
  treatmentDate: string;
  treatmentProject: string;
  treatmentCategory: string;
  treatmentStage: string;
  recoveryStage: string;
  riskLevel: FollowUpRiskLevel;
  nextCareAction: string;
  tags: string[];
};

export type TreatmentFollowUpSuggestion = {
  suggestionKey: string;
  ruleKey: TreatmentFollowUpSuggestionRuleKey;
  title: string;
  description: string;
  recommendedDueAt: string;
  priority: TreatmentFollowUpSuggestionPriority;
  riskLevel: FollowUpRiskLevel;
  sourceTreatmentSummaryId: string;
  sourceCustomerId: string;
  sourceAppointmentId: string | null;
  tags: string[];
  reason: string;
  sourceFields: TreatmentFollowUpSuggestionSourceField[];
};

type SuggestionDraft = {
  ruleKey: TreatmentFollowUpSuggestionRuleKey;
  title: string;
  description: string;
  offsetDays: number;
  priority: TreatmentFollowUpSuggestionPriority;
  reason: string;
  tags: string[];
  sourceFields: TreatmentFollowUpSuggestionSourceField[];
  keySuffix?: string;
};

const millisecondsPerDay = 24 * 60 * 60 * 1000;
const fallbackTimestamp = Date.parse('1970-01-01T00:00:00.000Z');

const categoryRules = {
  laser_repair: {
    ruleKey: 'category_laser_repair_care',
    title: '光电治疗护理提醒',
    description: '请人工确认光电治疗后的修复护理、泛红反馈和防晒执行情况。',
    tags: ['光电护理'],
  },
  skin_repair: {
    ruleKey: 'category_skin_repair_care',
    title: '修复类治疗护理提醒',
    description: '请人工确认修复类治疗后的屏障状态、补水护理和异常反馈。',
    tags: ['修复护理'],
  },
  injection_review: {
    ruleKey: 'category_injection_review_care',
    title: '注射类治疗复诊提醒',
    description: '请人工确认注射类治疗后的恢复反馈、复诊安排和护理执行情况。',
    tags: ['注射复诊'],
  },
  skin_check: {
    ruleKey: 'category_skin_check_care',
    title: '皮肤检测结果跟进',
    description: '请人工跟进皮肤检测后的护理建议理解和后续安排。',
    tags: ['皮肤检测'],
  },
} as const satisfies Record<
  string,
  {
    ruleKey: TreatmentFollowUpSuggestionRuleKey;
    title: string;
    description: string;
    tags: string[];
  }
>;

type CategoryRuleKey = keyof typeof categoryRules;

const idLikePattern = /^[A-Za-z0-9_:-]{1,96}$/u;

function normalizeDigits(input: string) {
  return input
    .normalize('NFKC')
    .replace(/[٠-٩]/gu, (char) => String(char.charCodeAt(0) - 0x660))
    .replace(/[۰-۹]/gu, (char) => String(char.charCodeAt(0) - 0x6f0));
}

function containsRawIdentifier(input: string) {
  const normalized = normalizeDigits(input);
  const compactDigits = normalized.replace(/\D/gu, '');

  return (
    compactDigits.length >= 11 ||
    /(?:身份证号?|身分證號?|id\s*number|idNumber)[\s\S]{0,40}\d/iu.test(normalized) ||
    /(?:病历号|病歷號|medical\s*record|rawMedicalRecordNo|MR[-_\s]*RAW)[\s\S]{0,40}\d/iu.test(
      normalized,
    )
  );
}

export function containsDisallowedTreatmentFollowUpSuggestionContent(input: string) {
  const normalized = normalizeDigits(input);

  return (
    containsRawIdentifier(normalized) ||
    /完整治疗记录正文|完整病历正文|诊疗原文|咨询对话全文/u.test(normalized) ||
    /full\s*treatment\s*record|medical\s*record\s*text|diagnosis\s*text|consultation\s*transcript/iu.test(
      normalized,
    ) ||
    /imageUrl|fileUrl|图片原文|文件原文|image\s*url|file\s*url/iu.test(normalized) ||
    /aiGeneratedContent|AI\s*生成|ai\s*generated/iu.test(normalized) ||
    /externalSystemPayload|外部系统同步原文|external\s*system/iu.test(normalized) ||
    /DATABASE_URL|database_url|postgres:\/\/|mysql:\/\/|mongodb:\/\/|redis:\/\//iu.test(
      normalized,
    ) ||
    /\b(?:sql|stack|token|secret)\b/iu.test(normalized) ||
    /sk_(?:live|test|proj)_|zmtg_sk_/iu.test(normalized)
  );
}

function safeText(input: string, fallback: string, maxLength = 160) {
  const normalized = input.trim();
  if (
    normalized.length === 0 ||
    normalized.length > maxLength ||
    containsDisallowedTreatmentFollowUpSuggestionContent(normalized)
  ) {
    return fallback;
  }

  return normalized;
}

function safeId(input: string) {
  const normalized = input.trim();
  if (!idLikePattern.test(normalized) || containsDisallowedTreatmentFollowUpSuggestionContent(normalized)) {
    return 'unknown';
  }

  return normalized;
}

function normalizeKeyPart(input: string) {
  if (containsDisallowedTreatmentFollowUpSuggestionContent(input)) {
    return '';
  }

  return input
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/gu, '_')
    .replace(/^_+|_+$/gu, '')
    .slice(0, 48);
}

function isCategoryRuleKey(input: string): input is CategoryRuleKey {
  return Object.prototype.hasOwnProperty.call(categoryRules, input);
}

function normalizeCategoryKey(input: string): CategoryRuleKey | null {
  const normalized = normalizeKeyPart(input);
  return isCategoryRuleKey(normalized) ? normalized : null;
}

function recommendedDueAt(treatmentDate: string, offsetDays: number) {
  const parsed = Date.parse(treatmentDate);
  const baseTimestamp = Number.isFinite(parsed) ? parsed : fallbackTimestamp;

  return new Date(baseTimestamp + offsetDays * millisecondsPerDay).toISOString();
}

function isEarlyRecovery(input: TreatmentFollowUpSuggestionInput) {
  const recoveryStage = safeText(input.recoveryStage, '', 80).toLowerCase();
  const treatmentStage = safeText(input.treatmentStage, '', 80).toLowerCase();
  const combined = `${recoveryStage} ${treatmentStage}`;

  return /(?:^|\b)d[0-3](?:\b|$)|24h|48h|72h|早期|初期|术后观察|術後觀察/iu.test(combined);
}

function safeTags(inputTags: string[], ruleTags: string[]) {
  const tags = [...inputTags, ...ruleTags]
    .map((tag) => safeText(tag, '', 40))
    .filter((tag) => tag.length > 0);

  return [...new Set(tags)].slice(0, 12);
}

function createSuggestion(input: TreatmentFollowUpSuggestionInput, draft: SuggestionDraft) {
  const sourceTreatmentSummaryId = safeId(input.id);
  const offsetPart = `${draft.offsetDays}d`;
  const keyParts = [sourceTreatmentSummaryId, draft.ruleKey, offsetPart];
  if (draft.keySuffix) {
    keyParts.push(draft.keySuffix);
  }

  return {
    suggestionKey: keyParts.join(':'),
    ruleKey: draft.ruleKey,
    title: draft.title,
    description: draft.description,
    recommendedDueAt: recommendedDueAt(input.treatmentDate, draft.offsetDays),
    priority: draft.priority,
    riskLevel: input.riskLevel,
    sourceTreatmentSummaryId,
    sourceCustomerId: safeId(input.customerId),
    sourceAppointmentId: input.appointmentId ? safeId(input.appointmentId) : null,
    tags: safeTags(input.tags, draft.tags),
    reason: draft.reason,
    sourceFields: draft.sourceFields,
  } satisfies TreatmentFollowUpSuggestion;
}

function createRiskSuggestion(input: TreatmentFollowUpSuggestionInput): SuggestionDraft | null {
  if (input.riskLevel === 'urgent') {
    return {
      ruleKey: 'urgent_risk_followup',
      title: '高风险治疗后随访',
      description: '请优先安排人工随访，确认风险反馈和护理执行情况。',
      offsetDays: 1,
      priority: 'high',
      reason: 'riskLevel 为 urgent，需要更短周期人工跟进',
      tags: ['高风险', '护理随访'],
      sourceFields: ['riskLevel', 'treatmentDate'],
    };
  }

  if (input.riskLevel === 'watch') {
    return {
      ruleKey: 'watch_risk_followup',
      title: '关注风险治疗后随访',
      description: '请安排人工随访，确认恢复反馈和护理执行情况。',
      offsetDays: 3,
      priority: 'medium',
      reason: 'riskLevel 为 watch，需要在观察周期内人工跟进',
      tags: ['观察风险', '护理随访'],
      sourceFields: ['riskLevel', 'treatmentDate'],
    };
  }

  return null;
}

function createEarlyRecoverySuggestion(input: TreatmentFollowUpSuggestionInput): SuggestionDraft | null {
  if (!isEarlyRecovery(input)) {
    return null;
  }

  return {
    ruleKey: 'early_recovery_care_check',
    title: '恢复早期护理确认',
    description: '请人工确认恢复早期护理执行情况。',
    offsetDays: 2,
    priority: input.riskLevel === 'urgent' ? 'high' : 'medium',
    reason: 'recoveryStage 表示仍处于恢复早期，需要人工确认护理执行情况',
    tags: ['恢复早期', '护理确认'],
    sourceFields: ['recoveryStage', 'treatmentStage', 'treatmentDate'],
  };
}

function createNextCareActionSuggestion(
  input: TreatmentFollowUpSuggestionInput,
): SuggestionDraft | null {
  const action = safeText(input.nextCareAction, '', 200);
  if (!action) {
    return null;
  }

  return {
    ruleKey: 'next_care_action_followup',
    title: '下一步护理动作确认',
    description: action,
    offsetDays: input.riskLevel === 'urgent' ? 1 : input.riskLevel === 'watch' ? 3 : 7,
    priority: input.riskLevel === 'urgent' ? 'high' : input.riskLevel === 'watch' ? 'medium' : 'low',
    reason: 'nextCareAction 已提供结构化下一步护理动作，可转为内部随访任务建议',
    tags: ['下一步护理'],
    sourceFields: ['nextCareAction', 'treatmentDate'],
  };
}

function createCategorySuggestion(input: TreatmentFollowUpSuggestionInput): SuggestionDraft | null {
  const categoryKey = normalizeCategoryKey(input.treatmentCategory);
  if (!categoryKey) {
    return null;
  }

  const categoryRule = categoryRules[categoryKey];

  return {
    ruleKey: categoryRule.ruleKey,
    title: categoryRule.title,
    description: categoryRule.description,
    offsetDays: input.riskLevel === 'urgent' ? 1 : 3,
    priority: input.riskLevel === 'urgent' ? 'high' : 'medium',
    reason: 'treatmentCategory 命中护理提醒白名单规则',
    tags: categoryRule.tags,
    sourceFields: ['treatmentCategory', 'treatmentDate'],
    keySuffix: categoryKey,
  };
}

function createLightweightSuggestion(input: TreatmentFollowUpSuggestionInput): SuggestionDraft {
  return {
    ruleKey: 'lightweight_post_care_check',
    title: '治疗后轻量随访提醒',
    description: '请人工确认治疗后护理情况。',
    offsetDays: input.riskLevel === 'urgent' ? 1 : input.riskLevel === 'watch' ? 3 : 7,
    priority: input.riskLevel === 'urgent' ? 'high' : input.riskLevel === 'watch' ? 'medium' : 'low',
    reason: '结构化字段不足，生成稳定轻量护理提醒',
    tags: ['轻量随访'],
    sourceFields: ['riskLevel', 'treatmentDate'],
  };
}

export function buildTreatmentFollowUpSuggestions(
  input: TreatmentFollowUpSuggestionInput,
): TreatmentFollowUpSuggestion[] {
  const drafts = [
    createRiskSuggestion(input),
    createEarlyRecoverySuggestion(input),
    createNextCareActionSuggestion(input),
    createCategorySuggestion(input),
  ].filter((draft): draft is SuggestionDraft => draft !== null);

  if (drafts.length === 0) {
    drafts.push(createLightweightSuggestion(input));
  }

  const suggestions = drafts.map((draft) => createSuggestion(input, draft));
  const seen = new Set<string>();

  return suggestions.filter((suggestion) => {
    if (seen.has(suggestion.suggestionKey)) {
      return false;
    }

    seen.add(suggestion.suggestionKey);
    return true;
  });
}
