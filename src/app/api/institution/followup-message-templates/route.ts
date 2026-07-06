import { NextResponse } from 'next/server';
import { createAuditEventRepository } from '@/modules/audit/server/audit-event-repository';
import {
  allowedFollowUpMessageAudit,
  deniedFollowUpMessageAudit,
} from '@/modules/institution/server/followup-message-draft-api';
import { listFollowUpMessageTemplates } from '@/modules/institution/server/followup-message-draft-service';
import { createTenantBusinessRepository } from '@/modules/institution/server/tenant-business-repository';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';
import { canAccessResource } from '@/modules/security/domain/access-control';
import { getDatabase } from '@/server/db/client';

export async function GET(request: Request) {
  const context = getDemoAccessContextFromRequest(request);
  if (!context) return NextResponse.json({ error: '请先登录' }, { status: 401 });

  try {
    const db = getDatabase();
    const auditRepository = createAuditEventRepository(db);
    const occurredAt = new Date().toISOString();
    const decision = canAccessResource({
      context,
      resource: 'follow_up',
      action: 'read_own_tenant',
      targetTenantId: context.tenantId,
    });

    if (!decision.allowed || !context.tenantId) {
      await auditRepository.record(
        deniedFollowUpMessageAudit({
          context,
          action: 'read_own_tenant',
          reason: decision.allowed ? 'missing_tenant' : decision.reason,
          occurredAt,
        }),
      );
      return NextResponse.json({ error: '没有访问权限' }, { status: 403 });
    }

    const result = await listFollowUpMessageTemplates({
      context,
      tenantBusinessRepository: createTenantBusinessRepository(db),
    });

    if (result.kind !== 'success') {
      await auditRepository.record(
        deniedFollowUpMessageAudit({ context, action: 'read_own_tenant', reason: result.reason, occurredAt }),
      );
      return NextResponse.json({ error: '没有访问权限' }, { status: 403 });
    }

    await auditRepository.record(
      allowedFollowUpMessageAudit({
        context,
        action: 'read_own_tenant',
        reason: decision.reason,
        occurredAt,
      }),
    );

    return NextResponse.json({ records: result.templates });
  } catch {
    return NextResponse.json({ error: '数据服务暂时不可用' }, { status: 503 });
  }
}
