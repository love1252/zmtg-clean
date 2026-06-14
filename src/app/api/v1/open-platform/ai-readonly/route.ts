import { NextResponse } from 'next/server';
import { getPlatformAiReadonlyResponse } from '@/modules/open-platform/server/platformAiReadonlyApiContract';

export function GET(request: Request) {
  const params = new URL(request.url).searchParams;

  return NextResponse.json(getPlatformAiReadonlyResponse({ month: params.get('month') }), {
    status: 200,
  });
}
