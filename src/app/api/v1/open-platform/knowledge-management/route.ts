import { NextResponse } from 'next/server';
import { getPlatformKnowledgeOverviewResponse } from '@/modules/open-platform/server/platformKnowledgeManagementApiContract';

export function GET(_request: Request) {
  return NextResponse.json(getPlatformKnowledgeOverviewResponse(), { status: 200 });
}
