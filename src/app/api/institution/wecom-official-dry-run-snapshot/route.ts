import { NextResponse } from 'next/server';
import {
  officialWeComDryRunRoutes,
  type OfficialWeComDryRunRoute,
} from '@/modules/institution/domain/wecom-official-dry-run-config';
import {
  createTrustedReachOutSafetyRepository,
  type InstitutionChannelDryRunSnapshot,
} from '@/modules/institution/server/trusted-reachout-safety-repository';
import {
  evaluateAndPersistWeComDryRunSnapshot,
  weComDryRunSnapshotConfirmation,
} from '@/modules/institution/server/wecom-dry-run-snapshot-service';
import { runTrustedReachOutSafetyTransaction } from '@/modules/institution/server/trusted-reachout-safety-transaction';
import { canAccessResource, type AccessContext } from '@/modules/security/domain/access-control';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';
import { getDatabase } from '@/server/db/client';

const requestKeys = [
  'officialRoute',
  'proofInstitutionRef',
  'callbackPlaceholderRef',
  'hasTestWeComEnvironment',
  'hasSecretKeeperConfirmed',
  'confirmation',
] as const;
const requestMaxBytes = 1024;

type SnapshotRequest = {
  officialRoute: OfficialWeComDryRunRoute;
  proofInstitutionRef: string;
  callbackPlaceholderRef: string;
  hasTestWeComEnvironment: boolean;
  hasSecretKeeperConfirmed: boolean;
  confirmation: string;
};

function createId() {
  return globalThis.crypto?.randomUUID?.() ?? `snapshot_${Date.now()}`;
}

function accessResponse(request: Request, write: boolean):
  | { ok: true; context: AccessContext & { tenantId: string; institutionId: string } }
  | { ok: false; response: NextResponse } {
  const context = getDemoAccessContextFromRequest(request);
  if (!context) return { ok: false, response: NextResponse.json({ error: '请先登录' }, { status: 401 }) };
  const decision = canAccessResource({ context, resource: 'real_channel', action: 'read', targetTenantId: context.tenantId });
  if (!decision.allowed || !context.tenantId || !context.institutionId || (write && context.role !== 'tenant_admin')) {
    return { ok: false, response: NextResponse.json({ error: '没有访问权限' }, { status: 403 }) };
  }
  return { ok: true, context: context as AccessContext & { tenantId: string; institutionId: string } };
}

async function readJsonBody(request: Request) {
  const contentLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > requestMaxBytes) return { ok: false as const, tooLarge: true };
  try {
    const text = await request.text();
    if (new TextEncoder().encode(text).byteLength > requestMaxBytes) return { ok: false as const, tooLarge: true };
    return { ok: true as const, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false as const, tooLarge: false };
  }
}

function lowSensitiveRef(value: unknown, max: number) {
  if (typeof value !== 'string') return null;
  const normalized = value.normalize('NFKC').trim();
  if (!normalized || normalized.length > max || /:\/\/|[/?#]/u.test(normalized)) return null;
  if (/secret|token|corp[_-]?id|userid|user_id|agent[_-]?id|encodingaeskey|qyapi|webhook|process\.env|\.env\.local/iu.test(normalized)) return null;
  return normalized;
}

function parseRequest(value: unknown): SnapshotRequest | null {
  if (!value || Object.prototype.toString.call(value) !== '[object Object]') return null;
  const keys = Object.keys(value);
  if (keys.length !== requestKeys.length || !requestKeys.every((key) => keys.includes(key))) return null;
  const body = value as Record<string, unknown>;
  if (!officialWeComDryRunRoutes.includes(body.officialRoute as OfficialWeComDryRunRoute)) return null;
  const proofInstitutionRef = lowSensitiveRef(body.proofInstitutionRef, 96);
  const callbackPlaceholderRef = lowSensitiveRef(body.callbackPlaceholderRef, 96);
  if (!proofInstitutionRef || !callbackPlaceholderRef || body.confirmation !== weComDryRunSnapshotConfirmation) return null;
  if (typeof body.hasTestWeComEnvironment !== 'boolean' || typeof body.hasSecretKeeperConfirmed !== 'boolean') return null;
  return {
    officialRoute: body.officialRoute as OfficialWeComDryRunRoute,
    proofInstitutionRef,
    callbackPlaceholderRef,
    hasTestWeComEnvironment: body.hasTestWeComEnvironment,
    hasSecretKeeperConfirmed: body.hasSecretKeeperConfirmed,
    confirmation: weComDryRunSnapshotConfirmation,
  };
}

function serializeSnapshot(snapshot: InstitutionChannelDryRunSnapshot | null) {
  if (!snapshot) return null;
  return {
    channelType: 'wechat_work' as const,
    officialRoute: snapshot.officialRoute,
    proofInstitutionRef: snapshot.proofInstitutionRef,
    callbackPlaceholderRef: snapshot.callbackPlaceholderRef,
    configStatus: snapshot.configStatus,
    preflightStatus: snapshot.preflightStatus,
    proofEligibleMock: snapshot.proofEligibleMock,
    evaluatedAt: snapshot.evaluatedAt,
    allowRealSend: false as const,
    externalChannelEnabled: false as const,
    realSendAllowed: false as const,
    dryRunOnly: true as const,
  };
}

export async function GET(request: Request) {
  const access = accessResponse(request, false);
  if (!access.ok) return access.response;
  try {
    const snapshot = await createTrustedReachOutSafetyRepository(getDatabase()).findDryRunSnapshot({
      tenantId: access.context.tenantId,
      institutionId: access.context.institutionId,
    });
    return NextResponse.json({ snapshot: serializeSnapshot(snapshot), usable: snapshot?.configStatus === 'dry_run_ready' });
  } catch {
    return NextResponse.json({ error: '数据服务暂时不可用' }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const access = accessResponse(request, true);
  if (!access.ok) return access.response;
  const body = await readJsonBody(request);
  if (!body.ok) {
    return NextResponse.json({ code: body.tooLarge ? 'body_too_large' : 'invalid_request', error: '请求格式不正确' }, { status: body.tooLarge ? 413 : 400 });
  }
  const parsed = parseRequest(body.value);
  if (!parsed) return NextResponse.json({ code: 'invalid_request', error: '请求格式不正确' }, { status: 400 });

  try {
    const result = await runTrustedReachOutSafetyTransaction(getDatabase(), (repositories) =>
      evaluateAndPersistWeComDryRunSnapshot({
        context: access.context,
        tenantId: access.context.tenantId,
        institutionId: access.context.institutionId,
        ...parsed,
        occurredAt: new Date().toISOString(),
        createId,
        repositories,
      }));
    return NextResponse.json({
      snapshot: serializeSnapshot(result.snapshot),
      usable: result.snapshot.configStatus === 'dry_run_ready',
      boundary: {
        dryRunOnly: true,
        allowRealSend: false,
        externalChannelEnabled: false,
        realSendAllowed: false,
        noSecretAccepted: true,
        noRealNetwork: true,
      },
    });
  } catch {
    return NextResponse.json({ error: '数据服务暂时不可用' }, { status: 503 });
  }
}
