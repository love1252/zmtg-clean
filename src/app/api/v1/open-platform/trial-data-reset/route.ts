import { NextResponse } from 'next/server';

import { randomUUID } from 'node:crypto';

import { createAuditEvent } from '@/modules/audit/domain/audit-events';
import {
  getTrialDataOverview,
  resetTrialData,
} from '@/modules/open-platform/server/trial-data-reset-service';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';
import { getDatabase } from '@/server/db/client';

function lowSensitiveError(status: number, errorCode: string) {
  return NextResponse.json({ ok: false, errorCode }, { status });
}

function idFactory(prefix: string) {
  return `${prefix}-${randomUUID().slice(0, 12)}`;
}

export async function GET(_request: Request) {
  const context = getDemoAccessContextFromRequest(_request);
  if (!context) return lowSensitiveError(401, 'UNAUTHORIZED');
  if (context.scope !== 'platform') return lowSensitiveError(403, 'FORBIDDEN');

  try {
    const overview = await getTrialDataOverview(getDatabase());
    return NextResponse.json({ ok: true, overview });
  } catch {
    return lowSensitiveError(503, 'TRIAL_DATA_OVERVIEW_UNAVAILABLE');
  }
}

export async function POST(request: Request) {
  const context = getDemoAccessContextFromRequest(request);
  if (!context) return lowSensitiveError(401, 'UNAUTHORIZED');
  if (context.scope !== 'platform') return lowSensitiveError(403, 'FORBIDDEN');

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, errorCode: 'INVALID_JSON' }, { status: 400 });
  }

  const body = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
  const confirmed = typeof body.confirm === 'string' ? body.confirm.trim() : '';

  if (confirmed !== 'RESET') {
    return NextResponse.json(
      { ok: false, errorCode: 'CONFIRM_RESET_REQUIRED', hint: '请在请求中提供 confirm: "RESET" 以确认高危操作' },
      { status: 400 },
    );
  }

  const now = new Date();
  const auditEventId = idFactory('audit-event');
  const auditEvent = createAuditEvent({
    eventId: auditEventId,
    context,
    resource: 'tenant',
    action: 'manage_status',
    result: 'transitioned',
    reason: 'manual_review_required',
    occurredAt: now.toISOString(),
  });

  try {
    const result = await resetTrialData(getDatabase(), { auditEvent });

    if (result.status === 'no_tenant_data') {
      return NextResponse.json({ ok: true, ...result });
    }

    return NextResponse.json({ ok: true, ...result });
  } catch {
    return lowSensitiveError(503, 'TRIAL_DATA_RESET_UNAVAILABLE');
  }
}
