import { decideCurrentInstitutionCustomerProfile, generateCurrentInstitutionCustomerProfile, readCurrentInstitutionCustomerProfile } from '@/server/orchestration/institution-customer-profile-runtime';
import { humanDecisionResponse, readHumanDecisionBody } from '@/server/http/institution-human-decision-route';
type Context = { params: Promise<{ customerId: string }> };
export async function GET(request: Request, context: Context) {
  return humanDecisionResponse(await readCurrentInstitutionCustomerProfile((await context.params).customerId, new URL(request.url).searchParams));
}
export async function POST(request: Request, context: Context) {
  return humanDecisionResponse(await generateCurrentInstitutionCustomerProfile((await context.params).customerId, await readHumanDecisionBody(request)));
}
export async function PATCH(request: Request, context: Context) {
  const body = await readHumanDecisionBody(request);
  if (!body || typeof body !== 'object' || Array.isArray(body) || !('suggestionId' in body) || typeof body.suggestionId !== 'string') return humanDecisionResponse({ kind: 'invalid' });
  const { suggestionId, ...command } = body;
  return humanDecisionResponse(await decideCurrentInstitutionCustomerProfile((await context.params).customerId, suggestionId, command));
}
