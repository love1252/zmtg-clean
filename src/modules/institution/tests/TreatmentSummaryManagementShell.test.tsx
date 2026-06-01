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

function mockTreatmentSummaryFetch(
  responses: Response[],
  options: {
    followUpSuggestionResponses?: Response[];
    followUpTaskResponses?: Response[];
  } = {},
) {
  const queue = [...responses];
  const fallback = queue[queue.length - 1] ?? treatmentSummariesResponse([]);
  const suggestionQueue = [...(options.followUpSuggestionResponses ?? [])];
  const followUpTaskQueue = [...(options.followUpTaskResponses ?? [])];

  const fetchMock = vi.fn(
    async (input: Parameters<typeof fetch>[0], _init?: Parameters<typeof fetch>[1]) => {
      const path = fetchPath(input);
      if (path.includes('/follow-up-suggestions')) {
        return suggestionQueue.shift() ?? jsonResponse({ suggestions: [] });
      }

      if (path.includes('/follow-up-tasks')) {
        return followUpTaskQueue.shift() ?? jsonResponse({ error: '请求失败' }, { status: 503 });
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
    expect(screen.getByText('负责人：doctor-phase14')).toBeInTheDocument();
    expect(screen.getByText('摘要：Phase14 结构化摘要：恢复稳定，安排补水。')).toBeInTheDocument();
    expect(screen.getByText('下一步护理建议：Phase14 D21 人工回访恢复阶段。')).toBeInTheDocument();
    expect(screen.getByText('Phase14 结构化摘要')).toBeInTheDocument();
    expect(screen.getByText('复诊')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /新增|编辑|删除/u })).not.toBeInTheDocument();

    expect(fetchMock).toHaveBeenCalledWith('/api/institution/treatment-summaries', {
      cache: 'no-store',
    });
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

  it('展示 loading 和 empty 状态', async () => {
    const deferred = deferredTreatmentSummaryResponse();
    const fetchMock = vi.fn(async () => deferred.promise);
    vi.stubGlobal('fetch', fetchMock);
    render(<TreatmentSummaryManagementShell />);

    expect(screen.getByText('正在加载治疗摘要...')).toBeInTheDocument();
    deferred.resolve(treatmentSummariesResponse([]));

    expect(await screen.findByText('暂无治疗摘要')).toBeInTheDocument();
    expect(screen.getByText('当前筛选条件下没有可展示的治疗摘要。')).toBeInTheDocument();
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
