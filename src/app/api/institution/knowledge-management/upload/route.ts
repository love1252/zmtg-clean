import { NextResponse } from 'next/server';

const noStoreHeaders = { 'cache-control': 'no-store' } as const;

const capabilityDisabledPayload = Object.freeze({
  code: 'capability_disabled',
  error: '机构知识库上传能力暂未启用。',
});

/**
 * Upload remains fail-closed until a formal institution guard, immutable knowledge persistence,
 * and an approved file-storage boundary are available. Do not inspect request data or initialize
 * authentication, persistence, repositories, storage, parsing, quota, OCR, or indexing here.
 */
export function POST(_request: Request) {
  return NextResponse.json(capabilityDisabledPayload, {
    status: 503,
    headers: noStoreHeaders,
  });
}
