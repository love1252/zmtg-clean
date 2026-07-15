import { describe, expect, it, vi } from 'vitest';
import {
  getAvailableWeComCustomerMappingReviewActions,
  isWeComCustomerMappingReviewNoteRequired,
  submitWeComCustomerMappingReviewAction,
} from '@/modules/institution/client/wecom-customer-mapping-review-actions-client';

const input = {
  mappingId: 'mock-wecom-mapping-pending-001',
  action: 'approve_candidate' as const,
  expectedVersion: 0,
  idempotencyKey: 'review_1234567890123456',
  reasonCode: 'manual_evidence_confirmed' as const,
};

function success(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    mappingId: input.mappingId,
    action: input.action,
    previousStatus: 'pending_review',
    nextStatus: 'approved_pending_link',
    previousVersion: 0,
    nextVersion: 1,
    reasonCode: input.reasonCode,
    idempotentReplay: false,
    auditSummary: { eventCount: 2, acceptedMutationCount: 1, replayCount: 0 },
    mockDemo: true,
    persistenceMode: 'volatile_process_memory',
    autoMergePerformed: false,
    realCustomerRelationshipWritten: false,
    ...overrides,
  };
}

function response(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('WeCom customer mapping review actions client', () => {
  it('按 exact contract 提交动作并解析成功响应', async () => {
    const fetcher = vi.fn(async () => response(success()));

    const result = await submitWeComCustomerMappingReviewAction(input, { fetcher });

    expect(result).toEqual({ ok: true, data: success() });
    expect(fetcher).toHaveBeenCalledWith(
      `/api/institution/wecom/customer-mapping-reviews/${input.mappingId}/actions`,
      expect.objectContaining({
        method: 'POST',
        cache: 'no-store',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: input.action,
          expectedVersion: input.expectedVersion,
          idempotencyKey: input.idempotencyKey,
          reasonCode: input.reasonCode,
        }),
      }),
    );
  });

  it('成功响应多字段或状态转换不一致时拒绝进入 UI', async () => {
    const extraField = await submitWeComCustomerMappingReviewAction(input, {
      fetcher: async () => response({ ...success(), rawPayload: 'untrusted' }),
    });
    const wrongTransition = await submitWeComCustomerMappingReviewAction(input, {
      fetcher: async () => response(success({ nextStatus: 'rejected' })),
    });

    expect(extraField).toEqual({
      ok: false,
      error: { status: 200, code: null, kind: 'invalid_response' },
    });
    expect(wrongTransition).toEqual({
      ok: false,
      error: { status: 200, code: null, kind: 'invalid_response' },
    });
  });

  it('只接受 allowlist 错误 code，并将版本冲突映射为刷新', async () => {
    const versionConflict = await submitWeComCustomerMappingReviewAction(input, {
      fetcher: async () => response({ code: 'version_conflict' }, 409),
    });
    const unknownError = await submitWeComCustomerMappingReviewAction(input, {
      fetcher: async () => response({ code: 'server_secret', detail: 'raw error' }, 503),
    });

    expect(versionConflict).toEqual({
      ok: false,
      error: { status: 409, code: 'version_conflict', kind: 'refresh_required' },
    });
    expect(unknownError).toEqual({
      ok: false,
      error: { status: 503, code: null, kind: 'unavailable' },
    });
  });

  it('将来源校验、网关失败和跨环境中止映射为可恢复的固定错误', async () => {
    const csrfFailure = await submitWeComCustomerMappingReviewAction(input, {
      fetcher: async () => response({ code: 'csrf_validation_failed' }, 403),
    });
    const gatewayFailure = await submitWeComCustomerMappingReviewAction(input, {
      fetcher: async () => response({ message: 'upstream detail' }, 502),
    });
    const controller = new AbortController();
    const aborted = submitWeComCustomerMappingReviewAction(input, {
      signal: controller.signal,
      fetcher: async () => {
        controller.abort();
        throw new Error('polyfill abort');
      },
    });

    expect(csrfFailure).toEqual({
      ok: false,
      error: { status: 403, code: 'csrf_validation_failed', kind: 'origin_invalid' },
    });
    expect(gatewayFailure).toEqual({
      ok: false,
      error: { status: 502, code: null, kind: 'unavailable' },
    });
    await expect(aborted).resolves.toEqual({
      ok: false,
      error: { status: 0, code: null, kind: 'aborted' },
    });
  });

  it('提供固定状态动作矩阵与备注必填规则', () => {
    expect(getAvailableWeComCustomerMappingReviewActions('pending_review')).toEqual([
      'approve_candidate',
      'reject_candidate',
      'request_more_info',
      'mark_conflict',
    ]);
    expect(getAvailableWeComCustomerMappingReviewActions('approved_pending_link')).toEqual([
      'reopen_review',
    ]);
    expect(getAvailableWeComCustomerMappingReviewActions('disabled')).toEqual([]);
    expect(isWeComCustomerMappingReviewNoteRequired(
      'request_more_info',
      'missing_low_sensitive_evidence',
    )).toBe(true);
    expect(isWeComCustomerMappingReviewNoteRequired(
      'approve_candidate',
      'manual_evidence_confirmed',
    )).toBe(false);
  });
});
