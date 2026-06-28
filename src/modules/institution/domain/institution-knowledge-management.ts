import type { PlatformKnowledgePageInfo } from '@/modules/open-platform/server/platformKnowledgeManagementApiContract';
import type {
  V1KnowledgeBaseRuntimeFoundationReadonlyStatus,
  V1KnowledgeBaseRuntimeFoundationSourceKind,
  V1KnowledgeBaseRuntimeFoundationStatus,
} from '@/modules/knowledge-base/domain/v1-knowledge-base-runtime-foundation-api-contract';

export type InstitutionKnowledgeVisibility = 'owned' | 'platform_authorized';

/**
 * 从 AI 试问问题中提取 KB 关键词检索所用的搜索词。
 *
 * 目的：用户输入的自然语言长问句（”请根据机构知识库回答：术后24小时内
 * 是否可以冷敷？回答时请列出依据来源。”）包含大量非检索指令词，直接用
 * 整句搜索会导致 keyword search 无法命中只含短词的片段。
 *
 * 策略：
 * 1. trim 输入。
 * 2. 按标点/空格拆分句子片段。
 * 3. 从每个片段中移除常见 AI 试问指令词（全词匹配），取剩余 > 2 中文字符的部分。
 * 4. 优先取靠前、在 2–12 字的候选作为搜索关键词。
 * 5. 限制 1–80 字。
 *
 * 关键词长度限制与 KB keyword search service 一致。
 */
export function deriveKnowledgeSearchKeyword(question: string): string {
  const trimmed = question.trim();
  if (!trimmed) return '';

  // 按标点/空格/换行拆分句子
  const segments = trimmed.split(/[，。,\.\s、；;：:！!？?「」””（）()]+/g).filter(Boolean).map((s) => s.trim());

  // 常见 AI 试问指令词（全词匹配移除）
  const instructionPhrases = [
    '请根据机构知识库回答',
    '根据机构知识库回答',
    '根据机构知识库',
    '回答时请列出依据来源',
    '请列出依据来源',
    '列出依据来源',
    '依据来源',
    '是否可以',
    '回答',
    '依据',
    '来源',
    '请你',
    '请',
    '什么',
    '怎么',
    '如何',
    '怎样',
  ];

  // 从每个片段中移除指令词后取有效关键词候选
  const candidates: string[] = [];
  for (const seg of segments) {
    let cleaned = seg;
    for (const phrase of instructionPhrases) {
      cleaned = cleaned.replace(new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '').trim();
    }
    // 移除日期/时长模式（如 “术后24小时内”）
    cleaned = cleaned
      .replace(/术后\d{1,3}(小时|分钟|天|周)内?/g, '')
      .trim();

    if (cleaned.length >= 2 && cleaned.length <= 12) {
      candidates.push(cleaned);
    }
  }

  if (candidates.length > 0) {
    const keyword = candidates[0];
    if (keyword.length <= 80) return keyword;
    return keyword.slice(0, 80);
  }

  // 无合适分段时，从全文去指令词后提取中文子串
  let fullCleaned = trimmed;
  for (const phrase of instructionPhrases) {
    fullCleaned = fullCleaned.replace(new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '').trim();
  }

  if (fullCleaned.length >= 2 && fullCleaned.length <= 12) return fullCleaned;
  const chineseChars = [...fullCleaned].filter((c) => /[一-鿿]/.test(c));
  if (chineseChars.length >= 2) {
    return chineseChars.slice(0, 12).join('');
  }

  // 最终回退：取原问题前 80 字
  return trimmed.length > 80 ? trimmed.slice(0, 80) : trimmed;
}

export type InstitutionKnowledgeItemDto = {
  knowledgeId: string;
  title: string;
  category: string;
  status: V1KnowledgeBaseRuntimeFoundationStatus;
  readonlyStatus: V1KnowledgeBaseRuntimeFoundationReadonlyStatus;
  sourceKind: V1KnowledgeBaseRuntimeFoundationSourceKind;
  descriptionPreview: string;
  chunkCount: number;
  visibility: InstitutionKnowledgeVisibility;
  updatedAt: string;
  createdAt: string;
};

export type InstitutionKnowledgeItemsParams = {
  tenantId: string;
  institutionId: string;
  keyword?: string | null;
  page?: string | number | null;
  pageSize?: string | number | null;
};

export type InstitutionKnowledgeListResponse = {
  requestId: 'institution-knowledge-management-items';
  readonly: true;
  dataSource: 'repository';
  records: InstitutionKnowledgeItemDto[];
  pageInfo: PlatformKnowledgePageInfo;
  emptyState: {
    title: string;
    description: string;
  };
};
