import { NextResponse } from 'next/server';
import { withInstitutionObjectRouteGuardV1 } from '@/app/api/institution/_shared/institution-route-guard';
import { readCurrentInstitutionCustomerFormalFollowUpsV1 } from '@/server/orchestration/institution-formal-follow-up-runtime';

type Context = { params: Promise<{ customerId: string }> };
const headers = { 'cache-control': 'no-store' };
async function read(request: Request, context: Context) {
  const { customerId } = await context.params;
  const result = await readCurrentInstitutionCustomerFormalFollowUpsV1(customerId, new URL(request.url).searchParams);
  if (result.kind === 'ready') return NextResponse.json(result, { headers });
  const status = result.kind === 'invalid_query' ? 400 : result.kind === 'forbidden' ? 403 : result.kind === 'not_found' ? 404 : 503;
  return NextResponse.json({ code: `customer_followups_${result.kind}` }, { status, headers });
}
const GET = withInstitutionObjectRouteGuardV1({
  sectionId: 'customers', objectType: 'customer', action: 'read',
  resolveObjectId: async (_request: Request, context: Context) => (await context.params).customerId,
  handler: read,
});
export { GET };
