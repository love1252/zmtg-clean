import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const docPath = join(
  process.cwd(),
  'docs/product/2026-06-14-v1-knowledge-base-production-governance-plan-01.md',
);

describe('知识库生产级治理文档', () => {
  it('明确当前内部闭环、本次治理底座和生产级 No-Go 边界', () => {
    const content = readFileSync(docPath, 'utf8');

    [
      '当前已完成内部闭环',
      '生产级治理底座',
      '能力开关',
      '权限矩阵',
      'QA 用量策略集中化',
      '低敏字段',
      '禁止返回字段',
      '当前未开启真实 AI',
      '当前未开启 OCR',
      '当前未开启 runtime ingestion',
      '真实 AI 前置条件',
      'OCR 前置条件',
      'runtime ingestion 前置条件',
      'No-Go：生产级 AI 知识库上线',
      'Go：生产级治理底座进入内部评审',
    ].forEach((fragment) => {
      expect(content).toContain(fragment);
    });

    expect(content).not.toMatch(/真实 AI 已可用|OCR 已可用|runtime ingestion 已可用/);
  });
});
