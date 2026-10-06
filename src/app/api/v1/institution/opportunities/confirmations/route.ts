import { confirmCurrentInstitutionOpportunity, readCurrentInstitutionOpportunityConfirmations } from '@/server/orchestration/institution-opportunity-confirmation-runtime';
import { humanDecisionResponse, readHumanDecisionBody } from '@/server/http/institution-human-decision-route';
export async function GET(request: Request) {
  return humanDecisionResponse(await readCurrentInstitutionOpportunityConfirmations(new URL(request.url).searchParams));
}
export async function POST(request: Request) {
  return humanDecisionResponse(await confirmCurrentInstitutionOpportunity(await readHumanDecisionBody(request)));
}
