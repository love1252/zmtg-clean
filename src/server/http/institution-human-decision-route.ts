import { NextResponse } from 'next/server';

export async function readHumanDecisionBody(request: Request): Promise<unknown> {
  if ([...new URL(request.url).searchParams].length) return null;
  const length = request.headers.get('content-length');
  if (length !== null && (!/^\d+$/u.test(length) || Number(length) > 4096)) return null;
  try {
    const text = await request.text();
    return new TextEncoder().encode(text).length <= 4096 ? JSON.parse(text) : null;
  } catch { return null; }
}

export function humanDecisionResponse(result: { kind: string }) {
  const status = result.kind === 'ready' ? 200 : result.kind === 'invalid' ? 400 : result.kind === 'forbidden' ? 403 : result.kind === 'not_found' ? 404 : result.kind === 'conflict' ? 409 : 503;
  return NextResponse.json(result.kind === 'ready' ? result : { code: `human_decision_${result.kind}` }, { status, headers: { 'cache-control': 'no-store' } });
}
