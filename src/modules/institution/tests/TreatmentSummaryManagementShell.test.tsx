import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TreatmentSummaryManagementShell } from '@/modules/institution/components/TreatmentSummaryManagementShell';

const treatmentSummaryRecord = {
  id: 'trt_phase14_main',
  customerId: 'cust_phase14_main',
  appointmentId: 'appt_phase14_main',
  treatmentDate: '2026-06-02T16:30:00+08:00',
  treatmentProject: 'Phase14 光电修复',
  treatmentCategory: 'phase14_laser_repair',
  treatmentStage: 'Phase14 D14 复诊',
  recoveryStage: 'Phase14 D14',
  riskLevel: 'watch',
  ownerUserId: 'doctor-phase14',
  summary: 'Phase14 结构化摘要：恢复稳定，安排补水。',
  nextCareAction: 'Phase14 D21 人工回访恢复阶段。',
  tags: ['Phase14 结构化摘要', '复诊'],
  status: 'active',
  voidedAt: null,
  voidedBy: null,
  voidReasonCode: null,
  voidReason: null,
  createdAt: '2026-06-02T16:30:00+08:00',
  updatedAt: '2026-06-02T17:00:00+08:00',
  tenantId: 'demo-tenant-001',
  phoneNumber: '13800001252',
  idNumber: '110101199001010011',
  medicalRecordNo: 'MR202605310001',
  fullTreatmentRecord: '完整治疗记录正文不应展示',
  medicalRecordText: '完整病历正文不应展示',
  diagnosisText: '诊疗原文不应展示',
  consultationTranscript: '咨询对话全文不应展示',
  imageFileOriginal: '图片文件原文不应展示',
  aiGeneratedContent: 'AI 生成内容不应展示',
  externalSyncPayload: '外部系统同步原文不应展示',
  requestBody: { phoneNumber: '13800001252' },
  sql: 'select * from treatment_summaries',
  stack: 'DATABASE_URL=postgres://tenant:secret@localhost:5432/zmtg',
  token: 'sk_test_phase14_should_not_render',
  secret: 'phase14-raw-secret',
};

const secondTreatmentSummaryRecord = {
  ...treatmentSummaryRecord,
  id: 'trt_phase14_second',
  customerId: 'cust_phase14_second',
  appointmentId: null,
  treatmentProject: 'Phase14 水光补水复诊',
  treatmentCategory: 'phase14_skin_repair',
  treatmentStage: 'Phase14 D21 复诊',
  recoveryStage: 'Phase14 D21',
  riskLevel: 'normal',
  summary: 'Phase14 结构化摘要：补水后恢复稳定。',
  nextCareAction: 'Phase14 D28 人工确认恢复阶段。',
};

const voidedTreatmentSummaryRecord = {
  ...treatmentSummaryRecord,
  id: 'trt_phase19_voided',
  treatmentProject: 'Phase19 已作废治疗摘要',
  treatmentCategory: 'phase19_voided_category',
  treatmentStage: 'Phase19 D7 复核',
  recoveryStage: 'Phase19 D7',
  riskLevel: 'watch',
  summary: 'Phase19 结构化摘要：误录入，后续仅保留追溯。',
  nextCareAction: '不再基于该摘要生成随访建议。',
  tags: ['Phase19 作废治理'],
  status: 'voided',
  voidedAt: '2026-06-02T18:00:00+08:00',
  voidedBy: 'demo-user-admin',
  voidReasonCode: 'duplicate_summary',
  voidReason: '重复录入，保留较新的治疗摘要',
  updatedAt: '2026-06-02T18:00:00+08:00',
};

const voidedTreatmentSummaryAfterMutation = {
  ...treatmentSummaryRecord,
  status: 'voided',
  voidedAt: '2026-06-02T19:00:00+08:00',
  voidedBy: 'demo-user-admin',
  voidReasonCode: 'duplicate_summary',
  voidReason: '重复录入，保留较新的治疗摘要',
  updatedAt: '2026-06-02T19:00:00+08:00',
};

const updatedTreatmentSummaryRecord = {
  ...treatmentSummaryRecord,
  treatmentDate: '2026-06-03T10:00:00+08:00',
  treatmentProject: 'Phase18 光电修复更新',
  treatmentCategory: 'phase18_skin_repair',
  treatmentStage: 'Phase18 D21 复诊',
  recoveryStage: 'Phase18 D21',
  riskLevel: 'normal',
  ownerUserId: 'doctor-phase18',
  summary: 'Phase18 结构化摘要更新：恢复稳定。',
  nextCareAction: 'Phase18 D28 人工确认恢复阶段。',
  tags: ['Phase18 编辑', '稳定'],
  appointmentId: 'appt_phase18_update',
  updatedAt: '2026-06-03T10:05:00+08:00',
};

const followUpSuggestion = {
  suggestionKey: 'trt_phase14_main:watch_risk_followup:3d',
  ruleKey: 'watch_risk_followup',
  title: '关注风险治疗后随访',
  description: '请安排人工随访，确认恢复反馈和护理执行情况。',
  recommendedDueAt: '2026-06-05T08:30:00.000Z',
  priority: 'medium',
  riskLevel: 'watch',
  sourceTreatmentSummaryId: 'trt_phase14_main',
  sourceCustomerId: 'cust_phase14_main',
  sourceAppointmentId: 'appt_phase14_main',
  tags: ['护理随访'],
  reason: 'riskLevel 为 watch，需要在观察周期内人工跟进',
  sourceFields: ['riskLevel', 'treatmentDate'],
};

const createdFollowUpTask = {
  id: 'fu_phase15_confirmed',
  customerId: 'cust_phase14_main',
  customerDisplayName: '王女士',
  journeyId: 'treatment_followup_watch_risk_followup',
  stage: '关注风险治疗后随访',
  status: 'scheduled',
  dueAt: '2026-06-05T08:30:00.000Z',
  suggestedAction: '请安排人工随访，确认恢复反馈和护理执行情况。',
  riskLevel: 'watch',
  updatedBy: null,
  updatedAt: null,
  sourceTreatmentSummaryId: 'trt_phase14_main',
  sourceSuggestionKey: 'trt_phase14_main:watch_risk_followup:3d',
  phoneNumber: '13800001252',
  consultationTranscript: '咨询对话全文不应展示',
  sql: 'select * from follow_up_tasks',
  stack: 'DATABASE_URL=postgres://tenant:secret@localhost:5432/zmtg',
  token: 'sk_test_phase15_should_not_render',
  secret: 'phase15-secret',
};

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { 'content-type': 'application/json', ...init?.headers },
  });
}

function treatmentSummariesResponse(records: unknown[], pageInfo?: unknown) {
  return jsonResponse({
    records,
    pageInfo: pageInfo ?? {
      hasMore: false,
      limit: 50,
      nextCursor: null,
    },
  });
}

function fetchPath(input: Parameters<typeof fetch>[0]) {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function requestBody(init: Parameters<typeof fetch>[1] | undefined) {
  return JSON.parse(String(init?.body)) as Record<string, unknown>;
}

function mockTreatmentSummaryFetch(
  responses: Response[],
  options: {
    followUpSuggestionResponses?: Response[];
    followUpTaskResponses?: Response[];
    followUpListResponses?: Record<string, Response[]>;
    updateTreatmentSummaryResponses?: Response[];
    voidTreatmentSummaryResponses?: Response[];
  } = {},
) {
  const queue = [...responses];
  const fallback = queue[queue.length - 1] ?? treatmentSummariesResponse([]);
  const suggestionQueue = [...(options.followUpSuggestionResponses ?? [])];
  const followUpTaskQueue = [...(options.followUpTaskResponses ?? [])];
  const updateQueue = [...(options.updateTreatmentSummaryResponses ?? [])];
  const voidQueue = [...(options.voidTreatmentSummaryResponses ?? [])];
  const followUpListResponses = Object.fromEntries(
    Object.entries(options.followUpListResponses ?? {}).map(([path, queue]) => [
      path,
      [...queue],
    ]),
  );

  const fetchMock = vi.fn(
    async (input: Parameters<typeof fetch>[0], _init?: Parameters<typeof fetch>[1]) => {
      const path = fetchPath(input);
      const method = _init?.method ?? 'GET';
      if (path.startsWith('/api/institution/followups')) {
        const queue = followUpListResponses[path];
        if (queue) {
          return queue.shift() ?? jsonResponse({ records: [] });
        }
        return jsonResponse({ records: [] });
      }

      if (path.includes('/follow-up-suggestions')) {
        return suggestionQueue.shift() ?? jsonResponse({ suggestions: [] });
      }

      if (path.includes('/follow-up-tasks')) {
        return followUpTaskQueue.shift() ?? jsonResponse({ error: '请求失败' }, { status: 503 });
      }

      if (
        method === 'POST' &&
        path.endsWith('/void')
      ) {
        return voidQueue.shift() ?? jsonResponse({ record: voidedTreatmentSummaryAfterMutation });
      }

      if (
        method === 'PATCH' &&
        path.startsWith('/api/institution/treatment-summaries/')
      ) {
        return updateQueue.shift() ?? jsonResponse({ record: updatedTreatmentSummaryRecord });
      }

      if (path.startsWith('/api/institution/treatment-summaries')) {
        return queue.shift() ?? fallback;
      }

      throw new Error(`没有为 ${path} 配置 fetch mock`);
    },
  );

  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function deferredTreatmentSummaryResponse() {
  let resolveResponse!: (response: Response) => void;
  const promise = new Promise<Response>((resolve) => {
    resolveResponse = resolve;
  });

  return {
    promise,
    resolve: (response: Response) => resolveResponse(response),
  };
}

function expectNoSensitiveTreatmentSummaryContent(container: HTMLElement) {
  const text = container.textContent ?? '';

  expect(text).not.toContain('tenantId');
  expect(text).not.toContain('13800001252');
  expect(text).not.toContain('110101199001010011');
  expect(text).not.toContain('MR202605310001');
  expect(text).not.toContain('完整治疗记录正文不应展示');
  expect(text).not.toContain('完整病历正文不应展示');
  expect(text).not.toContain('诊疗原文不应展示');
  expect(text).not.toContain('咨询对话全文不应展示');
  expect(text).not.toContain('图片文件原文不应展示');
  expect(text).not.toContain('AI 生成内容不应展示');
  expect(text).not.toContain('外部系统同步原文不应展示');
  expect(text).not.toContain('requestBody');
  expect(text).not.toContain('select * from treatment_summaries');
  expect(text).not.toContain('select * from follow_up_tasks');
  expect(text).not.toContain('DATABASE_URL');
  expect(text).not.toContain('postgres://');
  expect(text).not.toContain('stack');
  expect(text).not.toContain('token');
  expect(text).not.toContain('secret');
  expect(text).not.toContain('sk_test_phase14_should_not_render');
  expect(text).not.toContain('sk_test_phase15_should_not_render');
  expect(text).not.toContain('自动发送');
  expect(text).not.toContain('自动推送');
  expect(text).not.toContain('企微触达');
  expect(text).not.toContain('短信发送');
  expect(text).not.toContain('电话外呼');
}

describe('治疗摘要管理页面', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('进入页面后请求治疗摘要列表并展示安全字段', async () => {
    const fetchMock = mockTreatmentSummaryFetch([
      treatmentSummariesResponse([treatmentSummaryRecord]),
    ]);
    const { container } = render(<TreatmentSummaryManagementShell />);

    expect(screen.getByRole('heading', { name: '治疗摘要管理' })).toBeInTheDocument();
    expect(screen.getByText('正在加载治疗摘要...')).toBeInTheDocument();
    expect(await screen.findByText('Phase14 光电修复')).toBeInTheDocument();
    expect(screen.getByText('治疗日期：2026-06-02 16:30')).toBeInTheDocument();
    expect(screen.getByText('治疗类别：phase14_laser_repair')).toBeInTheDocument();
    expect(screen.getByText('治疗阶段：Phase14 D14 复诊')).toBeInTheDocument();
    expect(screen.getByText('恢复阶段：Phase14 D14')).toBeInTheDocument();
    expect(screen.getByText('风险：关注')).toBeInTheDocument();
    expect(screen.getByText('可作为运营依据')).toBeInTheDocument();
    expect(screen.getByText('负责人：doctor-phase14')).toBeInTheDocument();
    expect(screen.getByText('摘要：Phase14 结构化摘要：恢复稳定，安排补水。')).toBeInTheDocument();
    expect(screen.getByText('下一步护理建议：Phase14 D21 人工回访恢复阶段。')).toBeInTheDocument();
    expect(screen.getByText('Phase14 结构化摘要')).toBeInTheDocument();
    expect(screen.getByText('复诊')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /新增|删除|批量作废/u })).not.toBeInTheDocument();

    expect(fetchMock).toHaveBeenCalledWith('/api/institution/treatment-summaries', {
      cache: 'no-store',
    });
    expectNoSensitiveTreatmentSummaryContent(container);
  });

  it('治疗摘要列表展示 active 与 voided 状态，作废摘要仍可查看安全详情', async () => {
    const fetchMock = mockTreatmentSummaryFetch([
      treatmentSummariesResponse([treatmentSummaryRecord, voidedTreatmentSummaryRecord]),
    ]);
    const { container } = render(<TreatmentSummaryManagementShell />);

    expect(await screen.findByText('Phase14 光电修复')).toBeInTheDocument();
    expect(screen.getByText('Phase19 已作废治疗摘要')).toBeInTheDocument();
    expect(screen.getByText('可作为运营依据')).toBeInTheDocument();
    expect(screen.getByText('已作废')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '查看安全详情 trt_phase19_voided' }));
    const dialog = await screen.findByRole('dialog', { name: '治疗摘要安全详情' });

    expect(within(dialog).getAllByText('已作废').length).toBeGreaterThan(0);
    expect(within(dialog).getByText('作废时间')).toBeInTheDocument();
    expect(within(dialog).getAllByText('2026-06-02 18:00').length).toBeGreaterThan(0);
    expect(within(dialog).getByText('作废人')).toBeInTheDocument();
    expect(within(dialog).getByText('demo-user-admin')).toBeInTheDocument();
    expect(within(dialog).getByText('作废原因')).toBeInTheDocument();
    expect(within(dialog).getByText('重复录入，保留较新的治疗摘要')).toBeInTheDocument();
    expect(
      within(dialog).getByText('该治疗摘要已作废，仅保留历史追溯。'),
    ).toBeInTheDocument();
    expect(within(dialog).getByText('作废不是删除。')).toBeInTheDocument();
    expect(
      within(dialog).getByText('作废摘要不会继续生成新的随访建议或来源随访任务。'),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText('已存在的来源随访任务不会被自动取消，仍保留来源追溯。'),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText('系统不会主动向客户发送消息。'),
    ).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: '作废治疗摘要' })).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalled();
    expectNoSensitiveTreatmentSummaryContent(container);
  });

  it('筛选控件只发送治疗摘要白名单 query 且不包含 tenantId', async () => {
    const fetchMock = mockTreatmentSummaryFetch([
      treatmentSummariesResponse([]),
      treatmentSummariesResponse([treatmentSummaryRecord]),
    ]);
    render(<TreatmentSummaryManagementShell />);

    expect(await screen.findByText('暂无治疗摘要')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('客户 ID'), {
      target: { value: 'cust_phase14_main' },
    });
    fireEvent.change(screen.getByLabelText('治疗项目'), {
      target: { value: 'Phase14 光电修复' },
    });
    fireEvent.change(screen.getByLabelText('风险等级'), { target: { value: 'watch' } });
    fireEvent.change(screen.getByLabelText('开始时间'), {
      target: { value: '2026-06-01T00:00' },
    });
    fireEvent.change(screen.getByLabelText('结束时间'), {
      target: { value: '2026-06-03T23:59' },
    });
    fireEvent.click(screen.getByRole('button', { name: '应用筛选' }));

    expect(await screen.findByText('Phase14 光电修复')).toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const filteredCall = fetchMock.mock.calls.find(([input]) =>
      fetchPath(input).startsWith('/api/institution/treatment-summaries?'),
    );
    expect(filteredCall).toBeDefined();
    const url = new URL(fetchPath(filteredCall![0]), 'http://localhost');

    expect(url.pathname).toBe('/api/institution/treatment-summaries');
    expect([...url.searchParams.keys()]).toEqual([
      'customerId',
      'treatmentProject',
      'riskLevel',
      'from',
      'to',
    ]);
    expect(url.searchParams.get('customerId')).toBe('cust_phase14_main');
    expect(url.searchParams.get('treatmentProject')).toBe('Phase14 光电修复');
    expect(url.searchParams.get('riskLevel')).toBe('watch');
    expect(url.searchParams.get('from')).toBeTruthy();
    expect(url.searchParams.get('to')).toBeTruthy();
    expect(url.searchParams.get('tenantId')).toBeNull();
  });

  it('支持加载更多并追加治疗摘要记录', async () => {
    const fetchMock = mockTreatmentSummaryFetch([
      treatmentSummariesResponse([treatmentSummaryRecord], {
        hasMore: true,
        limit: 1,
        nextCursor: 'cursor_phase14_next',
      }),
      treatmentSummariesResponse([secondTreatmentSummaryRecord], {
        hasMore: false,
        limit: 1,
        nextCursor: null,
      }),
    ]);
    render(<TreatmentSummaryManagementShell />);

    expect(await screen.findByText('Phase14 光电修复')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '加载更多治疗摘要' }));

    expect(await screen.findByText('Phase14 水光补水复诊')).toBeInTheDocument();
    const loadMoreCall = fetchMock.mock.calls.find(([input]) =>
      fetchPath(input).includes('cursor=cursor_phase14_next'),
    );
    expect(loadMoreCall).toBeDefined();
    expect(fetchPath(loadMoreCall![0])).not.toContain('tenantId');
  });

  it('安全详情只展示列表 DTO 字段', async () => {
    const fetchMock = mockTreatmentSummaryFetch([
      treatmentSummariesResponse([treatmentSummaryRecord]),
    ]);
    const { container } = render(<TreatmentSummaryManagementShell />);

    expect(await screen.findByText('Phase14 光电修复')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '查看安全详情 trt_phase14_main' }));

    const dialog = await screen.findByRole('dialog', { name: '治疗摘要安全详情' });
    expect(within(dialog).getByText('安全详情')).toBeInTheDocument();
    expect(within(dialog).getAllByText('Phase14 光电修复').length).toBeGreaterThan(0);
    expect(within(dialog).getByText('客户 ID')).toBeInTheDocument();
    expect(within(dialog).getByText('cust_phase14_main')).toBeInTheDocument();
    expect(within(dialog).getByText('预约 ID')).toBeInTheDocument();
    expect(within(dialog).getByText('appt_phase14_main')).toBeInTheDocument();
    expect(within(dialog).getByText('下一步护理建议')).toBeInTheDocument();
    expectNoSensitiveTreatmentSummaryContent(container);

    fireEvent.click(within(dialog).getByRole('button', { name: '关闭安全详情' }));
    expect(screen.queryByRole('dialog', { name: '治疗摘要安全详情' })).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalled();
  });

  it('安全详情展示编辑入口并打开只含白名单字段的受控表单', async () => {
    const fetchMock = mockTreatmentSummaryFetch([
      treatmentSummariesResponse([treatmentSummaryRecord]),
    ]);
    const { container } = render(<TreatmentSummaryManagementShell />);

    expect(await screen.findByText('Phase14 光电修复')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '查看安全详情 trt_phase14_main' }));

    const dialog = await screen.findByRole('dialog', { name: '治疗摘要安全详情' });
    fireEvent.click(within(dialog).getByRole('button', { name: '编辑治疗摘要' }));

    expect(within(dialog).getByRole('form', { name: '编辑治疗摘要表单' })).toBeInTheDocument();
    expect(within(dialog).getByLabelText('治疗时间')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('治疗项目')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('治疗类别')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('治疗阶段')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('恢复阶段')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('风险等级')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('负责人 ID')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('摘要')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('下一步护理建议')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('标签')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('预约 ID')).toBeInTheDocument();
    expect(
      within(dialog).getByText('编辑治疗摘要不会自动修改既有随访任务，也不会重新生成随访建议。'),
    ).toBeInTheDocument();

    const dialogText = dialog.textContent ?? '';
    expect(dialogText).not.toContain('tenantId');
    expect(dialogText).not.toContain('customerId 可编辑');
    expect(dialogText).not.toContain('完整治疗记录正文');
    expect(dialogText).not.toContain('完整病历正文');
    expect(dialogText).not.toContain('咨询对话全文');
    expect(dialogText).not.toContain('图片上传');
    expect(dialogText).not.toContain('文件上传');
    expect(dialogText).not.toContain('AI 生成');
    expect(screen.queryByRole('button', { name: /删除|批量作废/u })).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalled();
    expectNoSensitiveTreatmentSummaryContent(container);
  });

  it('提交编辑时调用 PATCH 白名单 payload，成功后刷新列表和当前详情', async () => {
    const fetchMock = mockTreatmentSummaryFetch(
      [
        treatmentSummariesResponse([treatmentSummaryRecord]),
        treatmentSummariesResponse([updatedTreatmentSummaryRecord]),
      ],
      {
        updateTreatmentSummaryResponses: [
          jsonResponse({ record: updatedTreatmentSummaryRecord }),
        ],
      },
    );
    const { container } = render(<TreatmentSummaryManagementShell />);

    expect(await screen.findByText('Phase14 光电修复')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '查看安全详情 trt_phase14_main' }));
    const dialog = await screen.findByRole('dialog', { name: '治疗摘要安全详情' });
    fireEvent.click(within(dialog).getByRole('button', { name: '编辑治疗摘要' }));

    fireEvent.change(within(dialog).getByLabelText('治疗时间'), {
      target: { value: '2026-06-03T10:00' },
    });
    fireEvent.change(within(dialog).getByLabelText('治疗项目'), {
      target: { value: 'Phase18 光电修复更新' },
    });
    fireEvent.change(within(dialog).getByLabelText('治疗类别'), {
      target: { value: 'phase18_skin_repair' },
    });
    fireEvent.change(within(dialog).getByLabelText('治疗阶段'), {
      target: { value: 'Phase18 D21 复诊' },
    });
    fireEvent.change(within(dialog).getByLabelText('恢复阶段'), {
      target: { value: 'Phase18 D21' },
    });
    fireEvent.change(within(dialog).getByLabelText('风险等级'), {
      target: { value: 'normal' },
    });
    fireEvent.change(within(dialog).getByLabelText('负责人 ID'), {
      target: { value: 'doctor-phase18' },
    });
    fireEvent.change(within(dialog).getByLabelText('摘要'), {
      target: { value: 'Phase18 结构化摘要更新：恢复稳定。' },
    });
    fireEvent.change(within(dialog).getByLabelText('下一步护理建议'), {
      target: { value: 'Phase18 D28 人工确认恢复阶段。' },
    });
    fireEvent.change(within(dialog).getByLabelText('标签'), {
      target: { value: 'Phase18 编辑，稳定，Phase18 编辑' },
    });
    fireEvent.change(within(dialog).getByLabelText('预约 ID'), {
      target: { value: 'appt_phase18_update' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: '保存编辑' }));

    expect(await within(dialog).findByText('治疗摘要已更新')).toBeInTheDocument();
    expect((await screen.findAllByText('Phase18 光电修复更新')).length).toBeGreaterThan(1);
    expect(within(dialog).getAllByText('Phase18 光电修复更新').length).toBeGreaterThan(0);
    expect(within(dialog).getAllByText('Phase18 结构化摘要更新：恢复稳定。').length).toBeGreaterThan(
      1,
    );

    const patchCall = fetchMock.mock.calls.find(
      ([input, init]) =>
        fetchPath(input) === '/api/institution/treatment-summaries/trt_phase14_main' &&
        init?.method === 'PATCH',
    );
    expect(patchCall).toBeDefined();
    expect(requestBody(patchCall?.[1])).toEqual({
      treatmentDate: '2026-06-03T10:00:00+08:00',
      treatmentProject: 'Phase18 光电修复更新',
      treatmentCategory: 'phase18_skin_repair',
      treatmentStage: 'Phase18 D21 复诊',
      recoveryStage: 'Phase18 D21',
      riskLevel: 'normal',
      ownerUserId: 'doctor-phase18',
      summary: 'Phase18 结构化摘要更新：恢复稳定。',
      nextCareAction: 'Phase18 D28 人工确认恢复阶段。',
      tags: ['Phase18 编辑', '稳定'],
      appointmentId: 'appt_phase18_update',
    });

    const serializedBody = JSON.stringify(requestBody(patchCall?.[1]));
    expect(serializedBody).not.toContain('tenantId');
    expect(serializedBody).not.toContain('customerId');
    expect(serializedBody).not.toContain('createdAt');
    expect(serializedBody).not.toContain('updatedAt');
    expect(serializedBody).not.toContain('unknownField');
    expect(serializedBody).not.toContain('完整治疗记录正文');
    expect(serializedBody).not.toContain('完整病历正文');
    expect(serializedBody).not.toContain('咨询对话全文');
    expect(serializedBody).not.toContain('13800001252');
    expect(serializedBody).not.toContain('110101199001010011');
    expect(serializedBody).not.toContain('MR202605310001');
    expect(serializedBody).not.toContain('imageUrl');
    expect(serializedBody).not.toContain('fileUrl');
    expect(serializedBody).not.toContain('aiGeneratedContent');
    expect(serializedBody).not.toContain('externalSystemPayload');
    expect(serializedBody).not.toContain('sql');
    expect(serializedBody).not.toContain('stack');
    expect(serializedBody).not.toContain('token');
    expect(serializedBody).not.toContain('secret');
    expect(serializedBody).not.toContain('DATABASE_URL');

    const listCalls = fetchMock.mock.calls.filter(
      ([input, init]) =>
        fetchPath(input) === '/api/institution/treatment-summaries' &&
        init?.method === undefined,
    );
    expect(listCalls).toHaveLength(2);
    const paths = fetchMock.mock.calls.map(([input]) => fetchPath(input));
    expect(paths.some((path) => path.endsWith('/follow-up-tasks'))).toBe(false);
    expect(paths.some((path) => path.endsWith('/follow-up-suggestions'))).toBe(false);
    expectNoSensitiveTreatmentSummaryContent(container);
  });

  it.each([
    [400, '字段非法，请检查治疗摘要编辑内容'],
    [401, '请先登录'],
    [403, '当前账号没有编辑治疗摘要的权限'],
    [404, '治疗摘要不存在或不可见'],
    [409, 'appointmentId 归属不合法，请选择同客户预约'],
    [503, '数据服务暂时不可用'],
  ])('编辑失败时展示 %s 稳定错误并保留输入', async (status, visibleMessage) => {
    const fetchMock = mockTreatmentSummaryFetch(
      [treatmentSummariesResponse([treatmentSummaryRecord])],
      {
        updateTreatmentSummaryResponses: [
          jsonResponse(
            {
              error:
                status === 503
                  ? 'DATABASE_URL=postgres://tenant:secret@localhost:5432/zmtg sql stack token secret'
                  : visibleMessage,
            },
            { status },
          ),
        ],
      },
    );
    const { container } = render(<TreatmentSummaryManagementShell />);

    expect(await screen.findByText('Phase14 光电修复')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '查看安全详情 trt_phase14_main' }));
    const dialog = await screen.findByRole('dialog', { name: '治疗摘要安全详情' });
    fireEvent.click(within(dialog).getByRole('button', { name: '编辑治疗摘要' }));

    const summaryInput = within(dialog).getByLabelText('摘要');
    fireEvent.change(summaryInput, {
      target: { value: `Phase18 失败后保留输入 ${status}` },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: '保存编辑' }));

    expect(await within(dialog).findByText(visibleMessage)).toBeInTheDocument();
    expect(summaryInput).toHaveValue(`Phase18 失败后保留输入 ${status}`);

    const text = container.textContent ?? '';
    expect(text).not.toContain('DATABASE_URL');
    expect(text).not.toContain('postgres://');
    expect(text).not.toContain('sql stack');
    expect(text).not.toContain('token');
    expect(text).not.toContain('secret');
    expectNoSensitiveTreatmentSummaryContent(container);
    expect(fetchMock).toHaveBeenCalled();
  });

  it('作废入口只发送短原因白名单 payload，成功后刷新列表和当前详情', async () => {
    const sourceTaskFromVoidedSummary = {
      ...createdFollowUpTask,
      status: 'scheduled',
      source: 'treatment_summary',
      sourceTreatmentSummaryId: 'trt_phase14_main',
      sourceSuggestionKey: 'trt_phase14_main:watch_risk_followup:3d',
    };
    const fetchMock = mockTreatmentSummaryFetch(
      [
        treatmentSummariesResponse([treatmentSummaryRecord]),
        treatmentSummariesResponse([voidedTreatmentSummaryAfterMutation]),
      ],
      {
        voidTreatmentSummaryResponses: [
          jsonResponse({ record: voidedTreatmentSummaryAfterMutation }),
        ],
        followUpListResponses: {
          '/api/institution/followups?source=treatment_summary&sourceTreatmentSummaryId=trt_phase14_main': [
            jsonResponse({ records: [sourceTaskFromVoidedSummary] }),
          ],
        },
      },
    );
    const { container } = render(<TreatmentSummaryManagementShell />);

    expect(await screen.findByText('Phase14 光电修复')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '查看安全详情 trt_phase14_main' }));
    const dialog = await screen.findByRole('dialog', { name: '治疗摘要安全详情' });
    fireEvent.click(within(dialog).getByRole('button', { name: '作废治疗摘要' }));

    expect(within(dialog).getByRole('form', { name: '作废治疗摘要表单' })).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText('作废原因分类'), {
      target: { value: 'duplicate_summary' },
    });
    fireEvent.change(within(dialog).getByLabelText('作废原因说明'), {
      target: { value: '重复录入，保留较新的治疗摘要' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: '确认作废' }));

    expect(await within(dialog).findByText('治疗摘要已作废')).toBeInTheDocument();
    expect(within(dialog).getAllByText('已作废').length).toBeGreaterThan(0);
    expect(within(dialog).getByText('作废时间')).toBeInTheDocument();
    expect(within(dialog).getAllByText('2026-06-02 19:00').length).toBeGreaterThan(0);
    expect(
      await within(dialog).findByText('来源治疗摘要已作废'),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText('既有来源随访任务仍保留，不会自动取消或修改任务状态。'),
    ).toBeInTheDocument();

    const voidCall = fetchMock.mock.calls.find(([input, init]) =>
      fetchPath(input).endsWith('/void') && init?.method === 'POST',
    );
    expect(voidCall).toBeDefined();
    expect(fetchPath(voidCall![0])).toBe(
      '/api/institution/treatment-summaries/trt_phase14_main/void',
    );
    expect(requestBody(voidCall![1])).toEqual({
      reasonCode: 'duplicate_summary',
      reasonText: '重复录入，保留较新的治疗摘要',
    });
    const serializedBody = JSON.stringify(requestBody(voidCall![1]));
    expect(serializedBody).not.toContain('tenantId');
    expect(serializedBody).not.toContain('完整治疗记录正文');
    expect(serializedBody).not.toContain('完整病历正文');
    expect(serializedBody).not.toContain('咨询对话全文');
    expect(serializedBody).not.toContain('13800001252');
    expect(serializedBody).not.toContain('110101199001010011');
    expect(serializedBody).not.toContain('MR202605310001');
    expect(serializedBody).not.toContain('imageUrl');
    expect(serializedBody).not.toContain('fileUrl');
    expect(serializedBody).not.toContain('sql');
    expect(serializedBody).not.toContain('stack');
    expect(serializedBody).not.toContain('token');
    expect(serializedBody).not.toContain('secret');
    expect(serializedBody).not.toContain('DATABASE_URL');

    const requestPaths = fetchMock.mock.calls.map(([input]) => fetchPath(input));
    expect(requestPaths.filter((path) => path === '/api/institution/treatment-summaries')).toHaveLength(2);
    expect(requestPaths.some((path) => path.endsWith('/follow-up-suggestions'))).toBe(false);
    expect(requestPaths.some((path) => path.endsWith('/follow-up-tasks'))).toBe(false);
    expectNoSensitiveTreatmentSummaryContent(container);
  });

  it.each([
    [400, '字段非法，请检查作废原因'],
    [401, '请先登录'],
    [403, '当前账号没有作废治疗摘要的权限'],
    [404, '治疗摘要不存在或不可见'],
    [409, '治疗摘要已作废'],
    [503, '数据服务暂时不可用'],
  ])('作废失败时展示 %s 稳定错误并保留输入', async (status, visibleMessage) => {
    const fetchMock = mockTreatmentSummaryFetch(
      [treatmentSummariesResponse([treatmentSummaryRecord])],
      {
        voidTreatmentSummaryResponses: [
          jsonResponse(
            {
              error:
                status === 503
                  ? 'DATABASE_URL=postgres://tenant:secret@localhost:5432/zmtg sql stack token secret'
                  : visibleMessage,
            },
            { status },
          ),
        ],
      },
    );
    const { container } = render(<TreatmentSummaryManagementShell />);

    expect(await screen.findByText('Phase14 光电修复')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '查看安全详情 trt_phase14_main' }));
    const dialog = await screen.findByRole('dialog', { name: '治疗摘要安全详情' });
    fireEvent.click(within(dialog).getByRole('button', { name: '作废治疗摘要' }));

    const reasonInput = within(dialog).getByLabelText('作废原因说明');
    fireEvent.change(reasonInput, {
      target: { value: `作废失败后保留输入 ${status}` },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: '确认作废' }));

    expect(await within(dialog).findByText(visibleMessage)).toBeInTheDocument();
    expect(reasonInput).toHaveValue(`作废失败后保留输入 ${status}`);
    const text = container.textContent ?? '';
    expect(text).not.toContain('DATABASE_URL');
    expect(text).not.toContain('postgres://');
    expect(text).not.toContain('sql stack');
    expect(text).not.toContain('token');
    expect(text).not.toContain('secret');
    expectNoSensitiveTreatmentSummaryContent(container);
    expect(fetchMock).toHaveBeenCalled();
  });

  it('已作废摘要阻断随访建议和来源任务创建，且不调用建议或创建任务 API', async () => {
    const sourceTaskFromVoidedSummary = {
      ...createdFollowUpTask,
      status: 'in_progress',
      source: 'treatment_summary',
      sourceTreatmentSummaryId: 'trt_phase19_voided',
      sourceSuggestionKey: 'trt_phase19_voided:watch_risk_followup:3d',
    };
    const fetchMock = mockTreatmentSummaryFetch(
      [treatmentSummariesResponse([voidedTreatmentSummaryRecord])],
      {
        followUpSuggestionResponses: [jsonResponse({ suggestions: [followUpSuggestion] })],
        followUpTaskResponses: [jsonResponse({ record: createdFollowUpTask }, { status: 201 })],
        followUpListResponses: {
          '/api/institution/followups?source=treatment_summary&sourceTreatmentSummaryId=trt_phase19_voided': [
            jsonResponse({ records: [sourceTaskFromVoidedSummary] }),
          ],
        },
      },
    );
    const { container } = render(<TreatmentSummaryManagementShell />);

    expect(await screen.findByText('Phase19 已作废治疗摘要')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '查看安全详情 trt_phase19_voided' }));
    const dialog = await screen.findByRole('dialog', { name: '治疗摘要安全详情' });

    expect(await within(dialog).findByText('来源治疗摘要已作废')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: '查看随访建议' }));

    expect(
      within(dialog).getByText('治疗摘要已作废，不能继续生成随访建议或来源随访任务。'),
    ).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: '确认创建随访任务' })).not.toBeInTheDocument();

    const requestPaths = fetchMock.mock.calls.map(([input]) => fetchPath(input));
    expect(requestPaths).toContain(
      '/api/institution/followups?source=treatment_summary&sourceTreatmentSummaryId=trt_phase19_voided',
    );
    expect(requestPaths.some((path) => path.endsWith('/follow-up-suggestions'))).toBe(false);
    expect(requestPaths.some((path) => path.endsWith('/follow-up-tasks'))).toBe(false);
    expect(container.textContent ?? '').not.toContain('自动触达');
    expectNoSensitiveTreatmentSummaryContent(container);
  });

  it('安全详情中可查看随访建议并人工确认创建任务', async () => {
    const fetchMock = mockTreatmentSummaryFetch(
      [treatmentSummariesResponse([treatmentSummaryRecord])],
      {
        followUpSuggestionResponses: [jsonResponse({ suggestions: [followUpSuggestion] })],
        followUpTaskResponses: [jsonResponse({ record: createdFollowUpTask }, { status: 201 })],
      },
    );
    const { container } = render(<TreatmentSummaryManagementShell />);

    expect(await screen.findByText('Phase14 光电修复')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '查看安全详情 trt_phase14_main' }));
    const dialog = await screen.findByRole('dialog', { name: '治疗摘要安全详情' });

    fireEvent.click(within(dialog).getByRole('button', { name: '查看随访建议' }));

    expect(await within(dialog).findByText('关注风险治疗后随访')).toBeInTheDocument();
    expect(
      within(dialog).getByText('建议仅供机构内部参考，需要人工确认后才会创建内部随访任务。'),
    ).toBeInTheDocument();
    expect(
      within(dialog).getAllByText('建议 key 用于来源追踪和避免重复创建。').length,
    ).toBeGreaterThan(0);
    expect(within(dialog).getByText('请安排人工随访，确认恢复反馈和护理执行情况。')).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: '确认创建随访任务' }));

    expect(await within(dialog).findByText('已创建内部随访任务')).toBeInTheDocument();
    const suggestionCall = fetchMock.mock.calls.find(([input]) =>
      fetchPath(input).endsWith('/follow-up-suggestions'),
    );
    const createCall = fetchMock.mock.calls.find(([input]) =>
      fetchPath(input).endsWith('/follow-up-tasks'),
    );
    expect(suggestionCall).toBeDefined();
    expect(createCall).toBeDefined();
    expect(fetchPath(suggestionCall![0])).toBe(
      '/api/institution/treatment-summaries/trt_phase14_main/follow-up-suggestions',
    );
    expect(fetchPath(createCall![0])).toBe(
      '/api/institution/treatment-summaries/trt_phase14_main/follow-up-tasks',
    );
    expect(createCall![1]).toEqual(
      expect.objectContaining({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ suggestionKey: 'trt_phase14_main:watch_risk_followup:3d' }),
      }),
    );
    expectNoSensitiveTreatmentSummaryContent(container);
  });

  it('重复确认随访任务时展示稳定冲突提示', async () => {
    const fetchMock = mockTreatmentSummaryFetch(
      [treatmentSummariesResponse([treatmentSummaryRecord])],
      {
        followUpSuggestionResponses: [jsonResponse({ suggestions: [followUpSuggestion] })],
        followUpTaskResponses: [
          jsonResponse({ error: '该护理随访任务已存在，请勿重复创建' }, { status: 409 }),
        ],
      },
    );
    render(<TreatmentSummaryManagementShell />);

    expect(await screen.findByText('Phase14 光电修复')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '查看安全详情 trt_phase14_main' }));
    const dialog = await screen.findByRole('dialog', { name: '治疗摘要安全详情' });
    fireEvent.click(within(dialog).getByRole('button', { name: '查看随访建议' }));
    expect(await within(dialog).findByText('关注风险治疗后随访')).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: '确认创建随访任务' }));

    expect(
      await within(dialog).findByText('该护理随访任务已存在，请勿重复创建'),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalled();
  });

  it('加载建议后展示同来源活跃随访任务只读提示且不会自动创建或触达', async () => {
    const activeSourceTask = {
      ...createdFollowUpTask,
      status: 'in_progress',
      source: 'treatment_summary',
      sourceTreatmentSummaryId: 'trt_phase14_main',
      sourceSuggestionKey: 'trt_phase14_main:watch_risk_followup:3d',
    };
    const fetchMock = mockTreatmentSummaryFetch(
      [treatmentSummariesResponse([treatmentSummaryRecord])],
      {
        followUpSuggestionResponses: [jsonResponse({ suggestions: [followUpSuggestion] })],
        followUpListResponses: {
          '/api/institution/followups?source=treatment_summary&sourceTreatmentSummaryId=trt_phase14_main': [
            jsonResponse({ records: [activeSourceTask] }),
          ],
        },
      },
    );
    const { container } = render(<TreatmentSummaryManagementShell />);

    expect(await screen.findByText('Phase14 光电修复')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '查看安全详情 trt_phase14_main' }));
    const dialog = await screen.findByRole('dialog', { name: '治疗摘要安全详情' });

    fireEvent.click(within(dialog).getByRole('button', { name: '查看随访建议' }));

    expect(await within(dialog).findByText('关注风险治疗后随访')).toBeInTheDocument();
    expect(
      within(dialog).getByText('该建议已有进行中的随访任务，请在智能随访中继续处理。'),
    ).toBeInTheDocument();
    expect(
      within(dialog).getAllByText('建议 key 用于来源追踪和避免重复创建。').length,
    ).toBeGreaterThan(0);
    expect(within(dialog).getByText('活跃任务状态：处理中')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: '已存在活跃随访任务' })).toBeDisabled();

    const requestPaths = fetchMock.mock.calls.map(([input]) => fetchPath(input));
    expect(requestPaths).toContain(
      '/api/institution/followups?source=treatment_summary&sourceTreatmentSummaryId=trt_phase14_main',
    );
    expect(requestPaths.join('\n')).not.toContain('tenantId');
    expect(requestPaths.some((path) => path.endsWith('/follow-up-tasks'))).toBe(false);

    const text = container.textContent ?? '';
    expect(text).not.toContain('自动发送微信');
    expect(text).not.toContain('自动短信');
    expect(text).not.toContain('电话外呼');
    expect(text).not.toContain('自动触达');
    expectNoSensitiveTreatmentSummaryContent(container);
  });

  it('已完成或已取消的同来源任务不阻断人工确认创建', async () => {
    const completedSourceTask = {
      ...createdFollowUpTask,
      status: 'completed',
      source: 'treatment_summary',
      sourceTreatmentSummaryId: 'trt_phase14_main',
      sourceSuggestionKey: 'trt_phase14_main:watch_risk_followup:3d',
    };
    const fetchMock = mockTreatmentSummaryFetch(
      [treatmentSummariesResponse([treatmentSummaryRecord])],
      {
        followUpSuggestionResponses: [jsonResponse({ suggestions: [followUpSuggestion] })],
        followUpTaskResponses: [jsonResponse({ record: createdFollowUpTask }, { status: 201 })],
        followUpListResponses: {
          '/api/institution/followups?source=treatment_summary&sourceTreatmentSummaryId=trt_phase14_main': [
            jsonResponse({ records: [completedSourceTask] }),
          ],
        },
      },
    );
    render(<TreatmentSummaryManagementShell />);

    expect(await screen.findByText('Phase14 光电修复')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '查看安全详情 trt_phase14_main' }));
    const dialog = await screen.findByRole('dialog', { name: '治疗摘要安全详情' });
    fireEvent.click(within(dialog).getByRole('button', { name: '查看随访建议' }));

    expect(await within(dialog).findByText('关注风险治疗后随访')).toBeInTheDocument();
    expect(
      within(dialog).queryByText('该建议已有进行中的随访任务，请在智能随访中继续处理。'),
    ).not.toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: '确认创建随访任务' }));

    expect(await within(dialog).findByText('已创建内部随访任务')).toBeInTheDocument();
    const createCall = fetchMock.mock.calls.find(([input]) =>
      fetchPath(input).endsWith('/follow-up-tasks'),
    );
    expect(createCall).toBeDefined();
  });

  it('展示 loading 和 empty 状态', async () => {
    const deferred = deferredTreatmentSummaryResponse();
    const fetchMock = vi.fn(async () => deferred.promise);
    vi.stubGlobal('fetch', fetchMock);
    render(<TreatmentSummaryManagementShell />);

    expect(screen.getByText('正在加载治疗摘要...')).toBeInTheDocument();
    deferred.resolve(treatmentSummariesResponse([]));

    expect(await screen.findByText('暂无治疗摘要')).toBeInTheDocument();
    expect(screen.getByText('当前筛选条件下没有可用于运营复盘的治疗摘要。')).toBeInTheDocument();
  });

  it.each([
    [403, '没有访问权限', '当前账号没有查看治疗摘要的权限'],
    [503, '数据服务暂时不可用', '治疗摘要数据暂时不可用'],
  ])('展示 %s 错误状态', async (status, apiMessage, visibleMessage) => {
    const fetchMock = mockTreatmentSummaryFetch([
      jsonResponse({ error: apiMessage }, { status }),
    ]);
    const { container } = render(<TreatmentSummaryManagementShell />);

    expect(await screen.findByText(visibleMessage)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/institution/treatment-summaries', {
      cache: 'no-store',
    });
    expectNoSensitiveTreatmentSummaryContent(container);
  });
});
