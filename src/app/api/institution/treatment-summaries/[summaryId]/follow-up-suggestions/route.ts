import { NextResponse } from 'next/server';
import { getTreatmentFollowUpSuggestionsForSummary } from '@/modules/institution/server/treatment-followup-confirmation';
import { createTreatmentSummaryRepository } from '@/modules/institution/server/treatment-summary-repository';
import { canAccessResource } from '@/modules/security/domain/access-control';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';
import { getDatabase } from '@/server/db/client';

type TreatmentFollowUpSuggestionRouteContext = {
  params: Promise<{ summaryId: string }>;
};

async function getSummaryId(context: TreatmentFollowUpSuggestionRouteContext) {
  const params = await context.params;
  return params.summaryId.trim();
}

export async function GET(
  request: Request,
  context: TreatmentFollowUpSuggestionRouteContext,
) {
  const accessContext = getDemoAccessContextFromRequest(request);
  if (!accessContext) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }

  const decision = canAccessResource({
    context: accessContext,
    resource: 'treatment_summary',
    action: 'read_own_tenant',
    targetTenantId: accessContext.tenantId,
  });

  if (!decision.allowed || !accessContext.tenantId) {
    return NextResponse.json({ error: '没有访问权限' }, { status: 403 });
  }

  try {
    const db = getDatabase();
    const result = await getTreatmentFollowUpSuggestionsForSummary({
      tenantId: accessContext.tenantId,
      summaryId: await getSummaryId(context),
      treatmentSummaryRepository: createTreatmentSummaryRepository(db),
    });

    if (result.kind === 'not_found') {
      return NextResponse.json({ error: '记录不存在' }, { status: 404 });
    }

    return NextResponse.json({ suggestions: result.suggestions });
  } catch {
    return NextResponse.json({ error: '数据服务暂时不可用' }, { status: 503 });
  }
}
