import { NextResponse } from 'next/server';
import { getPlatformAiRuntimeStatus } from '@/modules/open-platform/server/platformAiRuntimeConfig';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';

export function GET(request: Request) {
  try {
    const accessContext = getDemoAccessContextFromRequest(request);
    if (!accessContext) {
      return NextResponse.json({
        readonly: true,
        dataSource: 'env_only',
        enabled: false,
        configured: false,
        provider: null,
        model: null,
        baseUrlConfigured: false,
        missingKeys: ['ZMTG_AI_RUNTIME_ENABLED', 'ZMTG_AI_PROVIDER', 'ZMTG_AI_BASE_URL', 'ZMTG_AI_API_KEY', 'ZMTG_AI_MODEL'],
        safety: {
          title: 'AI Runtime env-only 可用性',
          keyPolicy: 'API Key 仅从服务端环境变量读取，不在页面输入、不回显、不保存。',
          smokePolicy: '真实调用仅用于固定 smoke test，不接收用户 prompt。',
        },
      }, { status: 401 });
    }

    if (accessContext.scope !== 'platform') {
      return NextResponse.json({
        readonly: true,
        dataSource: 'env_only',
        enabled: false,
        configured: false,
        provider: null,
        model: null,
        baseUrlConfigured: false,
        missingKeys: ['ZMTG_AI_RUNTIME_ENABLED', 'ZMTG_AI_PROVIDER', 'ZMTG_AI_BASE_URL', 'ZMTG_AI_API_KEY', 'ZMTG_AI_MODEL'],
        safety: {
          title: 'AI Runtime env-only 可用性',
          keyPolicy: 'API Key 仅从服务端环境变量读取，不在页面输入、不回显、不保存。',
          smokePolicy: '真实调用仅用于固定 smoke test，不接收用户 prompt。',
        },
      }, { status: 403 });
    }

    return NextResponse.json(getPlatformAiRuntimeStatus(), { status: 200 });
  } catch {
    return NextResponse.json({
      readonly: true,
      dataSource: 'env_only',
      enabled: false,
      configured: false,
      provider: null,
      model: null,
      baseUrlConfigured: false,
      missingKeys: ['ZMTG_AI_RUNTIME_ENABLED', 'ZMTG_AI_PROVIDER', 'ZMTG_AI_BASE_URL', 'ZMTG_AI_API_KEY', 'ZMTG_AI_MODEL'],
      safety: {
        title: 'AI Runtime env-only 可用性',
        keyPolicy: 'API Key 仅从服务端环境变量读取，不在页面输入、不回显、不保存。',
        smokePolicy: '真实调用仅用于固定 smoke test，不接收用户 prompt。',
      },
    }, { status: 200 });
  }
}
