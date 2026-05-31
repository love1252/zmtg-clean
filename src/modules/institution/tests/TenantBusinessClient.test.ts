import { describe, expect, it, vi } from 'vitest';
import {
  createAppointment,
  createCustomer,
  getCustomerTimeline,
  listAppointments,
  listCustomers,
  listFollowUpTasks,
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
    const followUpTransitionFetcher = createFetchMock(
      jsonResponse({ record: { id: 'fu_001', tenantId: 'demo-tenant-001', status: 'in_progress' } }),
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
    await transitionFollowUpTask(
      {
        id: 'fu_001',
        nextStatus: 'in_progress',
        tenantId: 'other-tenant',
        consultationTranscript: '咨询对话正文',
      } as never,
      { fetcher: followUpTransitionFetcher },
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
    expect(followUpTransitionFetcher).toHaveBeenCalledWith('/api/institution/followups', expect.objectContaining({
      method: 'PATCH',
    }));

    const serializedBodies = [
      requestBody(customerCreateFetcher),
      requestBody(customerUpdateFetcher),
      requestBody(appointmentCreateFetcher),
      requestBody(appointmentUpdateFetcher),
      requestBody(followUpTransitionFetcher),
    ].map((body) => JSON.stringify(body));

    for (const serializedBody of serializedBodies) {
      expect(serializedBody).not.toContain('tenantId');
      expect(serializedBody).not.toContain('phoneNumber');
      expect(serializedBody).not.toContain('idNumber');
      expect(serializedBody).not.toContain('medicalRecordNo');
      expect(serializedBody).not.toContain('treatmentRecord');
      expect(serializedBody).not.toContain('consultationTranscript');
      expect(serializedBody).not.toContain('rawPhone');
      expect(serializedBody).not.toContain('rawIdCard');
      expect(serializedBody).not.toContain('13800000000');
      expect(serializedBody).not.toContain('110101199001010011');
      expect(serializedBody).not.toContain('MR-RAW-001');
      expect(serializedBody).not.toContain('完整治疗记录正文');
      expect(serializedBody).not.toContain('咨询对话正文');
    }
  });
});
