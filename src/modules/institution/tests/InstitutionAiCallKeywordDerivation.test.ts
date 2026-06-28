import { describe, expect, it } from 'vitest';
import { deriveKnowledgeSearchKeyword } from '@/modules/institution/domain/institution-knowledge-management';

describe('deriveKnowledgeSearchKeyword', () => {
  it('长问题可派生为含短词"冷敷"的关键词', () => {
    const keyword = deriveKnowledgeSearchKeyword(
      '请根据机构知识库回答：术后24小时内是否可以冷敷？回答时请列出依据来源。',
    );
    expect(keyword.length).toBeGreaterThanOrEqual(1);
    expect(keyword.length).toBeLessThanOrEqual(80);
    expect(keyword).toContain('冷敷');
  });

  it('已有短词可直接作为关键词', () => {
    const keyword = deriveKnowledgeSearchKeyword('冷敷后怎么护理？');
    expect(keyword.length).toBeGreaterThanOrEqual(2);
    expect(keyword).toContain('冷敷');
  });

  it('部分片段可提取', () => {
    const keyword = deriveKnowledgeSearchKeyword('请根据机构知识库回答：玻尿酸注射后注意事项及禁忌');
    expect(keyword.length).toBeGreaterThanOrEqual(2);
    expect(keyword.length).toBeLessThanOrEqual(12);
  });

  it('空问题返回空字符串', () => {
    expect(deriveKnowledgeSearchKeyword('')).toBe('');
    expect(deriveKnowledgeSearchKeyword('  ')).toBe('');
  });

  it('清洗后清理已删词内容', () => {
    // 只含指令词，无实际内容
    const result = deriveKnowledgeSearchKeyword('是否可以回答请');
    // 全部被清除后，整个字符串 < 2 个中文字 → 回退到原文本
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it('返回长度不超过 80', () => {
    const longQuestion = '请根据机构知识库回答：' + '术后护理知识'.repeat(30);
    const keyword = deriveKnowledgeSearchKeyword(longQuestion);
    expect(keyword.length).toBeLessThanOrEqual(80);
  });
});
