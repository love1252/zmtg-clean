import type { FollowUpRiskLevel } from './followup-workflow';

export const treatmentPathTemplateKeys = [
  'photoelectric_care',
  'hydro_injection_care',
  'post_surgery_repair',
  'skin_management',
] as const;

export type TreatmentPathTemplateKey = (typeof treatmentPathTemplateKeys)[number];

export type TreatmentPathRecoveryStage =
  | 'D1'
  | 'D3'
  | 'D7'
  | 'D14'
  | 'revisit_before'
  | 'post_check'
  | 'stable';

export type TreatmentPathHandlerRole =
  | 'customer_service'
  | 'medical_assistant'
  | 'nursing_staff'
  | 'consultant'
  | 'operations_lead';

export type TreatmentPathTemplateNode = {
  nodeKey: string;
  offsetDays: number;
  recoveryStage: TreatmentPathRecoveryStage;
  riskLevels: readonly FollowUpRiskLevel[];
  taskTitle: string;
  handlerRole: TreatmentPathHandlerRole;
  requiresHumanConfirmation: true;
  forbidAutoReachOut: true;
  safetyNotes: readonly string[];
};

export type TreatmentPathTemplate = {
  templateKey: TreatmentPathTemplateKey;
  projectType: TreatmentPathTemplateKey;
  categoryKeys: readonly string[];
  recoveryStages: readonly TreatmentPathRecoveryStage[];
  riskLevels: readonly FollowUpRiskLevel[];
  nodes: readonly TreatmentPathTemplateNode[];
  safetyNotes: readonly string[];
};

export type TreatmentPathTemplateMatchInput = {
  treatmentCategory?: string | null;
  treatmentProject?: string | null;
  treatmentStage?: string | null;
  recoveryStage?: string | null;
  riskLevel?: FollowUpRiskLevel | null;
  nextCareAction?: string | null;
  tags?: readonly string[] | null;
};

export type TreatmentPathTemplateMatchedBy = 'category' | 'safe_auxiliary_text';

export type TreatmentPathTemplateMatch = {
  template: TreatmentPathTemplate;
  matchedBy: TreatmentPathTemplateMatchedBy;
  normalizedRecoveryStage: TreatmentPathRecoveryStage | null;
  riskLevel: FollowUpRiskLevel;
  nodes: readonly TreatmentPathTemplateNode[];
};

const sharedSafetyNotes = [
  '仅使用结构化字段做模板判断。',
  '所有建议均需人工复核。',
  '所有建议均禁止自动触达。',
] as const;

const nodeSafetyNotes = ['内部任务建议，不面向客户自动发送。'] as const;

export const treatmentPathTemplates: readonly TreatmentPathTemplate[] = [
  {
    templateKey: 'photoelectric_care',
    projectType: 'photoelectric_care',
    categoryKeys: ['laser_repair'],
    recoveryStages: ['D1', 'D3', 'D7', 'D14'],
    riskLevels: ['normal', 'watch', 'urgent'],
    safetyNotes: sharedSafetyNotes,
    nodes: [
      {
        nodeKey: 'photoelectric_d1_watch',
        offsetDays: 1,
        recoveryStage: 'D1',
        riskLevels: ['watch', 'urgent'],
        taskTitle: '光电治疗 D1 反应人工确认',
        handlerRole: 'medical_assistant',
        requiresHumanConfirmation: true,
        forbidAutoReachOut: true,
        safetyNotes: nodeSafetyNotes,
      },
      {
        nodeKey: 'photoelectric_d3_care',
        offsetDays: 3,
        recoveryStage: 'D3',
        riskLevels: ['normal', 'watch'],
        taskTitle: '光电治疗 D3 护理执行确认',
        handlerRole: 'customer_service',
        requiresHumanConfirmation: true,
        forbidAutoReachOut: true,
        safetyNotes: nodeSafetyNotes,
      },
      {
        nodeKey: 'photoelectric_d7_repair',
        offsetDays: 7,
        recoveryStage: 'D7',
        riskLevels: ['normal', 'watch'],
        taskTitle: '光电治疗 D7 恢复进展复核',
        handlerRole: 'nursing_staff',
        requiresHumanConfirmation: true,
        forbidAutoReachOut: true,
        safetyNotes: nodeSafetyNotes,
      },
      {
        nodeKey: 'photoelectric_d1_urgent',
        offsetDays: 1,
        recoveryStage: 'D1',
        riskLevels: ['urgent'],
        taskTitle: '光电治疗高风险反应人工升级处理',
        handlerRole: 'operations_lead',
        requiresHumanConfirmation: true,
        forbidAutoReachOut: true,
        safetyNotes: nodeSafetyNotes,
      },
    ],
  },
  {
    templateKey: 'hydro_injection_care',
    projectType: 'hydro_injection_care',
    categoryKeys: ['injection_review'],
    recoveryStages: ['D1', 'D3', 'D7', 'revisit_before'],
    riskLevels: ['normal', 'watch', 'urgent'],
    safetyNotes: sharedSafetyNotes,
    nodes: [
      {
        nodeKey: 'hydro_injection_d1_check',
        offsetDays: 1,
        recoveryStage: 'D1',
        riskLevels: ['watch', 'urgent'],
        taskTitle: '水光注射 D1 局部反应人工确认',
        handlerRole: 'medical_assistant',
        requiresHumanConfirmation: true,
        forbidAutoReachOut: true,
        safetyNotes: nodeSafetyNotes,
      },
      {
        nodeKey: 'hydro_injection_d3_care',
        offsetDays: 3,
        recoveryStage: 'D3',
        riskLevels: ['normal', 'watch'],
        taskTitle: '水光注射 D3 护理完成确认',
        handlerRole: 'customer_service',
        requiresHumanConfirmation: true,
        forbidAutoReachOut: true,
        safetyNotes: nodeSafetyNotes,
      },
      {
        nodeKey: 'hydro_injection_d7_revisit',
        offsetDays: 7,
        recoveryStage: 'D7',
        riskLevels: ['normal', 'watch'],
        taskTitle: '水光注射 D7 复诊前状态确认',
        handlerRole: 'consultant',
        requiresHumanConfirmation: true,
        forbidAutoReachOut: true,
        safetyNotes: nodeSafetyNotes,
      },
      {
        nodeKey: 'hydro_injection_revisit_before_urgent',
        offsetDays: 1,
        recoveryStage: 'revisit_before',
        riskLevels: ['urgent'],
        taskTitle: '水光注射复诊前高风险人工处理',
        handlerRole: 'operations_lead',
        requiresHumanConfirmation: true,
        forbidAutoReachOut: true,
        safetyNotes: nodeSafetyNotes,
      },
    ],
  },
  {
    templateKey: 'post_surgery_repair',
    projectType: 'post_surgery_repair',
    categoryKeys: ['skin_repair'],
    recoveryStages: ['D1', 'D3', 'D7', 'D14'],
    riskLevels: ['normal', 'watch', 'urgent'],
    safetyNotes: sharedSafetyNotes,
    nodes: [
      {
        nodeKey: 'post_surgery_d1_urgent',
        offsetDays: 1,
        recoveryStage: 'D1',
        riskLevels: ['urgent'],
        taskTitle: '术后修复 D1 高风险人工处理',
        handlerRole: 'operations_lead',
        requiresHumanConfirmation: true,
        forbidAutoReachOut: true,
        safetyNotes: nodeSafetyNotes,
      },
      {
        nodeKey: 'post_surgery_d3_watch',
        offsetDays: 3,
        recoveryStage: 'D3',
        riskLevels: ['watch', 'urgent'],
        taskTitle: '术后修复 D3 重点恢复确认',
        handlerRole: 'medical_assistant',
        requiresHumanConfirmation: true,
        forbidAutoReachOut: true,
        safetyNotes: nodeSafetyNotes,
      },
      {
        nodeKey: 'post_surgery_d7_repair',
        offsetDays: 7,
        recoveryStage: 'D7',
        riskLevels: ['normal', 'watch'],
        taskTitle: '术后修复 D7 护理路径复核',
        handlerRole: 'nursing_staff',
        requiresHumanConfirmation: true,
        forbidAutoReachOut: true,
        safetyNotes: nodeSafetyNotes,
      },
      {
        nodeKey: 'post_surgery_d14_stable',
        offsetDays: 14,
        recoveryStage: 'D14',
        riskLevels: ['normal', 'watch'],
        taskTitle: '术后修复 D14 稳定期人工复核',
        handlerRole: 'consultant',
        requiresHumanConfirmation: true,
        forbidAutoReachOut: true,
        safetyNotes: nodeSafetyNotes,
      },
    ],
  },
  {
    templateKey: 'skin_management',
    projectType: 'skin_management',
    categoryKeys: ['skin_check'],
    recoveryStages: ['post_check', 'D3', 'D7', 'stable'],
    riskLevels: ['normal', 'watch', 'urgent'],
    safetyNotes: sharedSafetyNotes,
    nodes: [
      {
        nodeKey: 'skin_management_post_check',
        offsetDays: 1,
        recoveryStage: 'post_check',
        riskLevels: ['normal', 'watch'],
        taskTitle: '皮肤管理检测后护理确认',
        handlerRole: 'customer_service',
        requiresHumanConfirmation: true,
        forbidAutoReachOut: true,
        safetyNotes: nodeSafetyNotes,
      },
      {
        nodeKey: 'skin_management_d3_watch',
        offsetDays: 3,
        recoveryStage: 'D3',
        riskLevels: ['watch', 'urgent'],
        taskTitle: '皮肤管理 D3 重点问题人工确认',
        handlerRole: 'medical_assistant',
        requiresHumanConfirmation: true,
        forbidAutoReachOut: true,
        safetyNotes: nodeSafetyNotes,
      },
      {
        nodeKey: 'skin_management_d7_progress',
        offsetDays: 7,
        recoveryStage: 'D7',
        riskLevels: ['normal', 'watch'],
        taskTitle: '皮肤管理 D7 改善进展复核',
        handlerRole: 'nursing_staff',
        requiresHumanConfirmation: true,
        forbidAutoReachOut: true,
        safetyNotes: nodeSafetyNotes,
      },
      {
        nodeKey: 'skin_management_stable',
        offsetDays: 14,
        recoveryStage: 'stable',
        riskLevels: ['normal'],
        taskTitle: '皮肤管理稳定期复购前人工确认',
        handlerRole: 'consultant',
        requiresHumanConfirmation: true,
        forbidAutoReachOut: true,
        safetyNotes: nodeSafetyNotes,
      },
    ],
  },
];

const categoryToTemplateKey = new Map<string, TreatmentPathTemplateKey>(
  treatmentPathTemplates.flatMap((template) =>
    template.categoryKeys.map((categoryKey) => [categoryKey, template.templateKey] as const),
  ),
);

const disallowedLiteralTerms = [
  ['DATABASE', 'URL'].join('_'),
  ['完整治疗', '正文'].join(''),
  ['完整病历', '正文'].join(''),
  ['咨询', '全文'].join(''),
  ['图片', '原文'].join(''),
  ['文件', '原文'].join(''),
  ['st', 'ack'].join(''),
  ['to', 'ken'].join(''),
  ['sec', 'ret'].join(''),
];

const disallowedPatterns = [
  /1[3-9]\d{9}/u,
  /\d{6}(?:19|20)\d{2}\d{2}\d{2}\d{3}[\dXx]/u,
  /\bMR[-_A-Z0-9]{3,}\b/iu,
  /\b(?:postgres|mysql|mongodb|redis):\/\//iu,
  /\bselect\s+.+\s+from\b/iu,
  /\b(?:insert|update|delete)\s+\w+\b/iu,
  /\bsk[-_][a-z0-9_-]{6,}\b/iu,
];

const auxiliaryKeywordRules: Record<TreatmentPathTemplateKey, readonly RegExp[]> = {
  photoelectric_care: [/光子/u, /光电|光電/u, /热玛吉|熱瑪吉/u, /超声炮|超聲炮/u],
  hydro_injection_care: [/水光/u, /注射/u, /玻尿酸/u, /肉毒/u, /填充/u],
  post_surgery_repair: [/术后|術後/u, /手术|手術/u, /眼周修复|眼周修復/u, /修复|修復/u],
  skin_management: [/皮肤检测|皮膚檢測/u, /皮肤管理|皮膚管理/u, /补水护理|補水護理/u],
};

function normalizeText(input: string | null | undefined) {
  return (input ?? '').normalize('NFKC').trim().toLowerCase();
}

function containsDisallowedText(input: string) {
  const normalized = normalizeText(input);

  if (!normalized) {
    return false;
  }

  return (
    disallowedLiteralTerms.some((term) => normalized.includes(term.toLowerCase())) ||
    disallowedPatterns.some((pattern) => pattern.test(normalized))
  );
}

function safeStructuredText(input: string | null | undefined) {
  const normalized = normalizeText(input);

  if (!normalized || containsDisallowedText(normalized)) {
    return '';
  }

  return normalized.length > 80 ? '' : normalized;
}

function normalizeCategory(input: string | null | undefined) {
  return safeStructuredText(input).replace(/[\s-]+/gu, '_');
}

function normalizeRiskLevel(input: TreatmentPathTemplateMatchInput) {
  return input.riskLevel ?? 'normal';
}

export function normalizeTreatmentPathRecoveryStage(
  input: TreatmentPathTemplateMatchInput,
): TreatmentPathRecoveryStage | null {
  const recoveryStage = safeStructuredText(input.recoveryStage);
  const treatmentStage = safeStructuredText(input.treatmentStage);
  const combined = [recoveryStage, treatmentStage].filter(Boolean).join(' ');

  if (!combined) {
    return null;
  }

  if (/(^|[^0-9])(?:d\s*14|第\s*14\s*天|14\s*天)([^0-9]|$)/iu.test(combined)) {
    return 'D14';
  }
  if (/(^|[^0-9])(?:d\s*7|第\s*7\s*天|7\s*天)([^0-9]|$)/iu.test(combined)) {
    return 'D7';
  }
  if (/(^|[^0-9])(?:d\s*3|第\s*3\s*天|3\s*天)([^0-9]|$)/iu.test(combined)) {
    return 'D3';
  }
  if (/(^|[^0-9])(?:d\s*1|第\s*1\s*天|1\s*天)([^0-9]|$)/iu.test(combined)) {
    return 'D1';
  }
  if (/复诊前|復診前|复查前|復查前/iu.test(combined)) {
    return 'revisit_before';
  }
  if (/检测后|檢測後|检查后|檢查後/iu.test(combined)) {
    return 'post_check';
  }
  if (/稳定|穩定/iu.test(combined)) {
    return 'stable';
  }

  return null;
}

function findTemplateByKey(templateKey: TreatmentPathTemplateKey) {
  return treatmentPathTemplates.find((template) => template.templateKey === templateKey) ?? null;
}

function matchTemplateByCategory(input: TreatmentPathTemplateMatchInput) {
  const categoryKey = normalizeCategory(input.treatmentCategory);
  const templateKey = categoryToTemplateKey.get(categoryKey);

  return templateKey ? findTemplateByKey(templateKey) : null;
}

function matchTemplateByAuxiliaryText(input: TreatmentPathTemplateMatchInput) {
  const textParts = [
    safeStructuredText(input.treatmentProject),
    safeStructuredText(input.treatmentStage),
    safeStructuredText(input.recoveryStage),
    ...(input.tags ?? []).map((tag) => safeStructuredText(tag)),
  ].filter(Boolean);
  const combined = textParts.join(' ');

  if (!combined) {
    return null;
  }

  const matchedKeys = treatmentPathTemplateKeys.filter((templateKey) =>
    auxiliaryKeywordRules[templateKey].some((pattern) => pattern.test(combined)),
  );

  return matchedKeys.length === 1 ? findTemplateByKey(matchedKeys[0]) : null;
}

export function findTreatmentPathTemplate(
  input: TreatmentPathTemplateMatchInput,
): TreatmentPathTemplate | null {
  return matchTemplateByCategory(input) ?? matchTemplateByAuxiliaryText(input);
}

export function selectTreatmentPathTemplateNodes(
  template: TreatmentPathTemplate,
  input: TreatmentPathTemplateMatchInput,
): readonly TreatmentPathTemplateNode[] {
  const normalizedRecoveryStage = normalizeTreatmentPathRecoveryStage(input);
  const riskLevel = normalizeRiskLevel(input);
  const riskCompatibleNodes = template.nodes.filter((node) => node.riskLevels.includes(riskLevel));
  const stageNodes = normalizedRecoveryStage
    ? riskCompatibleNodes.filter((node) => node.recoveryStage === normalizedRecoveryStage)
    : [];
  const candidates = stageNodes.length > 0 ? stageNodes : riskCompatibleNodes;
  const sortedCandidates = [...candidates].sort((left, right) => left.offsetDays - right.offsetDays);

  if (riskLevel === 'urgent') {
    const urgentNodes = sortedCandidates.filter((node) => node.riskLevels.includes('urgent'));

    if (urgentNodes.length > 0) {
      return urgentNodes;
    }
  }

  return sortedCandidates;
}

export function matchTreatmentPathTemplate(
  input: TreatmentPathTemplateMatchInput,
): TreatmentPathTemplateMatch | null {
  const categoryTemplate = matchTemplateByCategory(input);
  const auxiliaryTemplate = categoryTemplate ? null : matchTemplateByAuxiliaryText(input);
  const template = categoryTemplate ?? auxiliaryTemplate;

  if (!template) {
    return null;
  }

  return {
    template,
    matchedBy: categoryTemplate ? 'category' : 'safe_auxiliary_text',
    normalizedRecoveryStage: normalizeTreatmentPathRecoveryStage(input),
    riskLevel: normalizeRiskLevel(input),
    nodes: selectTreatmentPathTemplateNodes(template, input),
  };
}
