import { NextResponse } from 'next/server';

import {
  createCurrentInstitutionFormalFollowUpV1,
  readCurrentInstitutionFormalFollowUpsV1,
} from '@/server/orchestration/institution-formal-follow-up-runtime';

const NO_STORE_HEADERS = Object.freeze({
  'cache-control': 'no-store',
} as const);
const MAX_JSON_BODY_BYTES = 8 * 1024;

async function readJsonBody(
  request: Request,
): Promise<unknown | null> {
  const contentLength =
    request.headers.get('content-length');
  if (
    contentLength !== null
    && (
      !/^\d+$/u.test(contentLength)
      || Number(contentLength)
        > MAX_JSON_BODY_BYTES
    )
  ) {
    return null;
  }

  try {
    const text = await request.text();
    if (
      new TextEncoder().encode(text).byteLength
        > MAX_JSON_BODY_BYTES
    ) {
      return null;
    }
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  try {
    const params =
      new URL(request.url).searchParams;
    if ([...params.keys()].length !== 0) {
      return NextResponse.json(
        {
          code:
            'invalid_follow_up_query',
        },
        {
          status: 400,
          headers: NO_STORE_HEADERS,
        },
      );
    }
  } catch {
    return NextResponse.json(
      {
        code: 'invalid_follow_up_query',
      },
      {
        status: 400,
        headers: NO_STORE_HEADERS,
      },
    );
  }

  const result =
    await readCurrentInstitutionFormalFollowUpsV1();

  if (result.kind === 'forbidden') {
    return NextResponse.json(
      {
        code:
          'institution_follow_up_forbidden',
      },
      {
        status: 403,
        headers: NO_STORE_HEADERS,
      },
    );
  }

  if (result.kind !== 'ready') {
    return NextResponse.json(
      {
        code:
          'institution_follow_up_unavailable',
      },
      {
        status: 503,
        headers: NO_STORE_HEADERS,
      },
    );
  }

  return NextResponse.json(
    result,
    {
      status: 200,
      headers: NO_STORE_HEADERS,
    },
  );
}

export async function POST(request: Request) {
  const body = await readJsonBody(request);
  if (body === null) {
    return NextResponse.json(
      {
        code: 'invalid_follow_up_create',
      },
      {
        status: 400,
        headers: NO_STORE_HEADERS,
      },
    );
  }

  const result =
    await createCurrentInstitutionFormalFollowUpV1(
      body,
    );

  if (result.kind === 'ready') {
    return NextResponse.json(
      result,
      {
        status:
          result.idempotent ? 200 : 201,
        headers: NO_STORE_HEADERS,
      },
    );
  }

  const status =
    result.kind === 'invalid'
      ? 400
      : result.kind === 'forbidden'
        ? 403
        : result.kind === 'not_found'
          ? 404
          : result.kind === 'conflict'
            ? 409
            : 503;

  return NextResponse.json(
    {
      code:
        result.code
        ?? `institution_follow_up_${result.kind}`,
    },
    {
      status,
      headers: NO_STORE_HEADERS,
    },
  );
}
