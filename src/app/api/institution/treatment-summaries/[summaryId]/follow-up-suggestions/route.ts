import { NextResponse } from 'next/server';

type TreatmentFollowUpSuggestionRouteContext = {
  params: Promise<{ summaryId: string }>;
};

const treatmentFollowUpSuggestionsReadDisabled = Object.freeze({
  code: 'treatment_followup_suggestions_capability_disabled',
  error: '治疗随访建议能力暂未启用',
});

/**
 * No request or route data is inspected until an institution-scoped reader exists.
 * This deliberately avoids demo-session, authorization, database, repository, service, audit, and fetch side effects.
 */
export async function GET(
  _request: Request,
  _context: TreatmentFollowUpSuggestionRouteContext,
) {
  return NextResponse.json(treatmentFollowUpSuggestionsReadDisabled, { status: 503 });
}
