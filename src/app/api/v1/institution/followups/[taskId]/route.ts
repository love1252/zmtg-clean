import { NextResponse } from 'next/server';

import {
  mutateCurrentInstitutionFormalFollowUpV1,
  readCurrentInstitutionFormalFollowUpV1,
} from '@/server/orchestration/institution-formal-follow-up-runtime';

const NO_STORE_HEADERS = Object.freeze({
  'cache-control': 'no-store',
} as const);
const MAX_JSON_BODY_BYTES = 8 * 1024;

type Context = Readonly<{
  params: Promise<{ taskId: string }>;
}>;

function hasNoQuery(request: Request): boolean {
  try {
    return (
      [
        ...new URL(
          request.url,
        ).searchParams.keys(),
      ].length === 0
    );
  } catch {
    return false;
  }
}

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

export async function GET(
  request: Request,
  context: Context,
) {
  if (!hasNoQuery(request)) {
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

  const { taskId } = await context.params;
  const result =
    await readCurrentInstitutionFormalFollowUpV1(
      taskId,
    );

  if (result.kind === 'ready') {
    return NextResponse.json(
      result,
      {
        status: 200,
        headers: NO_STORE_HEADERS,
      },
    );
  }

  const status =
    result.kind === 'forbidden'
      ? 403
      : result.kind === 'not_found'
        ? 404
        : 503;

  return NextResponse.json(
    {
      code:
        `institution_follow_up_${result.kind}`,
    },
    {
      status,
      headers: NO_STORE_HEADERS,
    },
  );
}

export async function PATCH(
  request: Request,
  context: Context,
) {
  if (!hasNoQuery(request)) {
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

  const { taskId } = await context.params;
  const body = await readJsonBody(request);
  if (body === null) {
    return NextResponse.json(
      {
        code: 'invalid_follow_up_command',
      },
      {
        status: 400,
        headers: NO_STORE_HEADERS,
      },
    );
  }

  const result =
    await mutateCurrentInstitutionFormalFollowUpV1(
      taskId,
      body,
    );

  if (result.kind === 'ready') {
    return NextResponse.json(
      result,
      {
        status: 200,
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
