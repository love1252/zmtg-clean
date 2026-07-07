import { NextResponse } from 'next/server';
import { createAuditEvent, createDeniedAccessAuditEvent, type AuditReason } from '@/modules/audit/domain/audit-events';
import type { AccessContext } from '@/modules/security/domain/access-control';

export async function readFollowUpMessageJsonBody(request: Request) {
  try {
    return { ok: true as const, value: await request.json() };
  } catch {
    return { ok: false as const };
  }
}

export function createFollowUpMessageAuditEventId() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `audit_${Date.now()}_${Math.random().toString(36).slice(2)}`
  );
}

export function deniedFollowUpMessageAudit(input: {
  context: AccessContext;
  action: 'create' | 'read_own_tenant' | 'update';
  reason: AuditReason;
  occurredAt: string;
  resourceId?: string | null;
}) {
  return createDeniedAccessAuditEvent({
    eventId: createFollowUpMessageAuditEventId(),
    context: input.context,
    resource: 'follow_up',
    action: input.action,
    reason: input.reason,
    occurredAt: input.occurredAt,
    resourceId: input.resourceId,
  });
}

export function allowedFollowUpMessageAudit(input: {
  context: AccessContext;
  action: 'create' | 'read_own_tenant' | 'update';
  reason: AuditReason;
  occurredAt: string;
  resourceId?: string | null;
}) {
  return createAuditEvent({
    eventId: createFollowUpMessageAuditEventId(),
    context: input.context,
    resource: 'follow_up',
    action: input.action,
    result: 'allowed',
    reason: input.reason,
    occurredAt: input.occurredAt,
    resourceId: input.resourceId,
  });
}

export function parseCreateMessageDraftPayload(payload: unknown) {
  if (!payload || Object.prototype.toString.call(payload) !== '[object Object]') {
    return { ok: false as const, error: '请求格式不正确' };
  }

  const record = payload as Record<string, unknown>;
  const allowedKeys = new Set(['followUpTaskId', 'templateId']);
  const extraKey = Object.keys(record).find((key) => !allowedKeys.has(key));
  if (extraKey) return { ok: false as const, error: `请求包含不允许的字段: ${extraKey}` };

  const followUpTaskId = typeof record.followUpTaskId === 'string' ? record.followUpTaskId.trim() : '';
  const templateId = typeof record.templateId === 'string' ? record.templateId.trim() : '';
  if (!followUpTaskId) return { ok: false as const, error: 'followUpTaskId 不可为空' };

  return { ok: true as const, value: { followUpTaskId, templateId: templateId || null } };
}

export function parseUpdateMessageDraftPayload(payload: unknown) {
  if (!payload || Object.prototype.toString.call(payload) !== '[object Object]') {
    return { ok: false as const, error: '请求格式不正确' };
  }

  const record = payload as Record<string, unknown>;
  const allowedKeys = new Set(['content']);
  const extraKey = Object.keys(record).find((key) => !allowedKeys.has(key));
  if (extraKey) return { ok: false as const, error: `请求包含不允许的字段: ${extraKey}` };

  const content = typeof record.content === 'string' ? record.content.trim() : '';
  if (!content) return { ok: false as const, error: 'content 不可为空' };
  if (content.length > 1000) return { ok: false as const, error: 'content 超出长度限制' };

  return { ok: true as const, value: { content } };
}

export function responseForFollowUpMessageConflict(reason: string) {
  if (reason === 'follow_up_message_draft_exists') {
    return NextResponse.json({ code: reason, error: '该随访任务已有消息草稿' }, { status: 409 });
  }
  if (reason === 'follow_up_message_draft_not_draft') {
    return NextResponse.json({ code: reason, error: '当前草稿状态不可编辑或确认' }, { status: 409 });
  }
  if (reason === 'follow_up_message_draft_not_approved') {
    return NextResponse.json({ code: reason, error: '只有已确认草稿可标记为已人工发送' }, { status: 409 });
  }
  if (reason === 'unsafe_follow_up_message_content') {
    return NextResponse.json({ code: reason, error: '草稿内容包含不允许的敏感信息' }, { status: 409 });
  }

  if (reason === 'message_delivery_exists') {
    return NextResponse.json({ code: reason, error: '该草稿已生成受控发送记录' }, { status: 409 });
  }

  return NextResponse.json({ code: reason, error: '消息草稿状态冲突' }, { status: 409 });
}
