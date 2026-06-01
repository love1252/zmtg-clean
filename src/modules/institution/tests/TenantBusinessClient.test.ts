import { describe, expect, it, vi } from 'vitest';
import {
  createAppointment,
  createCustomer,
  createFollowUpTaskFromTreatmentSummary,
  createTreatmentSummary,
  getCustomerTimeline,
  listAppointments,
  listCustomers,
  listFollowUpTasks,
  listTreatmentFollowUpSuggestions,
  listTreatmentSummaries,
  transitionFollowUpTask,
  updateAppointment,
  updateCustomer,
} from '@/modules/institution/client/tenant-business-client';

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { 'content-type': 'application/json', ...init?.headers },
  });
}

function createFetchMock(response: Response) {
  return vi.fn(async () => response) as unknown as typeof fetch;
}

function requestBody(fetcher: typeof fetch) {
  const [, init] = vi.mocked(fetcher).mock.calls[0] ?? [];
  return JSON.parse(String(init?.body)) as Record<string, unknown>;
}

function requestPath(fetcher: typeof fetch) {
  const [input] = vi.mocked(fetcher).mock.calls[0] ?? [];
  return String(input);
}

describe('机构业务页面 client helper', () => {
  it('解析客户、预约和随访列表 records 响应', async () => {
    const customerFetcher = createFetchMock(
      jsonResponse({ records: [{ id: 'cust_001', tenantId: 'demo-tenant-001', displayName: '王女士' }] }),
    );
    const appointmentFetcher = createFetchMock(
      jsonResponse({ records: [{ id: 'appt_001', tenantId: 'demo-tenant-001', customerId: 'cust_001' }] }),
    );
    const followUpFetcher = createFetchMock(
      jsonResponse({ records: [{ id: 'fu_001', tenantId: 'demo-tenant-001', status: 'due' }] }),
    );

    await expect(listCustomers({ fetcher: customerFetcher })).resolves.toEqual({
      ok: true,
      records: [{ id: 'cust_001', tenantId: 'demo-tenant-001', displayName: '王女士' }],
    });
    await expect(listAppointments({ fetcher: appointmentFetcher })).resolves.toEqual({
      ok: true,
      records: [{ id: 'appt_001', tenantId: 'demo-tenant-001', customerId: 'cust_001' }],
    });
    await expect(listFollowUpTasks({ fetcher: followUpFetcher })).resolves.toEqual({
      ok: true,
      records: [{ id: 'fu_001', tenantId: 'demo-tenant-001', status: 'due' }],
    });
    expect(customerFetcher).toHaveBeenCalledWith('/api/institution/customers', {
      cache: 'no-store',
    });
    expect(appointmentFetcher).toHaveBeenCalledWith('/api/institution/appointments', {
      cache: 'no-store',
    });
    expect(followUpFetcher).toHaveBeenCalledWith('/api/institution/followups', {
      cache: 'no-store',
    });
  });

  it('读取治疗摘要列表时只发送白名单 query 并解析分页信息', async () => {
    const fetcher = createFetchMock(
      jsonResponse({
        records: [
          {
            id: 'trt_001',
            customerId: 'cust_001',
            appointmentId: 'appt_001',
            treatmentDate: '2026-06-02T16:30:00+08:00',
            treatmentProject: '水光补水复诊',
            treatmentCategory: 'skin_repair',
            treatmentStage: 'D14 复诊',
            recoveryStage: 'D14',
            riskLevel: 'watch',
            ownerUserId: 'doctor-lin',
            summary: '结构化摘要：恢复稳定，安排补水。',
            nextCareAction: 'D21 人工回访恢复阶段。',
            tags: ['结构化摘要', '复诊'],
            createdAt: '2026-06-02T16:30:00+08:00',
            updatedAt: '2026-06-02T16:30:00+08:00',
          },
        ],
        pageInfo: {
          hasMore: true,
          limit: 25,
          nextCursor: 'cursor_next',
        },
      }),
    );

    const result = await listTreatmentSummaries(
      {
        customerId: 'cust_001',
        treatmentProject: '水光补水复诊',
        riskLevel: 'watch',
        from: '2026-06-01T00:00:00.000Z',
        to: '2026-06-03T00:00:00.000Z',
        limit: 25,
        cursor: 'cursor_current',
        tenantId: 'other-tenant',
        sql: 'select * from treatment_summaries',
      } as never,
      { fetcher },
    );

    expect(result).toEqual({
      ok: true,
      records: [
        expect.objectContaining({
          id: 'trt_001',
          customerId: 'cust_001',
          treatmentProject: '水光补水复诊',
          riskLevel: 'watch',
        }),
      ],
      pageInfo: {
        hasMore: true,
        limit: 25,
        nextCursor: 'cursor_next',
      },
    });
    expect(fetcher).toHaveBeenCalledWith(
      expect.stringContaining('/api/institution/treatment-summaries?'),
      { cache: 'no-store' },
    );

    const url = new URL(requestPath(fetcher), 'http://localhost');
    expect(url.pathname).toBe('/api/institution/treatment-summaries');
    expect([...url.searchParams.keys()]).toEqual([
      'customerId',
      'treatmentProject',
      'riskLevel',
      'from',
      'to',
      'limit',
      'cursor',
    ]);
    expect(url.searchParams.get('customerId')).toBe('cust_001');
    expect(url.searchParams.get('treatmentProject')).toBe('水光补水复诊');
    expect(url.searchParams.get('riskLevel')).toBe('watch');
    expect(url.searchParams.get('limit')).toBe('25');
    expect(url.searchParams.get('tenantId')).toBeNull();
    expect(url.searchParams.get('sql')).toBeNull();
  });

  it('读取随访来源列表时只发送 source 白名单 query', async () => {
    const fetcher = createFetchMock(
      jsonResponse({
        records: [
          {
            id: 'fu_from_summary',
            customerId: 'cust_001',
            customerDisplayName: '王女士',
            journeyId: 'treatment_followup_watch_risk_followup',
            stage: '关注风险治疗后随访',
            status: 'scheduled',
            dueAt: '2026-06-05T08:30:00.000Z',
            suggestedAction: '人工确认恢复情况',
            riskLevel: 'watch',
            updatedBy: null,
            updatedAt: null,
            source: 'treatment_summary',
            sourceTreatmentSummaryId: 'trt_001',
            sourceSuggestionKey: 'trt_001:watch_risk_followup:3d',
          },
        ],
      }),
    );

    const result = await listFollowUpTasks(
      {
        source: 'treatment_summary',
        sourceTreatmentSummaryId: 'trt_001',
        tenantId: 'other-tenant',
        sql: 'select * from follow_up_tasks',
        token: 'sk_test_should_not_send',
      } as never,
      { fetcher },
    );

    expect(result).toEqual({
      ok: true,
      records: [
        expect.objectContaining({
          id: 'fu_from_summary',
          source: 'treatment_summary',
          sourceTreatmentSummaryId: 'trt_001',
          sourceSuggestionKey: 'trt_001:watch_risk_followup:3d',
        }),
      ],
    });

    const url = new URL(requestPath(fetcher), 'http://localhost');
    expect(url.pathname).toBe('/api/institution/followups');
    expect([...url.searchParams.keys()]).toEqual(['source', 'sourceTreatmentSummaryId']);
    expect(url.searchParams.get('source')).toBe('treatment_summary');
    expect(url.searchParams.get('sourceTreatmentSummaryId')).toBe('trt_001');
    expect(url.searchParams.get('tenantId')).toBeNull();
    expect(url.searchParams.get('sql')).toBeNull();
    expect(url.searchParams.get('token')).toBeNull();
  });

  it('读取治疗摘要随访建议时只发送 summaryId 并解析 suggestions', async () => {
    const fetcher = createFetchMock(
      jsonResponse({
        suggestions: [
          {
            suggestionKey: 'trt_001:watch_risk_followup:3d',
            ruleKey: 'watch_risk_followup',
            title: '关注风险治疗后随访',
            description: '请安排人工随访，确认恢复反馈和护理执行情况。',
            recommendedDueAt: '2026-06-05T16:30:00.000Z',
            priority: 'medium',
            riskLevel: 'watch',
            sourceTreatmentSummaryId: 'trt_001',
            sourceCustomerId: 'cust_001',
            sourceAppointmentId: 'appt_001',
            tags: ['护理随访'],
            reason: 'riskLevel 为 watch，需要在观察周期内人工跟进',
            sourceFields: ['riskLevel', 'treatmentDate'],
          },
        ],
      }),
    );

    await expect(
      listTreatmentFollowUpSuggestions('trt_001', { fetcher }),
    ).resolves.toEqual({
      ok: true,
      suggestions: [
        expect.objectContaining({
          suggestionKey: 'trt_001:watch_risk_followup:3d',
          sourceTreatmentSummaryId: 'trt_001',
          sourceCustomerId: 'cust_001',
        }),
      ],
    });
    expect(fetcher).toHaveBeenCalledWith(
      '/api/institution/treatment-summaries/trt_001/follow-up-suggestions',
      { cache: 'no-store' },
    );
    expect(requestPath(fetcher)).not.toContain('tenantId');
  });

  it('读取客户详情 timeline 时只发送 GET 请求且不包含 tenantId', async () => {
    const timelineFetcher = createFetchMock(
      jsonResponse({
        customer: {
          id: 'cust_001',
          displayName: '王女士',
          lifecycle: 'repurchase_window',
          priority: 'high',
          projectInterest: '热玛吉修复组合',
          maskedPhone: '138****1208',
          maskedMedicalRecordNo: 'MR****001',
          ownerUserId: 'consultant-lin',
          tags: ['高价值'],
          lastTouchSummary: '术后第 28 天',
          nextAction: '安排资深咨询师人工回访',
        },
        appointments: [],
        followups: [],
        auditEvents: [],
        timeline: [],
      }),
    );

    await expect(getCustomerTimeline('cust_001', { fetcher: timelineFetcher })).resolves.toEqual({
      ok: true,
      timeline: expect.objectContaining({
        customer: expect.objectContaining({ id: 'cust_001', maskedPhone: '138****1208' }),
        appointments: [],
        followups: [],
        auditEvents: [],
        timeline: [],
      }),
    });

    expect(timelineFetcher).toHaveBeenCalledWith(
      '/api/institution/customers/cust_001/timeline',
      { cache: 'no-store' },
    );
    const [path, init] = vi.mocked(timelineFetcher).mock.calls[0] ?? [];
    expect(String(path)).not.toContain('tenantId');
    expect(init?.method).toBeUndefined();
    expect(init?.body).toBeUndefined();
  });

  it('治疗摘要列表错误响应保持稳定且不透出敏感细节', async () => {
    const forbiddenFetcher = createFetchMock(
      jsonResponse({ error: '没有访问权限' }, { status: 403 }),
    );
    const unavailableFetcher = createFetchMock(
      jsonResponse(
        {
          error:
            'DATABASE_URL=postgres://tenant:secret@localhost:5432/zmtg stack token secret select * from treatment_summaries',
        },
        { status: 503 },
      ),
    );

    await expect(listTreatmentSummaries({}, { fetcher: forbiddenFetcher })).resolves.toEqual({
      ok: false,
      error: {
        kind: 'forbidden',
        message: '没有访问权限',
        status: 403,
      },
    });

    const unavailableResult = await listTreatmentSummaries({}, { fetcher: unavailableFetcher });
    const serialized = JSON.stringify(unavailableResult);

    expect(unavailableResult).toEqual({
      ok: false,
      error: {
        kind: 'service_unavailable',
        message: '数据服务暂时不可用',
        status: 503,
      },
    });
    expect(serialized).not.toContain('DATABASE_URL');
    expect(serialized).not.toContain('postgres://');
    expect(serialized).not.toContain('select *');
    expect(serialized).not.toContain('stack');
    expect(serialized).not.toContain('token');
    expect(serialized).not.toContain('secret');
  });

  it('解析错误响应为稳定错误结构', async () => {
    const forbiddenFetcher = createFetchMock(
      jsonResponse({ error: '没有访问权限' }, { status: 403 }),
    );
    const unavailableFetcher = createFetchMock(
      jsonResponse({ error: '数据服务暂时不可用' }, { status: 503 }),
    );
    const invalidJsonFetcher = createFetchMock(new Response('bad-json', { status: 502 }));
    const timelineForbiddenFetcher = createFetchMock(
      jsonResponse({ error: '没有访问权限' }, { status: 403 }),
    );

    await expect(listCustomers({ fetcher: forbiddenFetcher })).resolves.toEqual({
      ok: false,
      error: {
        kind: 'forbidden',
        message: '没有访问权限',
        status: 403,
      },
    });
    await expect(listAppointments({ fetcher: unavailableFetcher })).resolves.toEqual({
      ok: false,
      error: {
        kind: 'service_unavailable',
        message: '数据服务暂时不可用',
        status: 503,
      },
    });
    await expect(listFollowUpTasks({ fetcher: invalidJsonFetcher })).resolves.toEqual({
      ok: false,
      error: {
        kind: 'unknown',
        message: '请求失败',
        status: 502,
      },
    });
    await expect(
      getCustomerTimeline('missing_customer', { fetcher: timelineForbiddenFetcher }),
    ).resolves.toEqual({
      ok: false,
      error: {
        kind: 'forbidden',
        message: '没有访问权限',
        status: 403,
      },
    });
  });

  it.each([
    [
      'quota_exceeded_customers',
      createCustomer,
      {
        displayName: '王女士',
        lifecycle: 'consulting',
        priority: 'high',
        ownerUserId: 'consultant-lin',
        projectInterest: '皮肤管理',
        maskedPhone: '138****0000',
        maskedMedicalRecordNo: 'MR****001',
        lastTouchSummary: '初次咨询',
        nextAction: '预约到店',
        tags: ['新客'],
      },
      '当前套餐的客户数量已达上限，请联系平台管理员调整套餐或配额。',
    ],
    [
      'quota_exceeded_appointments',
      createAppointment,
      {
        customerId: 'cust_001',
        customerDisplayName: '王女士',
        project: '皮肤管理',
        scheduledAt: '2026-06-01T10:30:00+08:00',
        consultantUserId: 'consultant-lin',
        status: 'pending_confirmation',
        note: '首次预约',
      },
      '当前套餐的预约数量已达上限，请联系平台管理员调整套餐或配额。',
    ],
    [
      'missing_active_plan',
      createCustomer,
      {
        displayName: '王女士',
        lifecycle: 'consulting',
        priority: 'high',
        ownerUserId: 'consultant-lin',
        projectInterest: '皮肤管理',
        maskedPhone: '138****0000',
        maskedMedicalRecordNo: 'MR****001',
        lastTouchSummary: '初次咨询',
        nextAction: '预约到店',
        tags: ['新客'],
      },
      '当前机构暂无有效套餐，暂不能新增数据，请联系平台管理员。',
    ],
    [
      'missing_quota_limit',
      createAppointment,
      {
        customerId: 'cust_001',
        customerDisplayName: '王女士',
        project: '皮肤管理',
        scheduledAt: '2026-06-01T10:30:00+08:00',
        consultantUserId: 'consultant-lin',
        status: 'pending_confirmation',
        note: '首次预约',
      },
      '当前机构套餐配额未配置完整，暂不能新增数据，请联系平台管理员。',
    ],
  ])('将套餐配额错误 %s 映射为安全中文提示', async (reason, mutation, payload, message) => {
    const fetcher = createFetchMock(
      jsonResponse(
        {
          error: `${reason} DATABASE_URL=postgres://tenant:secret@localhost:5432/zmtg stack token secret`,
        },
        { status: 409 },
      ),
    );

    const result = await mutation(payload as never, { fetcher });
    const serialized = JSON.stringify(result);

    expect(result).toEqual({
      ok: false,
      error: {
        kind: 'conflict',
        message,
        status: 409,
      },
    });
    expect(serialized).not.toContain(reason);
    expect(serialized).not.toContain('DATABASE_URL');
    expect(serialized).not.toContain('postgres://');
    expect(serialized).not.toContain('stack');
    expect(serialized).not.toContain('token');
    expect(serialized).not.toContain('secret');
  });

  it('封装所有写入 API 并只发送白名单字段', async () => {
    const customerCreateFetcher = createFetchMock(
      jsonResponse({ record: { id: 'cust_created', tenantId: 'demo-tenant-001' } }, { status: 201 }),
    );
    const customerUpdateFetcher = createFetchMock(
      jsonResponse({ record: { id: 'cust_001', tenantId: 'demo-tenant-001' } }),
    );
    const appointmentCreateFetcher = createFetchMock(
      jsonResponse({ record: { id: 'appt_created', tenantId: 'demo-tenant-001' } }, { status: 201 }),
    );
    const appointmentUpdateFetcher = createFetchMock(
      jsonResponse({ record: { id: 'appt_001', tenantId: 'demo-tenant-001' } }),
    );
    const treatmentSummaryCreateFetcher = createFetchMock(
      jsonResponse(
        { record: { id: 'trt_created', treatmentProject: '水光补水复诊' } },
        { status: 201 },
      ),
    );
    const followUpTransitionFetcher = createFetchMock(
      jsonResponse({ record: { id: 'fu_001', tenantId: 'demo-tenant-001', status: 'in_progress' } }),
    );
    const followUpConfirmFetcher = createFetchMock(
      jsonResponse(
        { record: { id: 'fu_created', sourceTreatmentSummaryId: 'trt_created' } },
        { status: 201 },
      ),
    );

    await expect(
      createCustomer(
        {
          displayName: '王女士',
          lifecycle: 'consulting',
          priority: 'high',
          ownerUserId: 'consultant-lin',
          projectInterest: '皮肤管理',
          maskedPhone: '138****0000',
          maskedMedicalRecordNo: 'MR****001',
          lastTouchSummary: '初次咨询',
          nextAction: '预约到店',
          tags: ['新客'],
          tenantId: 'other-tenant',
          phoneNumber: '13800000000',
          idNumber: '110101199001010011',
          medicalRecordNo: 'MR-RAW-001',
          treatmentRecord: '完整治疗记录正文',
          consultationTranscript: '咨询对话正文',
        } as never,
        { fetcher: customerCreateFetcher },
      ),
    ).resolves.toEqual({
      ok: true,
      record: { id: 'cust_created', tenantId: 'demo-tenant-001' },
    });

    await updateCustomer(
      {
        id: 'cust_001',
        nextAction: '安排人工回访',
        tenantId: 'other-tenant',
        rawPhone: '13800000000',
      } as never,
      { fetcher: customerUpdateFetcher },
    );
    await createAppointment(
      {
        customerId: 'cust_001',
        customerDisplayName: '王女士',
        project: '皮肤管理',
        scheduledAt: '2026-06-01T10:30:00+08:00',
        consultantUserId: 'consultant-lin',
        status: 'pending_confirmation',
        note: '首次预约',
        tenantId: 'other-tenant',
        phoneNumber: '13800000000',
        idNumber: '110101199001010011',
        medicalRecordNo: 'MR-RAW-001',
        treatmentRecord: '完整治疗记录正文',
        consultationTranscript: '咨询对话正文',
      } as never,
      { fetcher: appointmentCreateFetcher },
    );
    await updateAppointment(
      {
        id: 'appt_001',
        status: 'confirmed',
        note: '已确认',
        tenantId: 'other-tenant',
        rawIdCard: '110101199001010011',
      } as never,
      { fetcher: appointmentUpdateFetcher },
    );
    await createTreatmentSummary(
      'cust_001',
      {
        treatmentDate: '2026-06-02T16:30:00+08:00',
        treatmentProject: '水光补水复诊',
        treatmentCategory: 'skin_repair',
        treatmentStage: 'D14 复诊',
        recoveryStage: 'D14',
        riskLevel: 'watch',
        ownerUserId: 'doctor-lin',
        summary: '结构化摘要：恢复稳定，安排补水。',
        nextCareAction: 'D21 人工回访恢复阶段。',
        tags: ['结构化摘要', '复诊'],
        appointmentId: 'appt_001',
        tenantId: 'other-tenant',
        fullTreatmentRecord: '完整治疗记录正文',
        medicalRecordText: '完整病历正文',
        diagnosisText: '诊疗原文',
        consultationTranscript: '咨询对话全文',
        phoneNumber: '13800000000',
        idNumber: '110101199001010011',
        rawMedicalRecordNo: 'MR-RAW-001',
        imageUrl: 'https://example.test/raw-image.png',
        fileUrl: 'https://example.test/raw-file.pdf',
        aiGeneratedContent: 'AI 生成内容',
        externalSystemPayload: { raw: true },
      } as never,
      { fetcher: treatmentSummaryCreateFetcher },
    );
    await transitionFollowUpTask(
      {
        id: 'fu_001',
        nextStatus: 'in_progress',
        tenantId: 'other-tenant',
        consultationTranscript: '咨询对话正文',
      } as never,
      { fetcher: followUpTransitionFetcher },
    );
    await createFollowUpTaskFromTreatmentSummary(
      'trt_created',
      {
        suggestionKey: 'trt_created:watch_risk_followup:3d',
        tenantId: 'other-tenant',
        customerId: 'cust_001',
        dueAt: '2026-01-01T00:00:00.000Z',
        riskLevel: 'urgent',
        suggestedAction: '客户端不应提交完整建议',
        fullTreatmentRecord: '完整治疗记录正文',
        consultationTranscript: '咨询对话正文',
      } as never,
      { fetcher: followUpConfirmFetcher },
    );

    expect(customerCreateFetcher).toHaveBeenCalledWith('/api/institution/customers', expect.objectContaining({
      method: 'POST',
    }));
    expect(customerUpdateFetcher).toHaveBeenCalledWith('/api/institution/customers', expect.objectContaining({
      method: 'PATCH',
    }));
    expect(appointmentCreateFetcher).toHaveBeenCalledWith('/api/institution/appointments', expect.objectContaining({
      method: 'POST',
    }));
    expect(appointmentUpdateFetcher).toHaveBeenCalledWith('/api/institution/appointments', expect.objectContaining({
      method: 'PATCH',
    }));
    expect(treatmentSummaryCreateFetcher).toHaveBeenCalledWith(
      '/api/institution/customers/cust_001/treatment-summaries',
      expect.objectContaining({
        method: 'POST',
      }),
    );
    expect(followUpTransitionFetcher).toHaveBeenCalledWith('/api/institution/followups', expect.objectContaining({
      method: 'PATCH',
    }));
    expect(followUpConfirmFetcher).toHaveBeenCalledWith(
      '/api/institution/treatment-summaries/trt_created/follow-up-tasks',
      expect.objectContaining({
        method: 'POST',
      }),
    );

    expect(requestBody(treatmentSummaryCreateFetcher)).toEqual({
      treatmentDate: '2026-06-02T16:30:00+08:00',
      treatmentProject: '水光补水复诊',
      treatmentCategory: 'skin_repair',
      treatmentStage: 'D14 复诊',
      recoveryStage: 'D14',
      riskLevel: 'watch',
      ownerUserId: 'doctor-lin',
      summary: '结构化摘要：恢复稳定，安排补水。',
      nextCareAction: 'D21 人工回访恢复阶段。',
      tags: ['结构化摘要', '复诊'],
      appointmentId: 'appt_001',
    });
    expect(requestBody(followUpConfirmFetcher)).toEqual({
      suggestionKey: 'trt_created:watch_risk_followup:3d',
    });

    const serializedBodies = [
      requestBody(customerCreateFetcher),
      requestBody(customerUpdateFetcher),
      requestBody(appointmentCreateFetcher),
      requestBody(appointmentUpdateFetcher),
      requestBody(treatmentSummaryCreateFetcher),
      requestBody(followUpTransitionFetcher),
      requestBody(followUpConfirmFetcher),
    ].map((body) => JSON.stringify(body));

    for (const serializedBody of serializedBodies) {
      expect(serializedBody).not.toContain('tenantId');
      expect(serializedBody).not.toContain('phoneNumber');
      expect(serializedBody).not.toContain('idNumber');
      expect(serializedBody).not.toContain('medicalRecordNo');
      expect(serializedBody).not.toContain('treatmentRecord');
      expect(serializedBody).not.toContain('fullTreatmentRecord');
      expect(serializedBody).not.toContain('medicalRecordText');
      expect(serializedBody).not.toContain('diagnosisText');
      expect(serializedBody).not.toContain('consultationTranscript');
      expect(serializedBody).not.toContain('rawMedicalRecordNo');
      expect(serializedBody).not.toContain('imageUrl');
      expect(serializedBody).not.toContain('fileUrl');
      expect(serializedBody).not.toContain('aiGeneratedContent');
      expect(serializedBody).not.toContain('externalSystemPayload');
      expect(serializedBody).not.toContain('rawPhone');
      expect(serializedBody).not.toContain('rawIdCard');
      expect(serializedBody).not.toContain('13800000000');
      expect(serializedBody).not.toContain('110101199001010011');
      expect(serializedBody).not.toContain('MR-RAW-001');
      expect(serializedBody).not.toContain('完整治疗记录正文');
      expect(serializedBody).not.toContain('完整病历正文');
      expect(serializedBody).not.toContain('诊疗原文');
      expect(serializedBody).not.toContain('咨询对话正文');
      expect(serializedBody).not.toContain('咨询对话全文');
      expect(serializedBody).not.toContain('AI 生成内容');
    }
  });
});
