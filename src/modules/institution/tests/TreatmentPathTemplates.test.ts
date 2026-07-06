import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';
import {
  matchTreatmentPathTemplate,
  selectTreatmentPathTemplateNodes,
  treatmentPathTemplates,
  type TreatmentPathTemplateKey,
  type TreatmentPathTemplateMatchInput,
} from '@/modules/institution/domain/treatment-path-templates';

const baseInput = {
  treatmentCategory: 'laser_repair',
  treatmentProject: '光子嫩肤',
  treatmentStage: 'D1 术后观察',
  recoveryStage: 'D1',
  riskLevel: 'watch',
  nextCareAction: 'D3 人工确认泛红和补水护理执行情况。',
  tags: ['结构化摘要', '光电护理'],
} satisfies TreatmentPathTemplateMatchInput;

const blockedSamples = {
  phone: ['138', '0000', '0000'].join(''),
  idNumber: ['110101', '199001', '010011'].join(''),
  medicalRecord: ['MR', 'RAW', '001'].join('-'),
  treatmentBody: ['完整治疗', '正文'].join(''),
  medicalBody: ['完整病历', '正文'].join(''),
  consultationBody: ['咨询', '全文'].join(''),
  imageBody: ['图片', '原文'].join(''),
  fileBody: ['文件', '原文'].join(''),
  databaseName: ['DATABASE', 'URL'].join('_'),
  connectionText: ['postgres', '://tenant.invalid'].join(''),
  queryText: ['select', '* from treatment_path_templates'].join(' '),
  errorTraceWord: ['st', 'ack'].join(''),
  credentialWord: ['to', 'ken'].join(''),
  privateWord: ['sec', 'ret'].join(''),
  apiKeyLike: ['sk', 'test', 'should_not_return'].join('_'),
} as const;

function escapeRegExp(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

const forbiddenOutputPattern = new RegExp(
  Object.values(blockedSamples).map(escapeRegExp).join('|'),
  'i',
);

function expectNoPrivateData(payload: unknown) {
  expect(JSON.stringify(payload)).not.toMatch(forbiddenOutputPattern);
}

function expectTemplateMatch(
  input: TreatmentPathTemplateMatchInput,
  templateKey: TreatmentPathTemplateKey,
) {
  const match = matchTreatmentPathTemplate(input);

  expect(match).toEqual(
    expect.objectContaining({
      template: expect.objectContaining({ templateKey }),
    }),
  );

  return match;
}

describe('治疗项目路径模板 domain catalog', () => {
  it('光子 / 光电治疗能匹配 photoelectric_care', () => {
    const match = expectTemplateMatch(
      {
        ...baseInput,
        treatmentCategory: 'laser_repair',
        treatmentProject: '光电治疗',
        tags: ['光子', '术后关怀'],
      },
      'photoelectric_care',
    );

    expect(match?.matchedBy).toBe('category');
    expect(match?.nodes.map((node) => node.recoveryStage)).toContain('D1');
  });

  it('水光 / 注射护理能匹配 hydro_injection_care', () => {
    const match = expectTemplateMatch(
      {
        ...baseInput,
        treatmentCategory: 'injection_review',
        treatmentProject: '水光注射护理',
        recoveryStage: 'D3',
        riskLevel: 'watch',
        tags: ['注射复诊'],
      },
      'hydro_injection_care',
    );

    expect(match?.template.projectType).toBe('hydro_injection_care');
    expect(match?.nodes.length).toBeGreaterThan(0);
  });

  it('术后修复能匹配 post_surgery_repair', () => {
    const match = expectTemplateMatch(
      {
        ...baseInput,
        treatmentCategory: 'skin_repair',
        treatmentProject: '术后修复',
        recoveryStage: 'D7',
        riskLevel: 'watch',
        tags: ['修复护理'],
      },
      'post_surgery_repair',
    );

    expect(match?.template.categoryKeys).toContain('skin_repair');
  });

  it('双眼皮 / 手术治疗能匹配 post_surgery_repair', () => {
    const match = expectTemplateMatch(
      {
        ...baseInput,
        treatmentCategory: 'surgery_repair',
        treatmentProject: '双眼皮手术术后修复',
        recoveryStage: 'D3',
        riskLevel: 'watch',
        tags: ['眼周修复', '手术复查'],
      },
      'post_surgery_repair',
    );

    expect(match?.nodes.some((node) => node.recoveryStage === 'D3')).toBe(true);
  });

  it('皮肤管理能匹配 skin_management', () => {
    const match = expectTemplateMatch(
      {
        ...baseInput,
        treatmentCategory: 'skin_check',
        treatmentProject: '皮肤管理',
        treatmentStage: '稳定期护理',
        recoveryStage: '稳定期',
        riskLevel: 'normal',
        tags: ['皮肤检测'],
      },
      'skin_management',
    );

    expect(match?.nodes.some((node) => node.recoveryStage === 'stable')).toBe(true);
  });

  it('riskLevel=urgent 能命中更优先的人工处理节点', () => {
    const match = expectTemplateMatch(
      {
        ...baseInput,
        treatmentCategory: 'skin_repair',
        treatmentProject: '术后修复',
        recoveryStage: 'D1',
        riskLevel: 'urgent',
        tags: ['术后重点观察'],
      },
      'post_surgery_repair',
    );
    const selectedNodes = selectTreatmentPathTemplateNodes(match!.template, {
      ...baseInput,
      recoveryStage: 'D1',
      riskLevel: 'urgent',
    });

    expect(selectedNodes[0]).toEqual(
      expect.objectContaining({
        recoveryStage: 'D1',
        riskLevels: expect.arrayContaining(['urgent']),
        requiresHumanConfirmation: true,
        forbidAutoReachOut: true,
      }),
    );
    expect(selectedNodes[0]?.taskTitle).toMatch(/高风险|重点|人工/);
    expect(selectedNodes[0]?.offsetDays).toBeLessThanOrEqual(1);
  });

  it('ambiguous 输入不会猜测项目', () => {
    const match = matchTreatmentPathTemplate({
      treatmentCategory: '',
      treatmentProject: '光子水光联合护理',
      treatmentStage: 'D3',
      recoveryStage: 'D3',
      riskLevel: 'watch',
      nextCareAction: '人工确认',
      tags: ['光电', '注射'],
    });

    expect(match).toBeNull();
  });

  it('所有模板节点都要求人工确认且禁止自动触达', () => {
    const nodes = treatmentPathTemplates.flatMap((template) => template.nodes);

    expect(nodes.length).toBeGreaterThanOrEqual(8);
    for (const node of nodes) {
      expect(node.requiresHumanConfirmation).toBe(true);
      expect(node.forbidAutoReachOut).toBe(true);
    }
  });

  it('输出不包含隐私字段、原文、文件原文或连接串类内容', () => {
    const match = matchTreatmentPathTemplate({
      ...baseInput,
      treatmentCategory: 'laser_repair',
      treatmentProject: [
        blockedSamples.phone,
        blockedSamples.idNumber,
        blockedSamples.medicalRecord,
        blockedSamples.treatmentBody,
      ].join(' '),
      treatmentStage: [
        blockedSamples.medicalBody,
        blockedSamples.consultationBody,
        blockedSamples.errorTraceWord,
      ].join(' '),
      recoveryStage: 'D1',
      riskLevel: 'urgent',
      nextCareAction: [
        blockedSamples.databaseName,
        blockedSamples.connectionText,
        blockedSamples.queryText,
      ].join(' '),
      tags: [
        blockedSamples.imageBody,
        blockedSamples.fileBody,
        blockedSamples.credentialWord,
        blockedSamples.privateWord,
        blockedSamples.apiKeyLike,
      ],
    });

    expect(match).not.toBeNull();
    expectNoPrivateData(match);
  });

  it('不调用 AI / RAG / Agent / 外部系统，也不接入现有随访建议流程', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/modules/institution/domain/treatment-path-templates.ts'),
      'utf8',
    );
    const blockedSourceTerms = [
      ['open', 'ai'].join(''),
      ['r', 'ag'].join(''),
      ['a', 'gent'].join(''),
      ['buildTreatment', 'FollowUpSuggestions'].join(''),
      ['fetch', '('].join(''),
      ['XMLHttpRequest'].join(''),
      ['DATABASE', 'URL'].join('_'),
      ['we', 'chat'].join(''),
      ['we', 'com'].join(''),
      ['sms'].join(''),
      ['web', 'hook'].join(''),
      ['axios'].join(''),
    ];

    for (const term of blockedSourceTerms) {
      expect(source.toLowerCase()).not.toContain(term.toLowerCase());
    }
    expect(source).not.toMatch(/\b(insert|update|delete)\s*\(/iu);
  });
});
