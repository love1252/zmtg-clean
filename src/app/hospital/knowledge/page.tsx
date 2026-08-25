import {
  KnowledgeDocumentMetadataReadonlyShell,
} from '@/modules/knowledge/components/KnowledgeDocumentMetadataReadonlyShell';
import {
  InstitutionCapabilityOffPage,
  resolveInstitutionCapabilityOffRouteV1,
} from '@/modules/institution/components/InstitutionCapabilityOffPage';
import {
  InstitutionNavigationShell,
} from '@/modules/institution/components/InstitutionNavigationShell';
import {
  InstitutionPageState,
} from '@/modules/institution/components/InstitutionPageState';
import type {
  CapabilityStatusV1,
} from '@/modules/institution-contracts/v1/institution-capability';
import { resolveInstitutionShellAuthorizationV1 } from '@/modules/institution-shell/server/institution-shell-authorization';
import {
  resolveInstitutionServerAuthorizationV1,
} from '@/modules/institution/server/institution-server-runtime';
import {
  isInstitutionRequestAuthorizationV1,
} from '@/modules/security/server/institution-request-authorization';
import {
  isInstitutionNavigationAuthorizationV1,
  type InstitutionNavigationAuthorizationV1,
} from '@/modules/security/server/institution-section-guard';
import {
  readCurrentInstitutionKnowledgeDocumentsV1,
} from '@/server/orchestration/institution-knowledge-document-metadata-reader';

export const dynamic = 'force-dynamic';

const TARGET_SECTION_ID = 'knowledge' as const;
const TARGET_CAPABILITY_KEY =
  'page_knowledge_library' as const;
const CAPABILITY_OFF_ROUTE =
  resolveInstitutionCapabilityOffRouteV1([
    'knowledge',
  ]);

type PageCapabilityState =
  | 'released'
  | 'capability_off'
  | 'unavailable';

type SearchParamsInput = Readonly<
  Record<string, string | string[] | undefined>
>;

function resolveExactCapabilityState(
  status: CapabilityStatusV1 | null,
): PageCapabilityState {
  if (
    !status
    || status.contractVersion !== 'v1'
    || status.readiness !== 'ready'
    || status.failureCode !== null
    || !status.data
  ) return 'unavailable';

  const capabilities =
    status.data.capabilities.filter(
      (capability) =>
        capability.key === TARGET_CAPABILITY_KEY,
    );

  const partitions =
    status.partitions.filter(
      (partition) =>
        partition.key === TARGET_CAPABILITY_KEY,
    );

  if (
    capabilities.length !== 1
    || partitions.length !== 1
  ) return 'capability_off';

  const capability = capabilities[0];
  const partition = partitions[0];

  if (
    capability?.decision !== 'read_only'
    || capability.dimensions.codeMaturity !== 'verified'
    || capability.dimensions.institutionAuthorization
      !== 'authorized'
    || capability.dimensions.connectionAvailability
      !== 'not_required'
    || capability.dimensions.dataReadiness !== 'ready'
    || capability.dimensions.productionRelease
      !== 'pilot_released'
    || capability.safeSummary
      !== '知识库资料仅供查看'
    || partition?.readiness !== 'ready'
    || partition.failureCode !== null
  ) return 'capability_off';

  return 'released';
}

function toUrlSearchParams(
  input: SearchParamsInput | undefined,
): URLSearchParams {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(
    input ?? {},
  )) {
    if (Array.isArray(value)) {
      for (const item of value) {
        params.append(key, item);
      }
    } else if (typeof value === 'string') {
      params.append(key, value);
    }
  }

  return params;
}

export default async function HospitalKnowledgePage({
  searchParams,
}: Readonly<{
  searchParams?: Promise<SearchParamsInput>;
}>) {
  let resolvedSearchParams:
    | URLSearchParams
    | null = null;

  try {
    resolvedSearchParams =
      toUrlSearchParams(await searchParams);
  } catch {
    resolvedSearchParams = null;
  }

  let navigationAuthorization: unknown;

  try {
    const requestAuthorization =
      await resolveInstitutionServerAuthorizationV1();

    if (
      isInstitutionRequestAuthorizationV1(
        requestAuthorization,
      )
    ) {
      navigationAuthorization =
        await requestAuthorization
          .authorizeCurrentInstitutionNavigationV1({
            targetSectionId: TARGET_SECTION_ID,
          });
    }
  } catch {
    navigationAuthorization = undefined;
  }

  let exactNavigationAuthorization:
    | InstitutionNavigationAuthorizationV1
    | null = null;

  if (
    isInstitutionNavigationAuthorizationV1(
      navigationAuthorization,
    )
    && navigationAuthorization.targetSectionId
      === TARGET_SECTION_ID
  ) {
    exactNavigationAuthorization =
      navigationAuthorization;
  }

  const genuineAllowed =
    exactNavigationAuthorization?.targetAccess
    === 'allowed';

  const genuineBlocked =
    exactNavigationAuthorization?.targetAccess
    === 'blocked';
  const {
    availableSectionIds,
    availableNavigationTargets,
    capabilityStatus,
    workspaceScopeKey,
  } = await resolveInstitutionShellAuthorizationV1(
    exactNavigationAuthorization,
  );

  let capabilityState:
    PageCapabilityState = 'unavailable';

  if (genuineAllowed) {
    capabilityState = resolveExactCapabilityState(capabilityStatus);
  }

  const result =
    genuineAllowed
    && capabilityState === 'released'
    && resolvedSearchParams
      ? await readCurrentInstitutionKnowledgeDocumentsV1(
          resolvedSearchParams,
        ).catch(() => ({
          kind: 'unavailable' as const,
        }))
      : null;

  return (
    <InstitutionNavigationShell
      activeSectionId={TARGET_SECTION_ID}
      availableSectionIds={availableSectionIds}
      availableNavigationTargets={availableNavigationTargets}
      workspaceScopeKey={workspaceScopeKey}
    >
      {result?.kind === 'ready' ? (
        <KnowledgeDocumentMetadataReadonlyShell
          result={result}
        />
      ) : genuineBlocked
        || result?.kind === 'forbidden' ? (
        <InstitutionPageState
          kind="forbidden"
          title="当前账号不可访问知识库资料"
          description="当前仅确认知识库栏目访问受限；未读取或展示任何知识库资料。"
        />
      ) : genuineAllowed
        && capabilityState === 'capability_off'
        && CAPABILITY_OFF_ROUTE ? (
        <InstitutionCapabilityOffPage
          pageLabel={CAPABILITY_OFF_ROUTE.pageLabel}
          routeId={CAPABILITY_OFF_ROUTE.routeId}
          section={CAPABILITY_OFF_ROUTE.section}
        />
      ) : result?.kind === 'invalid_query' ? (
        <InstitutionPageState
          kind="error"
          title="知识库资料查询条件无效"
          description="请检查分页条件后重试。"
        />
      ) : (
        <InstitutionPageState
          kind="unavailable"
          title="知识库资料暂时不可用"
          description="当前未获得可信的正式知识库资料结果；资料内容与操作入口保持隐藏。"
        />
      )}
    </InstitutionNavigationShell>
  );
}
