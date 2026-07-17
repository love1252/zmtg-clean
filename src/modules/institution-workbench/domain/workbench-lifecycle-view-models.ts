import type { CustomerLifecycleV1 } from '@/modules/institution-contracts/v1/customer';
import type { InstitutionSourceReadinessV1 } from '@/modules/institution-contracts/v1/institution-source';

export const WORKBENCH_LIFECYCLE_KEYS = Object.freeze([
  'consulting',
  'scheduled',
  'post_care',
  'repurchase_window',
] as const satisfies readonly CustomerLifecycleV1[]);

export type WorkbenchLifecycleKey = (typeof WORKBENCH_LIFECYCLE_KEYS)[number];

export type WorkbenchLifecycleLabelByKey = {
  consulting: '咨询中';
  scheduled: '已预约';
  post_care: '术后关怀';
  repurchase_window: '复购窗口';
};

export type WorkbenchLifecycleCanonicalHref<
  K extends WorkbenchLifecycleKey = WorkbenchLifecycleKey,
> = `/hospital/customers?lifecycle=${K}`;

type WorkbenchLifecycleIdentity<K extends WorkbenchLifecycleKey> = {
  key: K;
  label: WorkbenchLifecycleLabelByKey[K];
};

type WorkbenchLifecycleCurrentItemViewModel<K extends WorkbenchLifecycleKey> =
  WorkbenchLifecycleIdentity<K> &
    (
      | {
          status: 'ready';
          count: number;
          canonicalHref: WorkbenchLifecycleCanonicalHref<K>;
        }
      | {
          status: 'empty';
          count: 0;
          canonicalHref: WorkbenchLifecycleCanonicalHref<K>;
        }
    );

type WorkbenchLifecycleStaleItemViewModel<K extends WorkbenchLifecycleKey> =
  WorkbenchLifecycleIdentity<K> &
    (
      | {
          status: 'stale';
          count: number;
          observedAt: string;
          canonicalHref: WorkbenchLifecycleCanonicalHref<K>;
        }
      | {
          status: 'stale';
          count: null;
          observedAt: null;
          canonicalHref: null;
        }
    );

type WorkbenchLifecycleUnavailableItemViewModel<K extends WorkbenchLifecycleKey> =
  WorkbenchLifecycleIdentity<K> & {
    status: 'unavailable';
    count: null;
    canonicalHref: null;
  };

export type WorkbenchLifecycleItemViewModel = {
  [K in WorkbenchLifecycleKey]:
    | WorkbenchLifecycleCurrentItemViewModel<K>
    | WorkbenchLifecycleStaleItemViewModel<K>
    | WorkbenchLifecycleUnavailableItemViewModel<K>;
}[WorkbenchLifecycleKey];

export type WorkbenchLifecycleProjectedReadiness = Exclude<
  InstitutionSourceReadinessV1,
  'denied' | 'disabled'
>;

export type WorkbenchLifecycleProjection =
  | {
      status: 'blocked';
      items: [];
    }
  | {
      status: 'projected';
      sourceReadiness: WorkbenchLifecycleProjectedReadiness;
      items: WorkbenchLifecycleItemViewModel[];
    };
