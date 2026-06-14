import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const docPath = 'docs/product/test-plans/v1-knowledge-base-production-gonogo-acceptance-01.md';

describe('知识库生产上线 Go/No-Go 总验收文档', () => {
  it('说明能力总表、disabled 状态、验收覆盖、E2E 替代说明和 Go / No-Go', () => {
    const content = readFileSync(docPath, 'utf8');

    [
      '当前已完成能力总表',
      '真实 AI 仍 disabled',
      'OCR 仍 disabled',
      'runtime ingestion 仍 disabled',
      '真实向量数据库仍 disabled',
      '安全评估覆盖',
      'QA 质量样例覆盖',
      '引用准确率规则覆盖',
      '权限矩阵覆盖',
      'QA 审计与用量限制覆盖',
      'capability 状态覆盖',
      '浏览器 E2E 或替代验收说明',
      '正式浏览器 E2E 待框架批准后补齐',
      'Go：内部生产级验收评审',
      'Go：进入真实 AI 接入方案评审',
      'No-Go：直接生产上线真实 AI 知识库',
      'No-Go：直接启用 OCR',
      'No-Go：直接启用 runtime ingestion',
      'No-Go：直接切回首页编辑',
    ].forEach((fragment) => {
      expect(content).toContain(fragment);
    });

    expect(content).not.toMatch(/真实 AI 已可用|已读取真实密钥|已调用外部网络|已接入 OCR|已进入 runtime ingestion/);
  });
});
