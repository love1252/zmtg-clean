import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const docPath = 'docs/product/test-plans/v1-knowledge-base-ai-readiness-e2e-acceptance-01.md';

describe('知识库真实 AI 上线前 E2E 验收文档', () => {
  it('说明安全评估、质量样例、引用规则、E2E 范围和 Go / No-Go', () => {
    const content = readFileSync(docPath, 'utf8');

    [
      'AI 上线前验收底座',
      '未接真实 AI',
      '未读取真实密钥',
      '未调用外部网络',
      '安全评估范围',
      '质量评估样例范围',
      '引用准确率规则',
      'E2E 覆盖范围',
      '准浏览器级验收',
      'Go：AI provider 安全适配层继续内部评审',
      'No-Go：真实 AI 生产上线',
    ].forEach((fragment) => {
      expect(content).toContain(fragment);
    });

    expect(content).not.toMatch(/真实 AI 已可用|已读取真实密钥|已调用外部网络|已接入 OCR|已进入 runtime ingestion/);
  });
});
