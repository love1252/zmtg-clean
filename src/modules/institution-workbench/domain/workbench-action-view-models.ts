import type {
  CareActionCardV1,
  CareActionOwnerV1,
  CareActionPartitionKeyV1,
  CareActionPriorityV1,
  CareActionRiskLevelV1,
  CareAppointmentBusinessStateV1,
  CareFollowUpBusinessStateV1,
} from '@/modules/institution-contracts/v1/care-action';
import type {
  ConversationActionPartitionKeyV1,
  ConversationActionPriorityV1,
  ConversationActionRiskStateV1,
  ConversationActionStateV1,
} from '@/modules/institution-contracts/v1/conversation-action';
import type { InstitutionActionSortSignalV1 } from '@/modules/institution-contracts/v1/institution-action';
import type { InstitutionSourceReadinessV1 } from '@/modules/institution-contracts/v1/institution-source';

export const WORKBENCH_ACTION_FILTERS = Object.freeze([
  'all',
  'appointment',
  'followup',
  'conversation',
] as const);

export type WorkbenchActionFilter = (typeof WORKBENCH_ACTION_FILTERS)[number];

export const WORKBENCH_DESKTOP_ACTION_LIMIT = 6 as const;
export const WORKBENCH_MOBILE_ACTION_LIMIT = 4 as const;

export type WorkbenchActionStableKey =
  | `appointment:${string}`
  | `followup:${string}`
  | `conversation:${string}`;

type WorkbenchCareCardIdentity<K extends CareActionPartitionKeyV1> = {
  key: K;
  title: string;
};

type WorkbenchCareCardCurrentViewModel<K extends CareActionPartitionKeyV1> =
  WorkbenchCareCardIdentity<K> &
    (
      | {
          status: 'ready';
          count: number;
          observedAt: string;
          canonicalHref: Extract<CareActionCardV1, { key: K }>['canonicalHref'];
        }
      | {
          status: 'empty';
          count: 0;
          observedAt: string;
          canonicalHref: Extract<CareActionCardV1, { key: K }>['canonicalHref'];
        }
    );

type WorkbenchCareCardStaleViewModel<K extends CareActionPartitionKeyV1> =
  WorkbenchCareCardIdentity<K> &
    (
      | {
          status: 'stale';
          count: number;
          observedAt: string;
        }
      | {
          status: 'stale';
          count: null;
          observedAt: null;
        }
    );

type WorkbenchCareCardUnavailableViewModel<K extends CareActionPartitionKeyV1> =
  WorkbenchCareCardIdentity<K> & {
    status: 'unavailable';
    count: null;
  };

export type WorkbenchCareCardViewModel = {
  [K in CareActionPartitionKeyV1]:
    | WorkbenchCareCardCurrentViewModel<K>
    | WorkbenchCareCardStaleViewModel<K>
    | WorkbenchCareCardUnavailableViewModel<K>;
}[CareActionPartitionKeyV1];

export type WorkbenchActionSubjectViewModel =
  | {
      kind: 'customer';
      displayName: string;
      maskedReference: string | null;
    }
  | {
      kind: 'unmatched_contact';
      label: '待匹配联系人';
    };

export type WorkbenchCareOwnerViewModel =
  | {
      kind: 'user';
      displayName: string;
    }
  | {
      kind: 'role_pool';
      role: Extract<CareActionOwnerV1, { kind: 'role_pool' }>['role'];
    };

export type WorkbenchConversationAssigneeViewModel = {
  displayName: string;
};

type WorkbenchActionRowBaseViewModel = {
  subject: WorkbenchActionSubjectViewModel;
  sortSignals: InstitutionActionSortSignalV1[];
  priority: CareActionPriorityV1 | ConversationActionPriorityV1;
  slaAt: string | null;
  safeSummary: string | null;
};

export type WorkbenchAppointmentActionRowViewModel = WorkbenchActionRowBaseViewModel & {
  key: `appointment:${string}`;
  kind: 'appointment';
  businessState: CareAppointmentBusinessStateV1;
  cardKeys: CareActionPartitionKeyV1[];
  appointmentAt: string;
  riskLevel: CareActionRiskLevelV1;
  owner: WorkbenchCareOwnerViewModel | null;
  detailHref: `/hospital/care/appointments/${string}`;
};

export type WorkbenchFollowUpActionRowViewModel = WorkbenchActionRowBaseViewModel & {
  key: `followup:${string}`;
  kind: 'followup';
  businessState: CareFollowUpBusinessStateV1;
  cardKeys: CareActionPartitionKeyV1[];
  dueAt: string;
  riskLevel: CareActionRiskLevelV1;
  owner: WorkbenchCareOwnerViewModel | null;
  detailHref: `/hospital/care/followups/${string}`;
};

export type WorkbenchConversationActionRowViewModel = WorkbenchActionRowBaseViewModel & {
  key: `conversation:${string}`;
  kind: 'conversation';
  conversationState: ConversationActionStateV1;
  riskState: ConversationActionRiskStateV1;
  partitions: ConversationActionPartitionKeyV1[];
  lastCustomerMessageAt: string;
  assignee: WorkbenchConversationAssigneeViewModel | null;
  detailHref: `/hospital/conversations/${string}`;
};

export type WorkbenchActionRowViewModel =
  | WorkbenchAppointmentActionRowViewModel
  | WorkbenchFollowUpActionRowViewModel
  | WorkbenchConversationActionRowViewModel;

export type WorkbenchActionProjection =
  | {
      status: 'blocked';
      filter: WorkbenchActionFilter;
      cards: [];
      desktopActions: [];
      mobileActions: [];
    }
  | {
      status: 'projected';
      filter: WorkbenchActionFilter;
      sourceReadiness: {
        care: InstitutionSourceReadinessV1;
        conversation: InstitutionSourceReadinessV1;
      };
      cards: WorkbenchCareCardViewModel[];
      desktopActions: WorkbenchActionRowViewModel[];
      mobileActions: WorkbenchActionRowViewModel[];
    };
