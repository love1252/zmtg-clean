import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InstitutionWorkspace } from '@/modules/workspace/components/InstitutionWorkspace';
import { WeComCustomerMappingCandidatesReadonlyPanel } from '@/modules/institution/components/WeComCustomerMappingCandidatesReadonlyPanel';

const responsePayload = {
  sourceKind: 'controlled_mock_fixture',
  dataMode: 'mock',
  mockDemo: true,
  readonly: true,
  mappingId: 'mock-wecom-mapping-pending-001',
  mappingVersion: 0,
  mappingReviewStatus: 'pending_review',
  authorizationStatus: 'authorized',
  providerStatus: 'mock_only',
  candidates: [{
    externalContactSummary: {
      displayName: '[MOCK] 客户甲',
      ownerSummary: '[MOCK] 顾问甲',
      tagNames: ['[MOCK] 重点客户'],
      sourceType: 'other_mock',
      addedAtDate: '2026-07-10',
      remarkSummary: '[MOCK] 已确认摘要',
    },
    systemCustomerSummary: {
      mockCustomerNumber: 'MOCK-001',
      displayNameSummary: '[MOCK] 客户甲',
      ownerSummary: '[MOCK] 顾问甲',
      tagNames: ['[MOCK] 重点客户'],
      statusSummary: 'active',
    },
    mappingStatus: 'manual_review_required',
    confidenceLevel: 'high',
    conflictSummary: { status: 'none', unresolvedCount: 0 },
    manualReviewStatus: 'required',
  }],
  mappingStatus: 'manual_review_required',
  confidenceLevel: 'high',
  conflictSummary: { status: 'none', unresolvedCount: 0 },
  manualReviewStatus: 'required',
  auditSummary: {
    status: 'recorded',
    eventType: 'mapping_candidate_generated',
    reasonCode: 'candidate_evidence_available',
  },
  failClosedReason: null,
  autoMergePerformed: false,
  realCustomerRelationshipWritten: false,
};

function reviewSuccess(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    mappingId: responsePayload.mappingId,
    action: 'approve_candidate',
    previousStatus: 'pending_review',
    nextStatus: 'approved_pending_link',
    previousVersion: 0,
    nextVersion: 1,
    reasonCode: 'manual_evidence_confirmed',
    idempotentReplay: false,
    auditSummary: { eventCount: 2, acceptedMutationCount: 1, replayCount: 0 },
    mockDemo: true,
    persistenceMode: 'volatile_process_memory',
    autoMergePerformed: false,
    realCustomerRelationshipWritten: false,
    ...overrides,
  };
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/api/institution/wecom/customer-mapping-candidates')) {
      return new Response(JSON.stringify(responsePayload), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (url.includes('/api/auth/session')) {
      return new Response(JSON.stringify({
        authenticated: true,
        user: {
          id: 'admin-mock',
          username: 'admin-mock',
          name: '机构管理员',
          role: 'tenant_admin',
          tenantId: 'tenant-mock-001',
          institutionId: 'institution-mock-001',
        },
      }), { status: 200 });
    }
    if (url.includes('/api/institution/entitlement-usage')) {
      return new Response(JSON.stringify({ items: [] }), { status: 200 });
    }
    return new Response(JSON.stringify({ error: 'not available in test' }), { status: 503 });
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('WeCom customer mapping review workbench', () => {
  it('租户 scope 变化时清空旧数据且过期请求不能覆盖当前响应', async () => {
    let resolveFirst: ((response: Response) => void) | undefined;
    let resolveSecond: ((response: Response) => void) | undefined;
    const firstResponse = new Promise<Response>((resolve) => { resolveFirst = resolve; });
    const secondResponse = new Promise<Response>((resolve) => { resolveSecond = resolve; });
    vi.mocked(fetch)
      .mockReturnValueOnce(firstResponse)
      .mockReturnValueOnce(secondResponse);
    const currentPayload = {
      ...responsePayload,
      candidates: [{
        ...responsePayload.candidates[0],
        externalContactSummary: {
          ...responsePayload.candidates[0].externalContactSummary,
          displayName: '[MOCK] 客户乙',
        },
        systemCustomerSummary: {
          ...responsePayload.candidates[0].systemCustomerSummary,
          mockCustomerNumber: 'MOCK-002',
          displayNameSummary: '[MOCK] 客户乙',
        },
      }],
    };

    const { rerender } = render(
      <WeComCustomerMappingCandidatesReadonlyPanel requestScopeKey="tenant-a" />,
    );
    rerender(<WeComCustomerMappingCandidatesReadonlyPanel requestScopeKey="tenant-b" />);
    resolveSecond?.(new Response(JSON.stringify(currentPayload), { status: 200 }));

    expect(await screen.findAllByText('[MOCK] 客户乙')).toHaveLength(2);
    resolveFirst?.(new Response(JSON.stringify(responsePayload), { status: 200 }));
    await act(async () => Promise.resolve());
    expect(screen.queryByText('[MOCK] 客户甲')).not.toBeInTheDocument();
    expect(screen.getAllByText('[MOCK] 客户乙')).toHaveLength(2);
  });

  it('真实 reader + strict parser 处理 fetch 响应后才渲染候选', async () => {
    render(<WeComCustomerMappingCandidatesReadonlyPanel />);

    expect(await screen.findByText('外部联系人低敏摘要')).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(
      '/api/institution/wecom/customer-mapping-candidates',
      expect.objectContaining({ cache: 'no-store', signal: expect.any(AbortSignal) }),
    );
  });

  it.each([
    ['非法 JSON', '{invalid-json'],
    ['非法 shape', JSON.stringify({ attackerControlled: 'RAW_ATTACKER_CONTENT_8f31' })],
    ['root unknown key', JSON.stringify({ ...responsePayload, attackerControlled: 'ROOT_ATTACK_8f31' })],
    ['nested unknown key', JSON.stringify({
      ...responsePayload,
      candidates: [{
        ...responsePayload.candidates[0],
        externalContactSummary: {
          ...responsePayload.candidates[0].externalContactSummary,
          attackerControlled: 'NESTED_ATTACK_8f31',
        },
      }],
    })],
  ])('parser 遇到%s时仅渲染固定 fail-closed 提示', async (_label, body) => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(body, { status: 200 }));

    const { container } = render(<WeComCustomerMappingCandidatesReadonlyPanel />);

    expect(await screen.findByText('候选视图暂时不可用，已保持 fail-closed（失败关闭）。')).toBeInTheDocument();
    expect(container.innerHTML).not.toMatch(/RAW_ATTACKER_CONTENT_8f31|ROOT_ATTACK_8f31|NESTED_ATTACK_8f31/u);
    expect(screen.queryByText('外部联系人低敏摘要')).not.toBeInTheDocument();
  });

  it.each([
    'token: DOM_TOKEN_ATTACK_9b42',
    'raw-payload={DOM_PAYLOAD_ATTACK_9b42}',
    'conversation-content DOM_CONVERSATION_ATTACK_9b42',
    'archive_content DOM_ARCHIVE_ATTACK_9b42',
    '+86-138-0013-8000 DOM_PHONE_ATTACK_9b42',
    '110105-19491231-002X DOM_IDCARD_ATTACK_9b42',
  ])('不可信 JSON 经 reader 和 parser 后不把 %s 或上一成功候选保留在 DOM', async (unsafeText) => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify(responsePayload), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ...responsePayload,
        candidates: [{
          ...responsePayload.candidates[0],
          externalContactSummary: {
            ...responsePayload.candidates[0].externalContactSummary,
            remarkSummary: unsafeText,
          },
        }],
      }), { status: 200 }));

    const { container, rerender } = render(
      <WeComCustomerMappingCandidatesReadonlyPanel requestScopeKey="tenant-safe" />,
    );
    expect(await screen.findAllByText('[MOCK] 客户甲')).toHaveLength(2);

    rerender(<WeComCustomerMappingCandidatesReadonlyPanel requestScopeKey="tenant-hostile" />);

    expect(await screen.findByText('候选视图暂时不可用，已保持 fail-closed（失败关闭）。')).toBeInTheDocument();
    expect(screen.queryByText('[MOCK] 客户甲')).not.toBeInTheDocument();
    expect(container.textContent).not.toContain(unsafeText);
    expect(container.innerHTML).not.toContain(unsafeText);
    expect(Array.from(container.querySelectorAll('*')).some((element) =>
      Array.from(element.attributes).some((attribute) => attribute.value.includes(unsafeText))
    )).toBe(false);
    expect(within(container).queryAllByRole('button')).toHaveLength(0);
  });

  it.each([
    '138​0013​8000',
    '110105‍19491231‍002X',
    '138–0013–8000',
    '110105—19491231—002X',
    '138 0013 8000',
  ])('Unicode 分隔恶意 JSON 经 reader/parser 后不进入 DOM 且不保留旧候选：%s', async (unsafeText) => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify(responsePayload), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ...responsePayload,
        candidates: [{
          ...responsePayload.candidates[0],
          externalContactSummary: {
            ...responsePayload.candidates[0].externalContactSummary,
            remarkSummary: unsafeText,
          },
        }],
      }), { status: 200 }));

    const { container, rerender } = render(
      <WeComCustomerMappingCandidatesReadonlyPanel requestScopeKey="unicode-safe" />,
    );
    expect(await screen.findAllByText('[MOCK] 客户甲')).toHaveLength(2);

    rerender(<WeComCustomerMappingCandidatesReadonlyPanel requestScopeKey="unicode-hostile" />);

    expect(await screen.findByText('候选视图暂时不可用，已保持 fail-closed（失败关闭）。')).toBeInTheDocument();
    expect(screen.queryByText('外部联系人低敏摘要')).not.toBeInTheDocument();
    expect(screen.queryByText('[MOCK] 客户甲')).not.toBeInTheDocument();
    expect(container.textContent).not.toContain(unsafeText);
    expect(container.innerHTML).not.toContain(unsafeText);
    expect(Array.from(container.querySelectorAll('*')).some((element) =>
      Array.from(element.attributes).some((attribute) => attribute.value.includes(unsafeText))
    )).toBe(false);
    expect(within(container).queryAllByRole('button')).toHaveLength(0);
  });

  it.each([
    ['U+1680 手机号', '138 0013 8000'],
    ['U+058A 身份证', '110105֊19491231֊002X'],
    ['U+05BE 手机号', '138־0013־8000'],
    ['U+2E17 身份证', '110105⸗19491231⸗002X'],
    ['U+034F 手机号', '138͏0013͏8000'],
    ['U+FE0F 身份证', '110105️19491231️002X'],
  ])('%s 恶意 JSON 通过完整路径后不进入 loaded DOM 且清除旧候选', async (_label, unsafeText) => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify(responsePayload), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ...responsePayload,
        candidates: [{
          ...responsePayload.candidates[0],
          externalContactSummary: {
            ...responsePayload.candidates[0].externalContactSummary,
            remarkSummary: unsafeText,
          },
        }],
      }), { status: 200 }));

    const { container, rerender } = render(
      <WeComCustomerMappingCandidatesReadonlyPanel requestScopeKey="unicode-category-safe" />,
    );
    expect(await screen.findAllByText('[MOCK] 客户甲')).toHaveLength(2);

    rerender(
      <WeComCustomerMappingCandidatesReadonlyPanel requestScopeKey="unicode-category-hostile" />,
    );

    expect(await screen.findByText('候选视图暂时不可用，已保持 fail-closed（失败关闭）。')).toBeInTheDocument();
    expect(screen.queryByText('外部联系人低敏摘要')).not.toBeInTheDocument();
    expect(screen.queryByText('[MOCK] 客户甲')).not.toBeInTheDocument();
    expect(container.textContent).not.toContain(unsafeText);
    expect(container.innerHTML).not.toContain(unsafeText);
    expect(Array.from(container.querySelectorAll('*')).some((element) =>
      Array.from(element.attributes).some((attribute) => attribute.value.includes(unsafeText))
    )).toBe(false);
    expect(within(container).queryAllByRole('button')).toHaveLength(0);
  });

  it('U+02C6 注入经真实 fetch、reader、parser、view-model 和组件后 fail-closed 且清除旧数据', async () => {
    const unsafeText = '138ˆ0013ˆ8000';
    expect(/\p{Lm}/u.test('ˆ')).toBe(true);
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify(responsePayload), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ...responsePayload,
        candidates: [{
          ...responsePayload.candidates[0],
          externalContactSummary: {
            ...responsePayload.candidates[0].externalContactSummary,
            remarkSummary: unsafeText,
          },
        }],
      }), { status: 200 }));

    const { container, rerender } = render(
      <WeComCustomerMappingCandidatesReadonlyPanel requestScopeKey="lm-safe" />,
    );
    expect(await screen.findAllByText('[MOCK] 客户甲')).toHaveLength(2);

    rerender(<WeComCustomerMappingCandidatesReadonlyPanel requestScopeKey="lm-hostile" />);

    expect(await screen.findByText('候选视图暂时不可用，已保持 fail-closed（失败关闭）。')).toBeInTheDocument();
    expect(screen.queryByText('外部联系人低敏摘要')).not.toBeInTheDocument();
    expect(screen.queryByText('[MOCK] 客户甲')).not.toBeInTheDocument();
    expect(container.textContent).not.toContain(unsafeText);
    expect(container.innerHTML).not.toContain(unsafeText);
    expect(Array.from(container.querySelectorAll('*')).some((element) =>
      Array.from(element.attributes).some((attribute) => attribute.value.includes(unsafeText))
    )).toBe(false);
    expect(within(container).queryAllByRole('button')).toHaveLength(0);
  });

  it('tokenization 与普通中文备注通过完整 reader/parser/组件路径', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({
      ...responsePayload,
      candidates: [{
        ...responsePayload.candidates[0],
        externalContactSummary: {
          ...responsePayload.candidates[0].externalContactSummary,
          remarkSummary: 'tokenization 模型的普通中文展示摘要',
        },
      }],
    }), { status: 200 }));

    render(<WeComCustomerMappingCandidatesReadonlyPanel />);

    expect(await screen.findByText('备注：tokenization 模型的普通中文展示摘要')).toBeInTheDocument();
  });

  it('非 2xx body 含敏感文本时忽略 body 且不进入 DOM', async () => {
    const maliciousBody = 'NON_2XX_SECRET_8f31 rawResponse=13812345678';
    const response = new Response(maliciousBody, { status: 503 });
    const jsonSpy = vi.spyOn(response, 'json');
    const textSpy = vi.spyOn(response, 'text');
    vi.mocked(fetch).mockResolvedValueOnce(response);

    const { container } = render(<WeComCustomerMappingCandidatesReadonlyPanel />);

    expect(await screen.findByText('候选视图暂时不可用，已保持 fail-closed（失败关闭）。')).toBeInTheDocument();
    expect(jsonSpy).not.toHaveBeenCalled();
    expect(textSpy).not.toHaveBeenCalled();
    expect(container.innerHTML).not.toContain('NON_2XX_SECRET_8f31');
    expect(container.innerHTML).not.toContain('13812345678');
  });

  it('恶意响应内容不得进入页面文本、隐藏文本或任何 DOM attribute', async () => {
    const marker = 'DOM_ATTRIBUTE_ATTACK_8f31';
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({
      ...responsePayload,
      candidates: [{
        ...responsePayload.candidates[0],
        externalContactSummary: {
          ...responsePayload.candidates[0].externalContactSummary,
          remarkSummary: `${marker} rawResponse=private`,
        },
      }],
    }), { status: 200 }));

    const { container } = render(<WeComCustomerMappingCandidatesReadonlyPanel />);

    expect(await screen.findByText('候选视图暂时不可用，已保持 fail-closed（失败关闭）。')).toBeInTheDocument();
    expect(container.textContent).not.toContain(marker);
    expect(container.innerHTML).not.toContain(marker);
    expect(Array.from(container.querySelectorAll('*')).some((element) =>
      Array.from(element.attributes).some((attribute) => attribute.value.includes(marker))
    )).toBe(false);
  });

  it('以紧凑工作台展示 mock/demo、候选对比、状态栏与人工复核状态', async () => {
    render(<WeComCustomerMappingCandidatesReadonlyPanel />);

    const panel = await screen.findByRole('region', { name: '企业微信客户匹配复核工作台' });
    expect(within(panel).getByText('MOCK / DEMO · 人工复核')).toBeInTheDocument();
    expect(within(panel).getByTestId('mapping-status-strip')).toBeInTheDocument();
    expect(within(panel).getByTestId('mapping-comparison')).toBeInTheDocument();
    expect(within(panel).getByText('外部联系人低敏摘要')).toBeInTheDocument();
    expect(within(panel).getByText('系统客户候选低敏摘要')).toBeInTheDocument();
    expect(within(panel).getAllByText('[MOCK] 客户甲')).toHaveLength(2);
    expect(within(panel).getAllByText('需要人工复核').length).toBeGreaterThan(0);
    expect(within(panel).getAllByText('高置信度').length).toBeGreaterThan(0);
    expect(within(panel).getByText('冲突：无')).toBeInTheDocument();
    expect(within(panel).getAllByText('需要人工复核').length).toBeGreaterThan(0);
    expect(within(panel).getByText(/不会自动合并或写入真实客户关系/u)).toBeInTheDocument();
    expect(within(panel).getByText('查看审计与运行说明')).toBeInTheDocument();
  });

  it('只读角色不展示敏感字段或人工复核动作按钮', async () => {
    render(<WeComCustomerMappingCandidatesReadonlyPanel />);

    const panel = await screen.findByRole('region', { name: '企业微信客户匹配复核工作台' });
    const text = panel.textContent ?? '';
    expect(text).not.toMatch(/138\d|external_?userid|userId|secret|token|聊天内容|会话内容/iu);
    expect(within(panel).queryByRole('button', { name: '确认候选' })).not.toBeInTheDocument();
    expect(within(panel).queryByRole('button', { name: '拒绝候选' })).not.toBeInTheDocument();
    expect(within(panel).queryByRole('button', { name: '补充信息' })).not.toBeInTheDocument();
    expect(within(panel).queryByRole('button', { name: '标记冲突' })).not.toBeInTheDocument();
    expect(within(panel).queryByRole('button', { name: '重新打开' })).not.toBeInTheDocument();
    expect(within(panel).queryByText(/批量审批|真实同步|发送入口|会话内容入口/u)).not.toBeInTheDocument();
    expect(within(panel).getByText('当前账号仅可查看候选，不能执行人工复核。')).toBeInTheDocument();
  });

  it('有复核权限时按当前状态展示动作，并对必填说明做行内校验', async () => {
    render(<WeComCustomerMappingCandidatesReadonlyPanel canReview />);

    expect(await screen.findByRole('button', { name: '确认候选' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '拒绝候选' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '补充信息' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '标记冲突' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '重新打开' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '补充信息' }));
    expect(screen.getByRole('combobox', { name: '复核原因' })).toHaveValue('missing_low_sensitive_evidence');
    expect(screen.getByRole('textbox', { name: /低敏说明/u })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '确认执行' }));

    expect(await screen.findByText('请补充本次复核所依据的低敏说明。')).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('提交人工复核后重新读取候选，并展示新的状态与版本', async () => {
    let candidateReadCount = 0;
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/institution/wecom/customer-mapping-candidates')) {
        candidateReadCount += 1;
        const payload = candidateReadCount === 1
          ? responsePayload
          : {
              ...responsePayload,
              mappingVersion: 1,
              mappingReviewStatus: 'approved_pending_link',
            };
        return new Response(JSON.stringify(payload), { status: 200 });
      }
      if (url.includes('/api/institution/wecom/customer-mapping-reviews/')) {
        return new Response(JSON.stringify(reviewSuccess()), { status: 200 });
      }
      return new Response(JSON.stringify({ code: 'response_unavailable' }), { status: 503 });
    });

    render(<WeComCustomerMappingCandidatesReadonlyPanel canReview />);

    fireEvent.click(await screen.findByRole('button', { name: '确认候选' }));
    fireEvent.click(screen.getByRole('button', { name: '确认执行' }));

    expect(await screen.findAllByText('已确认，待后续关联')).toHaveLength(2);
    expect(screen.getAllByText('v1')).toHaveLength(2);
    expect(screen.getByText('复核结果已保存，页面状态已更新。')).toBeInTheDocument();
    expect(candidateReadCount).toBe(2);

    const postCall = vi.mocked(fetch).mock.calls.find(([input, init]) =>
      String(input).includes('/api/institution/wecom/customer-mapping-reviews/')
      && init?.method === 'POST'
    );
    expect(postCall?.[0]).toBe(
      `/api/institution/wecom/customer-mapping-reviews/${responsePayload.mappingId}/actions`,
    );
    const body = JSON.parse(String(postCall?.[1]?.body)) as Record<string, unknown>;
    expect(body).toMatchObject({
      action: 'approve_candidate',
      expectedVersion: 0,
      reasonCode: 'manual_evidence_confirmed',
    });
    expect(body.idempotencyKey).toMatch(/^review_[A-Za-z0-9_-]{16,128}$/u);
  });

  it('提交成功后的刷新窗口立即隐藏旧版本动作', async () => {
    let resolveReload: ((response: Response) => void) | undefined;
    const reloadResponse = new Promise<Response>((resolve) => { resolveReload = resolve; });
    let candidateReadCount = 0;
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/institution/wecom/customer-mapping-candidates')) {
        candidateReadCount += 1;
        if (candidateReadCount === 1) {
          return new Response(JSON.stringify(responsePayload), { status: 200 });
        }
        return reloadResponse;
      }
      if (url.includes('/api/institution/wecom/customer-mapping-reviews/')) {
        return new Response(JSON.stringify(reviewSuccess()), { status: 200 });
      }
      return new Response(JSON.stringify({ code: 'response_unavailable' }), { status: 503 });
    });

    render(<WeComCustomerMappingCandidatesReadonlyPanel canReview />);

    fireEvent.click(await screen.findByRole('button', { name: '确认候选' }));
    fireEvent.click(screen.getByRole('button', { name: '确认执行' }));

    expect(await screen.findByText('正在加载匹配候选')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '确认候选' })).not.toBeInTheDocument();
    expect(screen.queryByText('[MOCK] 客户甲')).not.toBeInTheDocument();

    resolveReload?.(new Response(JSON.stringify({
      ...responsePayload,
      mappingVersion: 1,
      mappingReviewStatus: 'approved_pending_link',
    }), { status: 200 }));
    expect(await screen.findAllByText('已确认，待后续关联')).toHaveLength(2);
  });

  it('展示 fail-closed 提示且不渲染候选', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({
      ...responsePayload,
      mappingId: null,
      mappingVersion: null,
      mappingReviewStatus: null,
      candidates: [],
      mappingStatus: 'disabled',
      confidenceLevel: null,
      conflictSummary: { status: 'unavailable', unresolvedCount: 0 },
      manualReviewStatus: 'unavailable',
      auditSummary: {
        status: 'blocked',
        eventType: 'mapping_provider_disabled',
        reasonCode: 'provider_disabled',
      },
      failClosedReason: 'provider_disabled',
    }), { status: 200 }));

    render(<WeComCustomerMappingCandidatesReadonlyPanel />);

    expect(await screen.findByText('fail-closed：候选已隐藏')).toBeInTheDocument();
    expect(screen.getByText('原因：候选来源当前已关闭')).toBeInTheDocument();
    expect(screen.queryByText('外部联系人低敏摘要')).not.toBeInTheDocument();
  });

  it('无机构读取权限角色不显示 workspace 导航项', async () => {
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/auth/session')) {
        return new Response(JSON.stringify({
          authenticated: true,
          user: {
            id: 'platform-admin',
            username: 'platform-admin',
            name: '平台管理员',
            role: 'platform_admin',
            tenantId: null,
            institutionId: null,
          },
        }), { status: 200 });
      }
      if (url.includes('/api/institution/entitlement-usage')) {
        return new Response(JSON.stringify({ items: [] }), { status: 200 });
      }
      return new Response(JSON.stringify({ error: 'blocked' }), { status: 503 });
    });

    render(<InstitutionWorkspace />);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/auth/session', { cache: 'no-store' });
    });
    expect(screen.queryByRole('button', { name: /移动导航：企微匹配复核/u })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: '企业微信客户匹配复核工作台' })).not.toBeInTheDocument();
  });

  it.each([
    'tenant_admin',
    'tenant_operator',
    'consultant',
    'customer_service',
  ] as const)('%s 按现有 customer:read 策略显示 workspace 导航项', async (role) => {
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/auth/session')) {
        return new Response(JSON.stringify({
          authenticated: true,
          user: {
            id: `${role}-mock`,
            username: `${role}-mock`,
            name: '机构用户',
            role,
            tenantId: 'tenant-mock-001',
            institutionId: 'institution-mock-001',
          },
        }), { status: 200 });
      }
      if (url.includes('/api/institution/wecom/customer-mapping-candidates')) {
        return new Response(JSON.stringify(responsePayload), { status: 200 });
      }
      if (url.includes('/api/institution/entitlement-usage')) {
        return new Response(JSON.stringify({ items: [] }), { status: 200 });
      }
      return new Response(JSON.stringify({ error: 'not available in test' }), { status: 503 });
    });

    render(<InstitutionWorkspace />);

    expect(await screen.findByRole('button', { name: /移动导航：企微匹配复核/u })).toBeInTheDocument();
  });

  it.each([
    ['平台角色', 'platform_admin', null, null],
    ['错误 scope 角色', 'security_auditor', 'tenant-mock-001', 'institution-mock-001'],
  ] as const)('%s不显示 workspace 导航项', async (_label, role, tenantId, institutionId) => {
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/auth/session')) {
        return new Response(JSON.stringify({
          authenticated: true,
          user: {
            id: `${role}-mock`,
            username: `${role}-mock`,
            name: '无机构读取权限用户',
            role,
            tenantId,
            institutionId,
          },
        }), { status: 200 });
      }
      if (url.includes('/api/institution/entitlement-usage')) {
        return new Response(JSON.stringify({ items: [] }), { status: 200 });
      }
      return new Response(JSON.stringify({ error: 'blocked' }), { status: 503 });
    });

    render(<InstitutionWorkspace />);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/auth/session', { cache: 'no-store' });
    });
    expect(screen.queryByRole('button', { name: /移动导航：企微匹配复核/u })).not.toBeInTheDocument();
  });

  it('正确机构读取权限角色显示 workspace 导航项并挂载复核工作台', async () => {
    render(<InstitutionWorkspace />);

    const navigation = await screen.findByRole('button', { name: /移动导航：企微匹配复核/u });
    await act(async () => {
      fireEvent.click(navigation);
    });

    await waitFor(() => {
      expect(screen.getByRole('region', { name: '企业微信客户匹配复核工作台' })).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: '确认候选' })).toBeInTheDocument();
    expect(navigation).toHaveAttribute('aria-current', 'page');
  });
});
