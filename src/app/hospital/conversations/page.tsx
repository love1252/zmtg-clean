import { ConversationQueueReadonlyShell } from '@/modules/institution-conversations/components/ConversationQueueReadonlyShell';
import {
  InstitutionCapabilityOffPage,
  resolveInstitutionCapabilityOffRouteV1,
} from '@/modules/institution/components/InstitutionCapabilityOffPage';
import { InstitutionNavigationShell } from '@/modules/institution/components/InstitutionNavigationShell';
import { InstitutionPageState } from '@/modules/institution/components/InstitutionPageState';
import type { CapabilityStatusV1 } from '@/modules/institution-contracts/v1/institution-capability';
import type { InstitutionNavigationSectionIdV1 } from '@/modules/institution-contracts/v1/institution-navigation';
import { resolveInstitutionServerAuthorizationV1 } from '@/modules/institution/server/institution-server-runtime';
import { isInstitutionRequestAuthorizationV1 } from '@/modules/security/server/institution-request-authorization';
import {
  isInstitutionNavigationAuthorizationV1,
  type InstitutionNavigationAuthorizationV1,
} from '@/modules/security/server/institution-section-guard';
import { resolveInstitutionCapabilityAuthorityStatusV1 } from '@/server/orchestration/institution-capability-authority';
import {
  readCurrentInstitutionConversationQueueActionableIdsV1,
  readCurrentInstitutionConversationQueueV1,
} from '@/server/orchestration/institution-conversation-queue-reader';

export const dynamic = 'force-dynamic';

const TARGET_SECTION_ID = 'conversations' as const;
const TARGET_CAPABILITY_KEY = 'page_conversation_queue' as const;
const EMPTY_SECTION_IDS = Object.freeze([]) as readonly InstitutionNavigationSectionIdV1[];
const CAPABILITY_OFF_ROUTE = resolveInstitutionCapabilityOffRouteV1(['conversations']);

type PageCapabilityState = 'released' | 'capability_off' | 'unavailable';

function resolveExactCapabilityState(status: CapabilityStatusV1 | null): PageCapabilityState {
  if (
    !status
    || status.contractVersion !== 'v1'
    || status.readiness !== 'ready'
    || status.failureCode !== null
    || !status.data
  ) return 'unavailable';

  const capabilities = status.data.capabilities.filter(
    (capability) => capability.key === TARGET_CAPABILITY_KEY,
  );
  const partitions = status.partitions.filter(
    (partition) => partition.key === TARGET_CAPABILITY_KEY,
  );

  if (capabilities.length !== 1 || partitions.length !== 1) {
    return 'capability_off';
  }

  const capability = capabilities[0];
  const partition = partitions[0];
  if (
    capability?.decision !== 'operational'
    || capability.dimensions.codeMaturity !== 'verified'
    || capability.dimensions.institutionAuthorization !== 'authorized'
    || capability.dimensions.connectionAvailability !== 'not_required'
    || capability.dimensions.dataReadiness !== 'ready'
    || capability.dimensions.productionRelease !== 'pilot_released'
    || capability.safeSummary !== '会话队列可用'
    || partition?.readiness !== 'ready'
    || partition.failureCode !== null
  ) return 'capability_off';

  return 'released';
}

export default async function HospitalConversationsPage() {
  let navigationAuthorization: unknown;
  try {
    const requestAuthorization = await resolveInstitutionServerAuthorizationV1();
    if (isInstitutionRequestAuthorizationV1(requestAuthorization)) {
      navigationAuthorization =
        await requestAuthorization.authorizeCurrentInstitutionNavigationV1({
          targetSectionId: TARGET_SECTION_ID,
        });
    }
  } catch {
    navigationAuthorization = undefined;
  }

  let exactNavigationAuthorization: InstitutionNavigationAuthorizationV1 | null = null;
  if (
    isInstitutionNavigationAuthorizationV1(navigationAuthorization)
    && navigationAuthorization.targetSectionId === TARGET_SECTION_ID
  ) exactNavigationAuthorization = navigationAuthorization;

  const availableSectionIds = exactNavigationAuthorization
    ? exactNavigationAuthorization.availableSectionIds
    : EMPTY_SECTION_IDS;
  const genuineAllowed = exactNavigationAuthorization?.targetAccess === 'allowed';
  const genuineBlocked = exactNavigationAuthorization?.targetAccess === 'blocked';

  let capabilityState: PageCapabilityState = 'unavailable';
  if (genuineAllowed) {
    try {
      capabilityState = resolveExactCapabilityState(
        await resolveInstitutionCapabilityAuthorityStatusV1(),
      );
    } catch {
      capabilityState = 'unavailable';
    }
  }

  const result =
    genuineAllowed && capabilityState === 'released'
      ? await readCurrentInstitutionConversationQueueV1().catch(() => ({
          kind: 'unavailable' as const,
        }))
      : null;
  const actionableConversationIds =
    result?.kind === 'ready'
      ? await readCurrentInstitutionConversationQueueActionableIdsV1(
          result.queue,
        ).catch(() => Object.freeze([]) as readonly string[])
      : Object.freeze([]) as readonly string[];

  return (
    <InstitutionNavigationShell
      activeSectionId={TARGET_SECTION_ID}
      availableSectionIds={availableSectionIds}
    >
      {result?.kind === 'ready' ? (
        <ConversationQueueReadonlyShell
          queue={result.queue}
          actionableConversationIds={actionableConversationIds}
        />
      ) : genuineBlocked || result?.kind === 'forbidden' ? (
        <InstitutionPageState
          kind="forbidden"
          title="当前账号不可访问会话队列"
          description="当前仅确认会话栏目访问受限；未读取或展示任何会话事实。"
        />
      ) : genuineAllowed && capabilityState === 'capability_off' && CAPABILITY_OFF_ROUTE ? (
        <InstitutionCapabilityOffPage
          pageLabel={CAPABILITY_OFF_ROUTE.pageLabel}
          section={CAPABILITY_OFF_ROUTE.section}
        />
      ) : (
        <InstitutionPageState
          kind="unavailable"
          title="会话队列暂时不可用"
          description="当前未获得可信的正式会话队列结果；外部消息与自动化能力保持关闭。"
        />
      )}
    </InstitutionNavigationShell>
  );
}
