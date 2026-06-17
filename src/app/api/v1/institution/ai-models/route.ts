import { NextResponse } from 'next/server';
import { getDatabase } from '@/server/db/client';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';
import { createVendorProviderConfigRepository } from '@/modules/open-platform/server/vendorProviderConfigRepository';
import { listVendorProviderConfigs } from '@/modules/open-platform/server/vendorProviderConfig';

function unauthorizedResponse() {
  return NextResponse.json({ code: 'unauthorized', error: '请先登录' }, { status: 401 });
}

function forbiddenResponse() {
  return NextResponse.json({ code: 'forbidden', error: '没有访问权限' }, { status: 403 });
}

function serviceUnavailableResponse() {
  return NextResponse.json(
    { code: 'service_unavailable', error: 'AI 模型数据暂时不可用' },
    { status: 503 },
  );
}

export async function GET(request: Request) {
  const accessContext = getDemoAccessContextFromRequest(request);
  if (!accessContext) {
    return unauthorizedResponse();
  }

  if (accessContext.scope !== 'tenant' || !accessContext.tenantId) {
    return forbiddenResponse();
  }

  try {
    const repository = createVendorProviderConfigRepository(getDatabase());
    const result = await listVendorProviderConfigs({ repository });

    return NextResponse.json(
      { models: result.configs },
      { status: 200 },
    );
  } catch {
    return serviceUnavailableResponse();
  }
}
